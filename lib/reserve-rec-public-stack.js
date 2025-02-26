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

    // if offline, merge env vars
    if (props.env.IS_OFFLINE === 'true') {
      console.log('Running offline...');
      props.env = {
        ...process.env,
        ...props.env,
      };
      delete props.env.AWS_REGION;
      delete props.env.AWS_ACCESS_KEY_ID;
      delete props.env.AWS_SECRET_ACCESS_KEY;
    }


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

