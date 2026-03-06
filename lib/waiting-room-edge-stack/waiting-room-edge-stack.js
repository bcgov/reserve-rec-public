'use strict';

/**
 * WaitingRoomEdgeStack — deployed to us-east-1.
 *
 * Contains all us-east-1 resources required for CloudFront integration:
 *   - WAF WebACL (CloudFront WAF must be in us-east-1)
 *
 * After creation, the WAF WebACL ARN is stored in ca-central-1 SSM so the
 * distribution stack (ca-central-1) can attach it to the CloudFront distribution.
 *
 * CloudFront KVS and CloudFront Function are global resources created directly
 * in the distribution stack.  Lambda@Edge is created via EdgeFunction in the
 * distribution stack (which auto-deploys the function to us-east-1).
 */

const { logger, StackPrimer } = require('../helpers/utils');
const { BaseStack } = require('../helpers/base-stack');
const wafv2 = require('aws-cdk-lib/aws-wafv2');
const cr = require('aws-cdk-lib/custom-resources');
const iam = require('aws-cdk-lib/aws-iam');

const defaults = {
  config: {
    logLevel: process.env.LOG_LEVEL || 'info',
    // Set enableWaf: 'false' in SSM config to skip WAF creation (e.g. accounts without WAF subscription)
    enableWaf: 'true',
  },
  constructs: {
    webAcl: {
      name: 'WafWebAcl',
    },
  },
};

async function createWaitingRoomEdgeStack(scope, stackKey) {
  try {
    const primer = new StackPrimer(scope, stackKey, defaults);
    // Override region: all resources in this stack must be in us-east-1
    primer.env = { ...primer.env, region: 'us-east-1' };
    await primer.prime();
    return new WaitingRoomEdgeStack(scope, primer);
  } catch (error) {
    throw new Error(`Error creating WaitingRoom Edge Stack: ${error}`);
  }
}

class WaitingRoomEdgeStack extends BaseStack {
  constructor(scope, primer) {
    super(scope, primer);

    logger.info(`Creating WaitingRoom Edge Stack: ${this.stackId}`);

    const enableWaf = this.getConfigValue('enableWaf') !== 'false';

    if (enableWaf) {
      // WAF WebACL — must be in us-east-1 for CloudFront
      this.webAcl = new wafv2.CfnWebACL(this, this.getConstructId('webAcl'), {
        name: this.getConstructId('webAcl'),
        scope: 'CLOUDFRONT',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${this.stackId}WR`,
          sampledRequestsEnabled: true,
        },
        rules: [
          // Rate limit /api/waiting-room/* — 100 requests per 5 minutes per IP
          {
            name: 'WaitingRoomRateLimit',
            priority: 1,
            statement: {
              rateBasedStatement: {
                limit: 100,
                aggregateKeyType: 'IP',
                scopeDownStatement: {
                  byteMatchStatement: {
                    searchString: '/api/waiting-room',
                    fieldToMatch: { uriPath: {} },
                    textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                    positionalConstraint: 'STARTS_WITH',
                  },
                },
              },
            },
            action: { block: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'WaitingRoomRateLimit',
              sampledRequestsEnabled: true,
            },
          },
          // Rate limit /api/waiting-room/join — stricter limit for join endpoint
          {
            name: 'WaitingRoomJoinRateLimit',
            priority: 2,
            statement: {
              rateBasedStatement: {
                limit: 10,
                aggregateKeyType: 'IP',
                scopeDownStatement: {
                  andStatement: {
                    statements: [
                      {
                        byteMatchStatement: {
                          searchString: '/api/waiting-room/join',
                          fieldToMatch: { uriPath: {} },
                          textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                          positionalConstraint: 'STARTS_WITH',
                        },
                      },
                      {
                        byteMatchStatement: {
                          searchString: 'POST',
                          fieldToMatch: { method: {} },
                          textTransformations: [{ priority: 0, type: 'NONE' }],
                          positionalConstraint: 'EXACTLY',
                        },
                      },
                    ],
                  },
                },
              },
            },
            action: { block: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'WaitingRoomJoinRateLimit',
              sampledRequestsEnabled: true,
            },
          },
        ],
      });

      // Export WAF ARN to ca-central-1 SSM so the distribution stack can read it.
      // The edge stack is in us-east-1; AwsCustomResource calls SSM in ca-central-1 cross-region.
      const webAclArnSsmPath = this.createConstructSSMPath('webAclArn');

      new cr.AwsCustomResource(this, 'ExportWebAclArn', {
        onCreate: {
          service: 'SSM',
          action: 'putParameter',
          parameters: {
            Name: webAclArnSsmPath,
            Value: this.webAcl.attrArn,
            Type: 'String',
            Overwrite: true,
          },
          region: 'ca-central-1',
          physicalResourceId: cr.PhysicalResourceId.of('WebAclArnSsmExport'),
        },
        onUpdate: {
          service: 'SSM',
          action: 'putParameter',
          parameters: {
            Name: webAclArnSsmPath,
            Value: this.webAcl.attrArn,
            Type: 'String',
            Overwrite: true,
          },
          region: 'ca-central-1',
          physicalResourceId: cr.PhysicalResourceId.of('WebAclArnSsmExport'),
        },
        onDelete: {
          service: 'SSM',
          action: 'deleteParameter',
          parameters: { Name: webAclArnSsmPath },
          ignoreErrorCodesMatching: 'ParameterNotFound',
          region: 'ca-central-1',
          physicalResourceId: cr.PhysicalResourceId.of('WebAclArnSsmExport'),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
            resources: [`arn:aws:ssm:ca-central-1:*:parameter/reserveRecPublic/*`],
          }),
        ]),
      });

      logger.info(`WaitingRoom WAF WebACL created: ${this.getConstructId('webAcl')}`);
    } else {
      logger.info('WAF disabled via config — skipping WebACL creation');
    }
  }
}

module.exports = { createWaitingRoomEdgeStack };
