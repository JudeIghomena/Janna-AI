import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import { Construct } from "constructs";

interface FrontendStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { prefix, isProd, apiUrl, userPoolId, userPoolClientId } = props;

    // AWS Amplify App (connects to GitHub)
    const amplifyApp = new amplify.CfnApp(this, "AmplifyApp", {
      name: `${prefix}-web`,
      description: "Janna AI Frontend",
      buildSpec: `
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm
            - pnpm install --frozen-lockfile
        build:
          commands:
            - pnpm --filter @janna/web build
      artifacts:
        baseDirectory: apps/web/.next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - apps/web/.next/cache/**/*
  `,
      environmentVariables: [
        {
          name: "NEXT_PUBLIC_API_URL",
          value: apiUrl,
        },
        {
          name: "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
          value: userPoolId,
        },
        {
          name: "NEXT_PUBLIC_COGNITO_CLIENT_ID",
          value: userPoolClientId,
        },
        {
          name: "NEXT_PUBLIC_COGNITO_REGION",
          value: this.region,
        },
        {
          name: "NEXT_PUBLIC_APP_NAME",
          value: "Janna AI",
        },
        {
          name: "_LIVE_UPDATES",
          value: '[{"name":"Next.js version","pkg":"next-version","type":"internal","version":"14"}]',
        },
      ],
      platform: "WEB_COMPUTE",
    });

    // Branch
    new amplify.CfnBranch(this, "MainBranch", {
      appId: amplifyApp.attrAppId,
      branchName: isProd ? "main" : "develop",
      enableAutoBuild: true,
      environmentVariables: [
        {
          name: "NODE_ENV",
          value: isProd ? "production" : "development",
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, "AmplifyAppId", {
      value: amplifyApp.attrAppId,
    });
    new cdk.CfnOutput(this, "AmplifyAppUrl", {
      value: `https://${isProd ? "main" : "develop"}.${amplifyApp.attrDefaultDomain}`,
    });
  }
}
