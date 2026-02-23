#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/stacks/NetworkStack";
import { DataStack } from "../lib/stacks/DataStack";
import { StorageStack } from "../lib/stacks/StorageStack";
import { CognitoStack } from "../lib/stacks/CognitoStack";
import { ApiStack } from "../lib/stacks/ApiStack";
import { FrontendStack } from "../lib/stacks/FrontendStack";
import { ObservabilityStack } from "../lib/stacks/ObservabilityStack";

const app = new cdk.App();

const envName = app.node.tryGetContext("env") ?? "dev";
const isProd = envName === "prod";

const account = process.env.CDK_DEFAULT_ACCOUNT!;
const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";
const env = { account, region };

const prefix = `janna-${envName}`;

// Stacks (in deployment order)
const networkStack = new NetworkStack(app, `${prefix}-network`, { env, prefix, isProd });

const dataStack = new DataStack(app, `${prefix}-data`, {
  env,
  prefix,
  isProd,
  vpc: networkStack.vpc,
});

const storageStack = new StorageStack(app, `${prefix}-storage`, {
  env,
  prefix,
  isProd,
});

const cognitoStack = new CognitoStack(app, `${prefix}-cognito`, {
  env,
  prefix,
  isProd,
});

const apiStack = new ApiStack(app, `${prefix}-api`, {
  env,
  prefix,
  isProd,
  vpc: networkStack.vpc,
  dbSecret: dataStack.dbSecret,
  dbEndpoint: dataStack.dbEndpoint,
  dbName: dataStack.dbName,
  redisEndpoint: dataStack.redisEndpoint,
  attachmentsBucket: storageStack.attachmentsBucket,
  ingestionQueue: storageStack.ingestionQueue,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient,
});

const frontendStack = new FrontendStack(app, `${prefix}-frontend`, {
  env,
  prefix,
  isProd,
  apiUrl: apiStack.apiUrl,
  userPoolId: cognitoStack.userPool.userPoolId,
  userPoolClientId: cognitoStack.userPoolClient.userPoolClientId,
});

const observabilityStack = new ObservabilityStack(app, `${prefix}-observability`, {
  env,
  prefix,
  isProd,
  apiService: apiStack.ecsService,
});

// Dependencies
dataStack.addDependency(networkStack);
apiStack.addDependency(dataStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(cognitoStack);
frontendStack.addDependency(apiStack);
observabilityStack.addDependency(apiStack);

app.synth();
