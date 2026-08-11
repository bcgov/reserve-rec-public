const { logger, StackPrimer, resolveParameterFromSSM } = require("../helpers/utils");
const { BaseStack } = require('../helpers/base-stack');
const { RemovalPolicy, Duration, Fn } = require('aws-cdk-lib');
const ssm = require('aws-cdk-lib/aws-ssm');
const s3 = require('aws-cdk-lib/aws-s3');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');

const defaults = {
  config: {
    logLevel: process.env.LOG_LEVEL || 'info',
    // SSM path holding the public API URL (written by reserve-rec-api's publicApiStack).
    publicApiUrlSSMPath: '',
    // SSM path holding the SPA dist bucket name (written by distributionStack).
    distBucketNameSSMPath: '',
    // Optional vanity hostname wiring. Both must be set together. The cert must live in
    // us-east-1 of this account — it is provisioned OUT OF BAND via the ACM API because the
    // LZA SCP denies CloudFormation in us-east-1 (see reserve-rec-api#207).
    certificateArn: '',
    domainNames: '',      // comma-separated, e.g. 'dev-reserve.bcparks.ca'
    // Optional CLOUDFRONT-scope WAF WebACL ARN (also provisioned out of band, us-east-1).
    webAclArn: '',
  },
  constructs: {
    logBucket: {
      name: 'LogBucket',
    },
    frontDoorS3OAC: {
      name: 'FrontDoorS3OAC',
    },
    rootRedirectFn: {
      name: 'RootRedirectFn',
    },
    dayuseSpaFallbackFn: {
      name: 'DayuseSpaFallbackFn',
    },
    dayuseApiStripFn: {
      name: 'DayuseApiStripFn',
    },
    frontDoorDistribution: {
      name: 'FrontDoorDistribution',
    },
  },
  secrets: {}
};

async function createFrontDoorStack(scope, stackKey) {
  try {
    const primer = new StackPrimer(scope, stackKey, defaults);
    await primer.prime();
    return new FrontDoorStack(scope, primer);
  } catch (error) {
    throw new Error(`Error creating Front Door Stack: ${error}`);
  }
}

/**
 * FrontDoorStack — the shared multi-product entry point for reserve.bcparks.ca.
 *
 * A thin CloudFront distribution whose only job is routing, TLS and edge security.
 * Products mount under a path prefix as one origin + one behavior; day-use is tenant #1
 * at /dayuse. Nothing else lives here — no product owns this distribution.
 *
 * Design notes (see reserve-rec-api#207 and the "Unified Front-Door" Confluence page):
 * - No distribution-wide errorResponses: SPA deep-link fallback is per-behavior
 *   (a viewer-request function scoped to the tenant prefix), so one tenant's 404
 *   handling can never shadow another tenant's.
 * - /dayuse/api/* needs a strip-prefix function because the API Gateway stage is
 *   named 'api' — CloudFront forwards the full viewer path, so /dayuse/api/x must
 *   be rewritten to /api/x before it reaches the origin.
 * - The S3 origin is path-preserving (originPath '') — the deploy workflow publishes
 *   the SPA under a dayuse/ key prefix with <base href="/dayuse/">.
 * - The dist bucket's OAC policy statement already allows any distribution in this
 *   account (wildcard SourceArn — see distribution-stack.js), so mounting the bucket
 *   here needs no bucket-policy changes.
 * - Waiting-room Mode 2 is NOT wired in this stack yet: CloudFront allows one
 *   viewer-request function per behavior, and /dayuse* uses its slot for the SPA
 *   fallback. Folding the Mode-2 gate into that function (so the admin toggle
 *   updates it) is follow-up work before prod cutover.
 */
class FrontDoorStack extends BaseStack {
  constructor(scope, primer) {
    super(scope, primer, defaults);

    logger.info(`Creating Front Door Stack: ${this.stackId}`);

    // Resolve the public API domain from SSM (same pattern as distribution-stack).
    try {
      logger.debug('Retrieving Public API URL from SSM');
      this.publicApiUrl = resolveParameterFromSSM(this, this.getConfigValue('publicApiUrlSSMPath'));
      this.publicApiDomain = Fn.select(2, Fn.split('/', this.publicApiUrl));
      if (!this.publicApiDomain || !this.publicApiUrl) {
        throw new Error('Public API URL/Domain could not be resolved');
      }
    } catch (error) {
      throw new Error(`Error retrieving Public API URL from SSM: ${error}`);
    }

    // Resolve the SPA dist bucket (owned by distributionStack) by name from SSM.
    // Imported reference only — this stack must not mutate the bucket.
    const distBucketName = resolveParameterFromSSM(this, this.getConfigValue('distBucketNameSSMPath'));
    const distBucket = s3.Bucket.fromBucketName(this, 'TenantDayuseDistBucket', distBucketName);

    // Shared secret enforced by the WAF on the API Gateway stage.
    const originVerifySecret = ssm.StringParameter.valueForStringParameter(
      this,
      `/reserveRecApi/${this.getDeploymentName()}/originVerifySecret`
    );

    // Log bucket
    this.logBucket = new s3.Bucket(this, this.getConstructId('logBucket'), {
      bucketName: `${this.getConstructId('logBucket').toLowerCase()}-logs`,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_PREFERRED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    // OAC for tenant S3 origins
    this.originAccessControl = new cloudfront.S3OriginAccessControl(this, this.getConstructId('frontDoorS3OAC'), {
      description: 'Front door origin access control'
    });

    // --- CloudFront Functions -------------------------------------------------

    // Default behavior: everything that no tenant claims is redirected to /dayuse.
    // This preserves what visitors get today — the DUP distribution serves the SPA
    // (base href /dayuse/) on every unmatched path — as an explicit edge 301.
    this.rootRedirectFn = new cloudfront.Function(this, this.getConstructId('rootRedirectFn'), {
      functionName: `${this.getAppName()}-${this.getDeploymentName()}-FrontDoorRootRedirectFn`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline([
        'function handler(event) {',
        '  return {',
        '    statusCode: 301,',
        '    statusDescription: "Moved Permanently",',
        '    headers: { location: { value: "/dayuse/" } },',
        '  };',
        '}',
      ].join('\n')),
      comment: `Front door default-behavior redirect to /dayuse (${this.getDeploymentName()})`,
    });

    // /dayuse* SPA deep-link fallback: extension-less URIs rewrite to the tenant's
    // index.html so the Angular router resolves them client-side. Scoped to the
    // /dayuse prefix — this replaces the distribution-wide 403/404 errorResponses
    // used by the standalone public distribution.
    this.dayuseSpaFallbackFn = new cloudfront.Function(this, this.getConstructId('dayuseSpaFallbackFn'), {
      functionName: `${this.getAppName()}-${this.getDeploymentName()}-FrontDoorDayuseSpaFallbackFn`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline([
        'function handler(event) {',
        '  var request = event.request;',
        '  var uri = request.uri;',
        '  // Rewrite paths without a file extension in the last segment to the SPA',
        '  // entry point. Static assets like /dayuse/main-abc.js pass through.',
        '  if (uri.lastIndexOf(".") < uri.lastIndexOf("/")) {',
        '    request.uri = "/dayuse/index.html";',
        '  }',
        '  return request;',
        '}',
      ].join('\n')),
      comment: `SPA deep-link fallback for /dayuse (${this.getDeploymentName()})`,
    });

    // /dayuse/api/* → strip the tenant prefix. The API Gateway stage is named 'api',
    // so the origin expects /api/..., but CloudFront forwards the full viewer path.
    this.dayuseApiStripFn = new cloudfront.Function(this, this.getConstructId('dayuseApiStripFn'), {
      functionName: `${this.getAppName()}-${this.getDeploymentName()}-FrontDoorDayuseApiStripFn`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline([
        'function handler(event) {',
        '  var request = event.request;',
        '  if (request.uri.startsWith("/dayuse/api")) {',
        '    request.uri = request.uri.substring("/dayuse".length);',
        '  }',
        '  return request;',
        '}',
      ].join('\n')),
      comment: `Strip /dayuse prefix for API origin (${this.getDeploymentName()})`,
    });

    // --- Tenant origins -------------------------------------------------------

    // Day-use SPA: path-preserving S3 origin. The deploy workflow publishes the app
    // under s3://<bucket>/dayuse/ with <base href="/dayuse/">, so the viewer path
    // maps 1:1 onto object keys and no rewrite is needed for assets.
    const dayuseSpaOrigin = origins.S3BucketOrigin.withOriginAccessControl(distBucket, {
      originPath: '',
      originAccessControl: this.originAccessControl,
    });

    // Day-use API: same wiring as the standalone distribution's /api/* behavior.
    const dayuseApiOrigin = new origins.HttpOrigin(this.publicApiDomain, {
      originPath: '',
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: {
        'X-Origin-Verify': originVerifySecret,
      },
    });

    // --- Distribution ---------------------------------------------------------

    // Optional vanity hostname + cert (see defaults.config notes).
    const domainNames = (this.getConfigValue('domainNames') || '')
      .split(',').map((d) => d.trim()).filter((d) => d.length > 0);
    const certificateArn = this.getConfigValue('certificateArn') || '';
    const hasVanity = domainNames.length > 0 && certificateArn.length > 0;
    if (hasVanity) {
      logger.info(`Front door vanity hostnames: ${domainNames.join(', ')}`);
    } else {
      logger.info('No vanity hostname configured — front door serves on its *.cloudfront.net domain');
    }

    this.frontDoorDistribution = new cloudfront.Distribution(this, this.getConstructId('frontDoorDistribution'), {
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      comment: `Reserve Rec Front Door (${this.getDeploymentName()})`,
      compress: true,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        // The origin is never reached — rootRedirectFn answers every request —
        // but CloudFront requires one on the default behavior.
        origin: dayuseSpaOrigin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          function: this.rootRedirectFn,
        }],
      },
      // Order matters: CloudFront evaluates patterns in the order given, so the
      // more specific /dayuse/api/* must precede /dayuse*.
      additionalBehaviors: {
        '/dayuse/api/*': {
          origin: dayuseApiOrigin,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
          functionAssociations: [{
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: this.dayuseApiStripFn,
          }],
        },
        '/dayuse*': {
          origin: dayuseSpaOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
          functionAssociations: [{
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: this.dayuseSpaFallbackFn,
          }],
        },
      },
      // NO errorResponses here, by design — deep-link fallback is per-behavior.
      /**
       * Belarus, Central African Republic, China, Democratic Republic of the Congo, Iran, Iraq, Democratic
       * People's Republic of Korea, Lebanon, Libya, Mali, Myanmar, Nicaragua, Russia, Somalia, South Sudan,
       * Sudan, Syria, Ukraine, Venezuela, Yemen, Zimbabwe
       */
      geoRestriction: cloudfront.GeoRestriction.blacklist(
        'BY', 'CF', 'CN', 'CD', 'IR', 'IQ', 'KP', 'LB', 'LY', 'ML', 'MM', 'NI', 'RU', 'SO', 'SS', 'SD', 'SY', 'UA', 'VE', 'YE', 'ZW'
      ),
      logBucket: this.logBucket,
      logIncludesCookies: false,
      ...(hasVanity ? {
        domainNames: domainNames,
        certificate: acm.Certificate.fromCertificateArn(this, 'FrontDoorCertificate', certificateArn),
      } : {}),
    });

    // Optional WAF (CLOUDFRONT scope, us-east-1 — ARN provisioned out of band).
    const webAclArn = this.getConfigValue('webAclArn') || '';
    if (webAclArn) {
      this.frontDoorDistribution.node.defaultChild.addPropertyOverride('DistributionConfig.WebACLId', webAclArn);
      logger.info('Front door WAF WebACL attached');
    }

    // Export References
    this.exportReference(this, 'frontDoorDistributionId', this.frontDoorDistribution.distributionId, `ID of the Front Door Distribution in ${this.stackId}`);
    this.exportReference(this, 'frontDoorDomainName', this.frontDoorDistribution.domainName, `Domain Name of the Front Door Distribution in ${this.stackId}`);
  }
}

module.exports = {
  createFrontDoorStack
};
