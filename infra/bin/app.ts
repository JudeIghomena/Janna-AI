#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/NetworkStack';
import { DatabaseStack } from '../lib/stacks/DatabaseStack';
import { CacheStack } from '../lib/stacks/CacheStack';
import { StorageStack } from '../lib/stacks/StorageStack';
import { CognitoStack } from '../lib/stacks/CognitoStack';
import { ComputeStack } from '../lib/stacks/ComputeStack';
import { FrontendStack } from '../lib/stacks/FrontendStack';

const app = new cdk.App();

// ─── Read environment from context ────────────────────────────────────────────
// Usage: cdk deploy --context envName=dev
//        cdk deploy --context envName=prod
const envName = app.node.tryGetContext('envName') ?? 'dev';

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const stackPrefix = `Janna-${envName.charAt(0).toUpperCase()}${envName.slice(1)}`;
const tags = {
  Project: 'JannaAI',
  Environment: envName,
  ManagedBy: 'CDK',
};

// ─── Network ───────────────────────────────────────────────────────────────────
const network = new NetworkStack(app, `${stackPrefix}-Network`, {
  env,
  tags,
  envName,
});

// ─── Database ─────────────────────────────────────────────────────────────────
const database = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  tags,
  envName,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
});
database.addDependency(network);

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = new CacheStack(app, `${stackPrefix}-Cache`, {
  env,
  tags,
  envName,
  vpc: network.vpc,
  cacheSecurityGroup: network.cacheSecurityGroup,
});
cache.addDependency(network);

// ─── Storage ──────────────────────────────────────────────────────────────────
const storage = new StorageStack(app, `${stackPrefix}-Storage`, {
  env,
  tags,
  envName,
});

// ─── Cognito ──────────────────────────────────────────────────────────────────
const cognito = new CognitoStack(app, `${stackPrefix}-Cognito`, {
  env,
  tags,
  envName,
});

// ─── Compute ──────────────────────────────────────────────────────────────────
const compute = new ComputeStack(app, `${stackPrefix}-Compute`, {
  env,
  tags,
  envName,
  vpc: network.vpc,
  albSecurityGroup: network.albSecurityGroup,
  // NetworkStack uses a single ecsSecurityGroup for all ECS tasks
  backendSecurityGroup: network.ecsSecurityGroup,
  workerSecurityGroup: network.ecsSecurityGroup,
  attachmentsBucket: storage.attachmentsBucket,
  // DatabaseStack exposes dbSecret (ISecret); pass the ARN string
  dbSecretArn: database.dbSecret.secretArn,
  redisEndpoint: cache.redisEndpoint,
  redisPort: cache.redisPort,
  userPoolId: cognito.userPoolId,
  userPoolClientId: cognito.userPoolClientId,
});
compute.addDependency(network);
compute.addDependency(database);
compute.addDependency(cache);
compute.addDependency(storage);
compute.addDependency(cognito);

// ─── Frontend ─────────────────────────────────────────────────────────────────
const frontend = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  // CloudFront must be in us-east-1 for ACM certificates
  env: { account: env.account, region: 'us-east-1' },
  crossRegionReferences: true,
  tags,
  envName,
  albDnsName: compute.albDnsName,
});
frontend.addDependency(compute);

app.synth();
