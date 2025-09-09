#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { ReserveRecPublicStack } = require('../lib/reserve-rec-public-stack');

const app = new cdk.App();
new ReserveRecPublicStack(app, process.env.STACK_NAME, {
  env: {
    //AWS account variables
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,

    // Custom environment variables
    ENVIRONMENT: process.env.ENVIRONMENT || 'dev',
    S3_BUCKET_PUBLIC: process.env.S3_BUCKET_PUBLIC || 'reserve-rec-public-cdk',
    API_STAGE: process.env.API_STAGE || 'api',
    STACK_NAME: process.env.STACK_NAME || 'ReserveRecPublicStack',
  }
});
