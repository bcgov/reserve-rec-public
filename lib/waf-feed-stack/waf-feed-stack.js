/**
 * waf-feed-stack — weekly refresh of the front-door WAF's datacenter IPSets.
 *
 * Provider ranges drift over weeks. The refresh used to be a script somebody
 * remembered to run; this puts it on a schedule.
 *
 * WHY THIS ONE CAN BE CDK: the IPSets are CLOUDFRONT scope and therefore live
 * in us-east-1, where the LZA SCP denies CloudFormation — which is why
 * provision_waf.py is a script. But us-east-1 is only the region of the API
 * call, not of the resources here, so the function and its schedule deploy
 * normally alongside the other stacks.
 *
 * WHAT IS NOT HERE: which providers are blocked, and the ASNs behind them.
 * This repository is public. The function reads that list from SSM at run
 * time, and the IAM policy below is scoped by wildcard so the resource ARNs do
 * not name them either — an enumerated policy would put the whole list back in
 * git in the least obvious place.
 */
const path = require('path');
const { Duration } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const iam = require('aws-cdk-lib/aws-iam');
const logs = require('aws-cdk-lib/aws-logs');
const { logger, StackPrimer } = require('../helpers/utils');
const { BaseStack } = require('../helpers/base-stack');

const WAF_REGION = 'us-east-1';   // CLOUDFRONT scope is always us-east-1

const defaults = {
  config: {
    logLevel: process.env.LOG_LEVEL || 'info',
    // 'false' deploys the function without a trigger, for manual invocation.
    enableSchedule: 'true',
    // Weekly, off-peak. Upstream ranges drift over days, not hours.
    scheduleExpression: 'cron(20 9 ? * MON *)',
  },
  constructs: {
    feedFunction: { name: 'WafDatacenterFeed' },
    feedSchedule: { name: 'WafDatacenterFeedWeekly' },
  },
};

async function createWafFeedStack(scope, stackKey) {
  try {
    const primer = new StackPrimer(scope, stackKey, defaults);
    await primer.prime();
    return new WafFeedStack(scope, primer);
  } catch (error) {
    throw new Error(`Error creating WAF Feed Stack: ${error}`);
  }
}

class WafFeedStack extends BaseStack {
  constructor(scope, primer) {
    super(scope, primer);

    logger.info(`Creating WAF Feed Stack: ${this.stackId}`);

    const env = this.getDeploymentName();

    // Ships the whole scripts/front-door-waf directory: the handler imports
    // datacenter_feed and provision_waf directly rather than duplicating them.
    // Standard library plus the boto3 the runtime already provides, so there is
    // nothing to bundle.
    this.feedFunction = new lambda.Function(this, this.getConstructId('feedFunction'), {
      functionName: `${this.getAppName()}-${env}-WafDatacenterFeed`,
      description: `Weekly datacenter IPSet refresh for the ${env} front-door WAF`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'feed_handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'scripts', 'front-door-waf'), {
        exclude: ['__pycache__', '*.pyc', 'README.md', 'soak_report.py'],
      }),
      environment: { ENV_NAME: env },
      // Generous: the run is dominated by upstream lookups, not compute.
      timeout: Duration.minutes(10),
      memorySize: 512,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    });

    // Wildcard on purpose — see the note at the top of this file. The account
    // is this one; the region is us-east-1 because the sets are CloudFront scope.
    this.feedFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['wafv2:ListIPSets', 'wafv2:GetIPSet', 'wafv2:UpdateIPSet'],
      resources: [`arn:aws:wafv2:${WAF_REGION}:${this.account}:global/ipset/*`],
    }));

    this.feedFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/reserveRecPublic/${env}/frontDoorWaf/providers`,
      ],
    }));

    // The feed refuses to run against the wrong account, and needs its own
    // identity to check that.
    this.feedFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    if (this.getConfigValue('enableSchedule') !== 'false') {
      this.feedSchedule = new events.Rule(this, this.getConstructId('feedSchedule'), {
        ruleName: `${this.getAppName()}-${env}-WafDatacenterFeedWeekly`,
        description: `Weekly trigger for the ${env} datacenter IPSet refresh`,
        schedule: events.Schedule.expression(this.getConfigValue('scheduleExpression')),
        targets: [new targets.LambdaFunction(this.feedFunction)],
      });
    }

    this.exports = {
      ...this.exports,
      feedFunctionName: this.feedFunction.functionName,
    };
  }
}

module.exports = { createWafFeedStack };
