const { logger, StackPrimer, resolveParameterFromSSM } = require("../helpers/utils");
const { BaseStack } = require('../helpers/base-stack');
const { RemovalPolicy } = require('aws-cdk-lib');
const ssm = require('aws-cdk-lib/aws-ssm');
const s3 = require('aws-cdk-lib/aws-s3');
const { Key } = require('aws-cdk-lib/aws-kms');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const path = require('path');
const { Duration, Fn } = require('aws-cdk-lib');

const defaults = {
  config: {
    logLevel: process.env.LOG_LEVEL || 'info',
    distBucketRemovalPolicyDestroy: true,
    encryptionKeySSMPath: '',
    publicApiUrlSSMPath: '',
    kmsKeyAlias: null,
    kmsKeyRemovalPolicyDestroy: true,
    // Set to 'true' to create the Mode 2 CloudFront Function (viewer-request full-site gate).
    // The function is deployed with pass-through code by default. Activate/deactivate Mode 2
    // at runtime via the admin API (POST /api/admin/waiting-room/mode2) which calls
    // cloudfront:UpdateFunction + cloudfront:PublishFunction — no CDK redeploy needed.
    waitingRoomEnabled: 'false',
    // Set to 'true' to create Lambda@Edge origin-request function on /api/* (requires us-east-1 CDK bootstrap)
    waitingRoomEdgeLambdaEnabled: 'false',
    // Set to 'true' to attach WAF WebACL from SSM (requires WaitingRoomEdgeStack deployed in us-east-1)
    waitingRoomWafEnabled: 'false',
    // SSM path for WAF WebACL ARN (written by WaitingRoomEdgeStack)
    webAclArnSSMPath: '',
  },
  constructs: {
    distBucket: {
      name: 'DistBucket',
    },
    logBucket: {
      name: 'LogBucket',
    },
    encryptionKey: {
      name: 'EncryptionKey',
    },
    cloudFrontS3OAC: {
      name: 'CloudFrontS3OAC',
    },
    cloudFrontCachePolicy: {
      name: 'CloudFrontCachePolicy',
    },
    publicDistribution: {
      name: 'PublicDistribution',
    },
    kmsKey: {
      name: 'KmsKey',
    },
    waitingRoomViewerFn: {
      name: 'WaitingRoomViewerFn',
    },
    waitingRoomEdgeLambda: {
      name: 'WaitingRoomEdgeLambda',
    },
  },
  secrets: {
    cloudFrontSecretHeaderValue: {
      name: 'cloudFrontSecretHeaderValue',
    }
  }
};

async function createDistributionStack(scope, stackKey) {
  try {
    const primer = new StackPrimer(scope, stackKey, defaults);
    await primer.prime();
    return new DistributionStack(scope, primer);
  } catch (error) {
    throw new Error(`Error creating Distribution Stack: ${error}`);
  }
}

class DistributionStack extends BaseStack {
  constructor(scope, primer) {
    super(scope, primer, defaults);
    // Expose edge stack reference stored by bin/app.js for WAF ARN lookup
    this._edgeStack = scope.waitingRoomEdgeStack || null;

    logger.info(`Creating Distribution Stack: ${this.stackId}`);

    // Get Public API URL from SSM
    try {
      logger.debug('Retrieving Public API URL from SSM');
      this.publicApiUrl = resolveParameterFromSSM(this, this.getConfigValue('publicApiUrlSSMPath'));
      this.publicApiDomain = Fn.select(2, Fn.split('/', this.publicApiUrl)); // Extract domain from URL
      if (!this.publicApiDomain) {
        throw new Error('Public API Domain could not be extracted from URL');
      }
      if (!this.publicApiUrl) {
        throw new Error('Public API URL not found in SSM');
      }
    } catch (error) {
      throw new Error(`Error retrieving Public API URL from SSM: ${error}`);
    }

    // Create KMS Key
    if (this.getConfigValue('kmsKeyAlias')) {
      // A key already exists and we are just importing it.
      this.kmsKey = Key.fromLookup(this, this.getConstructId('kmsKey'), {
        aliasName: this.getConfigValue('kmsKeyAlias')  // Should be like 'alias/my-key'
      });
    } else {
      // Create a new key
      this.kmsKey = new Key(this, this.getConstructId('kmsKey'), {
        enableKeyRotation: true,
        alias: this.getConstructId('kmsKey'),
        description: `KMS Key for ${this.stackId}`,
        removalPolicy: this.getConfigValue('kmsKeyRemovalPolicyDestroy') === 'true' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      });
    }

    // Define S3 Distribution Bucket
    this.distBucket = new s3.Bucket(this, this.getConstructId('distBucket'), {
      bucketName: this.getConstructId('distBucket').toLowerCase(),
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_PREFERRED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      encryptionKey: this.kmsKey,
      removalPolicy: this.getConfigValue('distBucketRemovalPolicyDestroy') === 'true' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE
          ],
          allowedHeaders: ['*'],
          maxAge: 3000,
        }
      ]
    });

    // Manually add OAC bucket policy statement using a wildcard distribution ARN.
    //
    // Why: when S3BucketOrigin.withOriginAccessControl() is used with a concrete bucket,
    // CDK auto-generates an AWS::S3::BucketPolicy statement whose condition references the
    // specific distribution ARN (Ref: 'PublicDistribution'). This creates a circular dependency:
    // the bucket policy can only be created AFTER the distribution, which takes ~3 minutes.
    // In the BCGov LZA (Landing Zone Accelerator) environment, LZA automatically adds its own
    // SSL-enforcement bucket policy within ~10 seconds of bucket creation. By the time CDK's
    // bucket policy is ready to be created, LZA has already set the policy, and CloudFormation
    // fails with "The bucket policy already exists."
    //
    // Fix: add the OAC statement immediately after bucket creation using StringLike with a
    // wildcard distribution ARN (`arn:aws:cloudfront::${account}:distribution/*`). This only
    // depends on AWS::AccountId (a pseudo-parameter available immediately), not on the
    // distribution resource, so the bucket policy can be created in the same early wave as the
    // bucket itself — before LZA fires.
    //
    // The CloudFront origin uses an imported bucket reference (below) so CDK does not add the
    // auto-generated specific-ARN statement that would re-introduce the circular dependency.
    this.distBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudFrontOACRead',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [this.distBucket.arnForObjects('*')],
      conditions: {
        StringLike: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/*`,
        },
      },
    }));

    // Imported bucket reference used as the CloudFront S3 origin.
    // CDK cannot add bucket policies to imported buckets (logs a warning and skips), which is
    // intentional here — it prevents CDK from generating a second, specific-ARN OAC statement
    // that would reintroduce the circular dependency. The actual distBucket uses the
    // wildcard OAC statement added above.
    const distBucketForOrigin = s3.Bucket.fromBucketAttributes(this, 'DistBucketForOrigin', {
      bucketArn: this.distBucket.bucketArn,
      bucketName: this.distBucket.bucketName,
    });

    // Define S3 Log Bucket
    this.logBucket = new s3.Bucket(this, this.getConstructId('logBucket'), {
      bucketName: `${this.getConstructId('logBucket').toLowerCase()}-logs`,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_PREFERRED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    // OAC
    this.originAccessControl = new cloudfront.S3OriginAccessControl(this, this.getConstructId('cloudFrontS3OAC'), {
      description: 'Origin Access Policy'
    });

    // TODO: review if cache policy settings are appropriate. Because of fine-grained authorization, caching may need to remain disabled.
    // Cache Policy for CloudFront
    // this.cachePolicy = new cloudfront.CachePolicy(this, this.getConstructId('cloudFrontCachePolicy'), {
    //   cachePolicyName: this.getConstructId('cloudFrontCachePolicy'),
    //   comment: 'Cache policy for CloudFront distribution',
    //   headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
    //   queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    //   cookieBehavior: cloudfront.CacheCookieBehavior.all(),
    //   defaultTtl: Duration.minutes(0),
    //   maxTtl: Duration.minutes(0),
    //   minTtl: Duration.minutes(0),
    //   enableAcceptEncodingBrotli: true,
    //   enableAcceptEncodingGzip: true,
    // });

    // Look up shared secret for X-Origin-Verify header (enforced by WAF on the API Gateway stage)
    const originVerifySecret = ssm.StringParameter.valueForStringParameter(
      this,
      `/reserveRecApi/${this.getDeploymentName()}/originVerifySecret`
    );

    // CloudFront Distribution
    this.publicDistribution = new cloudfront.Distribution(this, this.getConstructId('publicDistribution'), {
      name: this.getConstructId('publicDistribution'),
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(distBucketForOrigin, {
          originPath: 'latest/reserve-rec-public/browser',
          originAccessControl: this.originAccessControl,
          customHeaders: {
            'X-CloudFront-Secret': this.getSecretValue('cloudFrontSecretHeaderValue'),
          }
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,

      },
      comment: `Reserve Rec Public CloudFront Distribution (${this.getDeploymentName()})`,
      compress: true,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(this.publicApiDomain, {
            originPath: '',
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
              'X-Origin-Verify': originVerifySecret,
            },
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
        },
      },
      /**
           * Belarus, Central African Republic, China, Democratic Republic of the Congo, Iran, Iraq, Democratic
           * People's Republic of Korea, Lebanon, Libya, Mali, Myanmar, Nicaragua, Russia, Somalia, South Sudan,
           * Sudan, Syria, Ukraine, Venezuela, Yemen, Zimbabwe
           */
      geoRestriction: cloudfront.GeoRestriction.blacklist(
        'BY', 'CF', 'CN', 'CD', 'IR', 'IQ', 'KP', 'LB', 'LY', 'ML', 'MM', 'NI', 'RU', 'SO', 'SS', 'SD', 'SY', 'UA', 'VE', 'YE', 'ZW'
      ),
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      defaultRootObject: 'index.html',
      logBucket: this.logBucket,
      logIncludesCookies: false,
    });

    // Waiting Room edge integration (optional — enabled via config)
    this._addWaitingRoomEdgeResources();

    // Export References

    this.exportReference(this, 'distributionId', this.publicDistribution.distributionId, `ID of the Public CloudFront Distribution in ${this.stackId}`);

    this.exportReference(this, 'distributionDomainName', this.publicDistribution.domainName, `Domain Name of the Public CloudFront Distribution in ${this.stackId}`);
  }

  /**
   * Conditionally adds waiting room edge resources to the CloudFront distribution.
   *
   * Mode 2 — CloudFront Function (viewer-request, full-site gate):
   *   Deployed with pass-through code by default. Toggled at runtime via the admin API
   *   (POST /api/admin/waiting-room/mode2) which calls cloudfront:UpdateFunction +
   *   cloudfront:PublishFunction — no CDK redeploy needed, propagates globally in ~1-2s.
   *
   *   KVS is NOT used. The cloudfront-keyvaluestore:* API is explicitly denied by org SCP
   *   p-0olid24c account-wide. See waiting-room-mode2-options.md for full analysis.
   *
   *   Enabled via: waitingRoomEnabled = 'true' in SSM config.
   *
   * Mode 1 additions (when separately enabled):
   *   - Lambda@Edge on /api/* (requires us-east-1 CDK bootstrap — waitingRoomEdgeLambdaEnabled)
   *   - WAF WebACL (requires WaitingRoomEdgeStack in us-east-1 — waitingRoomWafEnabled)
   */
  _addWaitingRoomEdgeResources() {
    const cfnDist = this.publicDistribution.node.defaultChild;

    // Mode 2 — CloudFront Function, viewer-request on default (SPA) behavior.
    // Deployed as pass-through. Admin API updates + publishes the function code to toggle.
    // The function name is exported to SSM so the admin Lambda can reference it.
    if (this.getConfigValue('waitingRoomEnabled') === 'true') {
      // Default code: pure pass-through. Admin API swaps this to the gating version at runtime.
      const passThrough = [
        'async function handler(event) {',
        '  return event.request;',
        '}',
      ].join('\n');

      this.waitingRoomViewerFn = new cloudfront.Function(this, this.getConstructId('waitingRoomViewerFn'), {
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        code: cloudfront.FunctionCode.fromInline(passThrough),
        comment: `WR Mode 2 viewer-request gate for ${this.getDeploymentName()} — toggle via admin API`,
      });

      cfnDist.addPropertyOverride('DistributionConfig.DefaultCacheBehavior.FunctionAssociations', [
        {
          EventType: 'viewer-request',
          FunctionARN: this.waitingRoomViewerFn.functionArn,
        },
      ]);

      // Export function name so the admin Lambda can call UpdateFunction/PublishFunction
      this.exportReference(this, 'waitingRoomViewerFnName', this.waitingRoomViewerFn.functionName,
        `CF Function name for Mode 2 toggle in ${this.stackId}`);

      logger.info(`Mode 2 CloudFront Function created (pass-through, toggle via admin API): ${this.waitingRoomViewerFn.functionName}`);
    } else {
      logger.info('waitingRoomEnabled !== true — skipping Mode 2 CloudFront Function');
    }

    // Lambda@Edge — origin-request on /api/* (requires us-east-1 CDK bootstrap).
    // Validates admission cookie structure; full HMAC validation is in the origin booking Lambda.
    if (this.getConfigValue('waitingRoomEdgeLambdaEnabled') === 'true') {
      this.waitingRoomEdgeLambda = new cloudfront.experimental.EdgeFunction(
        this,
        this.getConstructId('waitingRoomEdgeLambda'),
        {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: 'index.handler',
          code: lambda.Code.fromAsset(path.join(__dirname, '../../src/handlers/waiting-room-edge')),
          timeout: Duration.seconds(5),
          memorySize: 128,
          description: `WR Lambda@Edge origin-request for ${this.getDeploymentName()}`,
        }
      );

      cfnDist.addPropertyOverride('DistributionConfig.CacheBehaviors.0.LambdaFunctionAssociations', [
        {
          EventType: 'origin-request',
          LambdaFunctionARN: this.waitingRoomEdgeLambda.functionArn,
          IncludeBody: false,
        },
      ]);

      logger.info('Lambda@Edge origin-request function created and attached to /api/* behavior');
    } else {
      logger.info('waitingRoomEdgeLambdaEnabled !== true — skipping Lambda@Edge');
    }

    // WAF WebACL — attaches to distribution (ARN from SSM written by WaitingRoomEdgeStack).
    if (this.getConfigValue('waitingRoomWafEnabled') === 'true') {
      const webAclArnSSMPath = this.getConfigValue('webAclArnSSMPath');
      if (webAclArnSSMPath) {
        const webAclArn = resolveParameterFromSSM(this, webAclArnSSMPath);
        cfnDist.addPropertyOverride('DistributionConfig.WebACLId', webAclArn);
        logger.info(`WAF WebACL attached from SSM: ${webAclArnSSMPath}`);
      }
    } else {
      logger.info('waitingRoomWafEnabled !== true — skipping WAF');
    }
  }
}

module.exports = {
  createDistributionStack
};