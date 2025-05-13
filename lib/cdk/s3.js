/**
 * Builds the S3 resources for the Reserve Rec PUBLIC stack.
 */

const s3 = require('aws-cdk-lib/aws-s3');
const { RemovalPolicy } = require('aws-cdk-lib');

function s3Setup(scope, props) {
  console.log('Setting up S3 resources...');
  console.log('S3_BUCKET_PUBLIC:', props.env.S3_BUCKET_PUBLIC);

  // S3 BUCKETS

  const reserveRecPublicDistBucket = new s3.Bucket(scope, 'ReserveRecPublicDistBucket', {
    bucketName: props.env.S3_BUCKET_PUBLIC,
    accessControl: s3.BucketAccessControl.BUCKET_OWNER_PREFERRED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    encryptionKey: props.env.KMS_KEY,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    cors: [
      {
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
        allowedHeaders: ['*'],
      }
    ],
  });

  const reserveRecPublicLogBucket = new s3.Bucket(scope, 'ReserveRecPublicLogBucket', {
    bucketName: `${props.env.S3_BUCKET_PUBLIC}-logs`,
    accessControl: s3.BucketAccessControl.BUCKET_OWNER_PREFERRED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
  });

  return {
    reserveRecPublicDistBucket: reserveRecPublicDistBucket,
    reserveRecPublicLogBucket: reserveRecPublicLogBucket,
  };
}

module.exports = {
  s3Setup,
}