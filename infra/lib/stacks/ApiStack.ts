import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

interface ApiStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
  vpc: ec2.Vpc;
  dbSecret: secretsmanager.ISecret;
  dbEndpoint: string;
  dbName: string;
  redisEndpoint: string;
  attachmentsBucket: s3.Bucket;
  ingestionQueue: sqs.Queue;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends cdk.Stack {
  readonly apiUrl: string;
  readonly ecsService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      prefix,
      isProd,
      vpc,
      dbSecret,
      dbEndpoint,
      dbName,
      redisEndpoint,
      attachmentsBucket,
      ingestionQueue,
      userPool,
      userPoolClient,
    } = props;

    // ──────────────────────────────────────────
    // OpenAI API Key Secret
    // ──────────────────────────────────────────
    const openAiSecret = new secretsmanager.Secret(this, "OpenAiSecret", {
      secretName: `${prefix}/openai-api-key`,
      description: "OpenAI API Key for Janna AI",
    });

    // ──────────────────────────────────────────
    // ECS Cluster
    // ──────────────────────────────────────────
    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: `${prefix}-cluster`,
      vpc,
      containerInsights: true,
    });

    // ──────────────────────────────────────────
    // Task Role
    // ──────────────────────────────────────────
    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      roleName: `${prefix}-api-task-role`,
    });

    // Grant permissions
    attachmentsBucket.grantReadWrite(taskRole);
    ingestionQueue.grantSendMessages(taskRole);
    ingestionQueue.grantConsumeMessages(taskRole);
    dbSecret.grantRead(taskRole);
    openAiSecret.grantRead(taskRole);

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
        resources: ["*"],
      })
    );

    // ──────────────────────────────────────────
    // Log Group
    // ──────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/janna/${prefix}/api`,
      retention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ──────────────────────────────────────────
    // Task Definition
    // ──────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, "ApiTask", {
      memoryLimitMiB: isProd ? 2048 : 512,
      cpu: isProd ? 1024 : 256,
      taskRole,
    });

    const apiImage = ecs.ContainerImage.fromAsset(
      path.join(__dirname, "../../../apps/api"),
      { platform: ecr_assets.Platform.LINUX_AMD64 }
    );

    const container = taskDef.addContainer("api", {
      image: apiImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "api",
        logGroup,
      }),
      environment: {
        NODE_ENV: isProd ? "production" : "development",
        API_PORT: "3001",
        API_HOST: "0.0.0.0",
        LOG_LEVEL: isProd ? "info" : "debug",
        AWS_REGION: this.region,
        S3_BUCKET_NAME: attachmentsBucket.bucketName,
        SQS_INGESTION_QUEUE_URL: ingestionQueue.queueUrl,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        DB_ENDPOINT: dbEndpoint,
        DB_NAME: dbName,
      },
      secrets: {
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(openAiSecret),
        DB_SECRET_ARN: ecs.Secret.fromSecretsManager(dbSecret, "password"),
      },
      portMappings: [{ containerPort: 3001 }],
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ──────────────────────────────────────────
    // Security Group
    // ──────────────────────────────────────────
    const apiSg = new ec2.SecurityGroup(this, "ApiSg", {
      vpc,
      description: "Janna AI API security group",
    });

    // ──────────────────────────────────────────
    // Fargate Service
    // ──────────────────────────────────────────
    this.ecsService = new ecs.FargateService(this, "ApiService", {
      cluster,
      taskDefinition: taskDef,
      serviceName: `${prefix}-api`,
      desiredCount: isProd ? 2 : 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [apiSg],
      enableExecuteCommand: !isProd,
      circuitBreaker: { rollback: true },
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
    });

    // Auto-scaling
    const scaling = this.ecsService.autoScaleTaskCount({
      minCapacity: isProd ? 2 : 1,
      maxCapacity: isProd ? 10 : 2,
    });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    scaling.scaleOnRequestCount("RequestScaling", {
      requestsPerTarget: 1000,
      targetGroup: new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
        vpc,
        port: 3001,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: "/health",
          interval: cdk.Duration.seconds(30),
        },
      }),
    });

    // ──────────────────────────────────────────
    // Application Load Balancer
    // ──────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      loadBalancerName: `${prefix}-alb`,
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "ApiTargetGroup", {
      vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: "200",
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    targetGroup.addTarget(this.ecsService);

    const listener = alb.addListener("Listener", {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    this.apiUrl = `http://${alb.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", { value: this.apiUrl });
    new cdk.CfnOutput(this, "OpenAiSecretArn", { value: openAiSecret.secretArn });
  }
}
