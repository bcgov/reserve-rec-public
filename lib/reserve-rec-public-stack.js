const { Stack } = require('aws-cdk-lib');

class ReserveRecPublicStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'ReserveRecPublicQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}

module.exports = { ReserveRecPublicStack }

