/**
 * Builds the CloudFront resources for the Reserve Rec PUBLIC stack.
 */

const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const { CfnOutput, Duration } = require('aws-cdk-lib');

function cloudFrontSetup(scope, props) {
  console.log('Setting up CloudFront resources...');

  // Origin Access Identity
  const reserveRecOAC = new cloudfront.S3OriginAccessControl(scope, 'ReserveRecOAC', {
    description: 'Reserve Rec Origin Access Control Public (CDK)',
  });

  // Custom Cache Policy to allow Authorization headers
  const cachePolicy = new cloudfront.CachePolicy(scope, 'ReserveRecAPICachePolicy', {
    cachePolicyName: 'ReserveRecAPICachePolicy',
    headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    defaultTtl: Duration.hours(1),
    minTtl: Duration.minutes(1),
    maxTtl: Duration.hours(2),
    enableAcceptEncodingBrotli: true,
    enableAcceptEncodingGzip: true,
  });

  // CloudFront DISTRIBUTION

  const reserveRecPublicDistribution = new cloudfront.Distribution(scope, 'ReserveRecPublicDistribution', {
    enabled: true,
    httpVersion: cloudfront.HttpVersion.HTTP2,
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(props.reserveRecPublicDistBucket, {
        originPath: 'latest/reserve-rec-public/browser',
        originAccessControl: reserveRecOAC,
      }),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    },
    comment: 'Reserve Rec Public Distribution (CDK)',
    compress: true,
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    additionalBehaviors: {
      '/api/*': {
        origin: new origins.RestApiOrigin(props.api,{
          originPath: '',
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cachePolicy,
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
    defaultRootObject: 'index.html',
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
      },
      {
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
      },
    ],
    logBucket: props.reserveRecPublicLogBucket,
    logIncludesCookies: false,
  });

  new CfnOutput(scope, 'Reserve Rec Public Domain Name', {
    value: reserveRecPublicDistribution.domainName,
    description: 'Reserve Rec Public Domain Name Reference',
    exportName: 'ReserveRecPublicDomainName',
  });

  return {
    reserveRecPublicDistribution: reserveRecPublicDistribution,
  };
}

module.exports = {
  cloudFrontSetup
};