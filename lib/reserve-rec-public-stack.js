const { Stack, Fn } = require('aws-cdk-lib');

const apigateway = require('aws-cdk-lib/aws-apigateway');

// CDK RESOURCES
const { cloudFrontSetup } = require('./cdk/cloudfront');
const { s3Setup } = require('./cdk/s3');

class ReserveRecPublicStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Import existing API Gateway
    const reserveRecApiGatewayId = Fn.importValue('ReserveRecApiGatewayId');

    // Import existing API Gateway Root Resource
    const reserveRecApiRootResourceId = Fn.importValue('ReserveRecApiRootResourceId');

    // Declare imported API Gateway
    const api = apigateway.RestApi.fromRestApiAttributes(this, 'ReserveRecPublicApi', {
      restApiId: reserveRecApiGatewayId,
      rootResourceId: reserveRecApiRootResourceId
    });

    const stage = apigateway.Stage.fromStageAttributes(this, `ReserveRecPublicApiStage-${props.env.API_STAGE}`, {
      restApi: api,
      stageName: props.env.API_STAGE
    });

    api.deploymentStage = stage;

    // S3
    const s3Resources = s3Setup(this, {
      env: props.env,
    });

    // CLOUDFRONT
    const cloudFrontResources = cloudFrontSetup(this, {
      env: props.env,
      api: api,
      reserveRecPublicDistBucket: s3Resources.reserveRecPublicDistBucket,
      reserveRecPublicLogBucket: s3Resources.reserveRecPublicLogBucket,
    });

  }
}

module.exports = { ReserveRecPublicStack }

