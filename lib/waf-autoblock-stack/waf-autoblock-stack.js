/**
 * waf-autoblock-stack — the producer for the front-door WAF's edge-autoblock
 * IPSets.
 *
 * provision_waf.py creates edge-autoblock and the rule that reads it. Until
 * this stack existed nothing wrote to it, so the rule enforced an empty set.
 *
 * WHY THIS ONE CAN BE CDK: same reason as waf-feed-stack. The IPSets are
 * CLOUDFRONT scope and therefore us-east-1, where the LZA SCP denies
 * CloudFormation — but us-east-1 is only the region of the API call, not of any
 * resource here.
 *
 * WHY THERE IS A TABLE: a WAF IPSet holds addresses and nothing else. It cannot
 * say why an address is in it or when the ban should lapse. Both live in
 * DynamoDB, which also keeps them out of git — the reasoning names operators
 * and the investigation behind them, and this repository is public.
 *
 * WHAT IS NOT HERE: the operator families, the thresholds and the allowlist.
 * Read from SSM at run time, per account.
 */
const path = require('path');
const { Duration, RemovalPolicy } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
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
    scheduleExpression: 'cron(15 * * * ? *)',
    // Shadow by default. Flipping this is a decision about automated blocking,
    // not a deployment detail.
    enforce: 'false',
    windowHours: '24',
  },
  constructs: {
    autoblockFunction: { name: 'WafAutoblockDetector' },
    autoblockSchedule: { name: 'WafAutoblockHourly' },
    autoblockTable: { name: 'WafAutoblockHistory' },
  },
};

async function createWafAutoblockStack(scope, stackKey) {
  try {
    const primer = new StackPrimer(scope, stackKey, defaults);
    await primer.prime();
    return new WafAutoblockStack(scope, primer);
  } catch (error) {
    throw new Error(`Error creating WAF Autoblock Stack: ${error}`);
  }
}

class WafAutoblockStack extends BaseStack {
  constructor(scope, primer) {
    super(scope, primer);

    logger.info(`Creating WAF Autoblock Stack: ${this.stackId}`);

    const env = this.getDeploymentName();

    // ttl expires the row a week after the last offence. The ban itself lapses
    // sooner, on expiresAt — the row outlives it so repeat offenders can be
    // recognised as repeats rather than treated as first-timers.
    this.autoblockTable = new dynamodb.Table(this, this.getConstructId('autoblockTable'), {
      tableName: `${this.getAppName()}-${env}-waf-autoblock`,
      partitionKey: { name: 'ip', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.autoblockFunction = new lambda.Function(this, this.getConstructId('autoblockFunction'), {
      functionName: `${this.getAppName()}-${env}-WafAutoblockDetector`,
      description: `Hourly edge-autoblock producer for the ${env} front-door WAF`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'autoblock_handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'scripts', 'front-door-waf'), {
        exclude: ['__pycache__', '*.pyc', 'README.md', 'soak_report.py'],
      }),
      environment: {
        ENV_NAME: env,
        APP_NAME: this.getAppName(),
        ENFORCE: this.getConfigValue('enforce'),
        WINDOW_HOURS: this.getConfigValue('windowHours'),
      },
      // Dominated by the Insights query and RDAP lookups, not compute.
      timeout: Duration.minutes(10),
      memorySize: 512,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    });

    this.autoblockTable.grantReadWriteData(this.autoblockFunction);

    // Wildcard on purpose: the IPSet ARNs contain provider names, and an
    // enumerated policy would put that list back in git in the least obvious
    // place. Same reasoning as waf-feed-stack.
    this.autoblockFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['wafv2:ListIPSets', 'wafv2:GetIPSet', 'wafv2:UpdateIPSet'],
      resources: [`arn:aws:wafv2:${WAF_REGION}:${this.account}:global/ipset/*`],
    }));

    this.autoblockFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:StartQuery', 'logs:GetQueryResults', 'logs:StopQuery'],
      resources: [
        `arn:aws:logs:${WAF_REGION}:${this.account}:log-group:aws-waf-logs-reserve-rec-front-door-${env}:*`,
      ],
    }));

    this.autoblockFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/reserveRecPublic/${env}/frontDoorWaf/autoblock`,
      ],
    }));

    this.autoblockFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    if (this.getConfigValue('enableSchedule') !== 'false') {
      this.autoblockSchedule = new events.Rule(this, this.getConstructId('autoblockSchedule'), {
        ruleName: `${this.getAppName()}-${env}-WafAutoblockHourly`,
        description: `Hourly trigger for the ${env} edge-autoblock producer`,
        schedule: events.Schedule.expression(this.getConfigValue('scheduleExpression')),
        targets: [new targets.LambdaFunction(this.autoblockFunction)],
      });
    }

    this.exports = {
      ...this.exports,
      autoblockFunctionName: this.autoblockFunction.functionName,
      autoblockTableName: this.autoblockTable.tableName,
    };
  }
}

module.exports = { createWafAutoblockStack };
