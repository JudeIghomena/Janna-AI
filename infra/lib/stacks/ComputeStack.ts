import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EcsService } from '../constructs/EcsService';

interface ComputeStackProps extends cdk.StackProps {
  envName: string;
  vpc: ec2.Vpc;
  albSecurityGroup: ec2.SecurityGroup;
  backendSecurityGroup: ec2.SecurityGroup;
  workerSecurityGroup: ec2.SecurityGroup;
  attachmentsBucket: s3.Bucket;
  dbSecretArn: string;
  redisEndpoint: string;
  redisPort: number;
  userPoolId: string;
  userPoolClientId: string;
}

export class ComputeStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly albDnsName: string;
  public readonly ingestionQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const {
      envName,
      vpc,
      albSecurityGroup,
      backendSecurityGroup,
      workerSecurityGroup,
      attachmentsBucket,
      dbSecretArn,
      redisEndpoint,
      redisPort,
      userPoolId,
      userPoolClientId,
    } = props;

    const isProd = envName === 'prod';
    const monorepoRoot = path.resolve(__dirname, '..', '..', '..') // infra/lib/stacks → 3 up = monorepo root;

    // ─── SQS Ingestion Queue ───────────────────────────────────────────────────
    const dlq = new sqs.Queue(this, 'IngestionDLQ', {
      queueName: `janna-ingestion-dlq-${envName}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      queueName: `janna-ingestion-${envName}`,
      visibilityTimeout: cdk.Duration.minutes(10),
      retentionPeriod: cdk.Duration.days(7),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    // ─── App Secrets in Secrets Manager ────────────────────────────────────────
    const appSecrets = new secretsmanager.Secret(this, 'AppSecrets', {
      secretName: `janna/${envName}/app`,
      description: 'Janna AI application secrets',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          JWT_SECRET: '',
          OPENAI_API_KEY: '',
          ANTHROPIC_API_KEY: '',
          BRAVE_SEARCH_API_KEY: '',
          LOCAL_LLM_ENDPOINT: '',
        }),
        generateStringKey: 'JWT_SECRET',
        excludePunctuation: false,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    // ─── ECS Cluster ──────────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `janna-${envName}`,
      vpc,
      containerInsights: isProd,
    });

    // ─── ALB ──────────────────────────────────────────────────────────────────
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      loadBalancerName: `janna-${envName}`,
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      deletionProtection: isProd,
    });

    // HTTP → HTTPS redirect in prod; HTTP listener in dev
    const listener = this.alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'Janna AI',
      }),
    });

    // ─── Backend Target Group ─────────────────────────────────────────────────
    const backendTG = new elbv2.ApplicationTargetGroup(this, 'BackendTG', {
      targetGroupName: `janna-backend-${envName}`,
      vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    listener.addTargetGroups('BackendRoute', {
      targetGroups: [backendTG],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/health'])],
      priority: 10,
    });

    // ─── IAM Roles ────────────────────────────────────────────────────────────
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `janna-ecs-execution-${envName}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    });

    const taskRole = new iam.Role(this, 'TaskRole', {
      roleName: `janna-ecs-task-${envName}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant S3 access
    attachmentsBucket.grantReadWrite(taskRole);

    // Grant SQS access
    this.ingestionQueue.grantSendMessages(taskRole);
    this.ingestionQueue.grantConsumeMessages(taskRole);

    // Grant Secrets Manager access
    appSecrets.grantRead(taskRole);
    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'DbSecretRef',
      dbSecretArn
    );
    dbSecret.grantRead(taskRole);

    // Grant SSM for ECS Exec
    taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // CloudWatch X-Ray
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        resources: ['*'],
      })
    );

    // ─── Common environment ───────────────────────────────────────────────────
    const commonEnv: Record<string, string> = {
      NODE_ENV: isProd ? 'production' : 'development',
      AWS_REGION: this.region,
      // S3_BUCKET_NAME — matches the key read by apps/backend/src/config.ts
      S3_BUCKET_NAME: attachmentsBucket.bucketName,
      SQS_INGESTION_QUEUE_URL: this.ingestionQueue.queueUrl,
      REDIS_URL: `redis://${redisEndpoint}:${redisPort}`,
      COGNITO_USER_POOL_ID: userPoolId,
      COGNITO_CLIENT_ID: userPoolClientId,
      // These ARNs are used by src/bootstrap.ts to fetch secrets at startup
      APP_SECRETS_ARN: appSecrets.secretArn,
      DB_SECRET_ARN: dbSecretArn,
      PORT: '3001',
    };

    const commonSecrets: Record<string, ecs.Secret> = {
      _APP_SECRETS: ecs.Secret.fromSecretsManager(appSecrets),
    };

    // ─── Backend Service ──────────────────────────────────────────────────────
    new EcsService(this, 'Backend', {
      envName,
      cluster,
      vpc,
      serviceSecurityGroup: backendSecurityGroup,
      taskRole,
      executionRole,
      dockerfileDir: path.join(monorepoRoot, 'apps', 'backend'),
      buildContext: monorepoRoot,
      dockerfile: 'apps/backend/Dockerfile',
      containerName: 'backend',
      containerPort: 3001,
      environment: commonEnv,
      secrets: commonSecrets,
      cpu: isProd ? 1024 : 512,
      memoryLimitMiB: isProd ? 2048 : 1024,
      desiredCount: isProd ? 2 : 1,
      healthCheckPath: '/health',
      targetGroup: backendTG,
    });

    // ─── Worker Service ───────────────────────────────────────────────────────
    new EcsService(this, 'Worker', {
      envName,
      cluster,
      vpc,
      serviceSecurityGroup: workerSecurityGroup,
      taskRole,
      executionRole,
      dockerfileDir: path.join(monorepoRoot, 'apps', 'worker'),
      buildContext: monorepoRoot,
      dockerfile: 'apps/worker/Dockerfile',
      containerName: 'worker',
      containerPort: 3002, // unused but required by construct type
      environment: {
        ...commonEnv,
        PORT: '3002',
      },
      secrets: commonSecrets,
      cpu: isProd ? 1024 : 512,
      memoryLimitMiB: isProd ? 2048 : 1024,
      desiredCount: isProd ? 2 : 1,
      // No targetGroup — worker is not HTTP-facing
    });

    this.albDnsName = this.alb.loadBalancerDnsName;

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.albDnsName,
      exportName: `janna-${envName}-alb-dns`,
    });

    new cdk.CfnOutput(this, 'IngestionQueueUrl', {
      value: this.ingestionQueue.queueUrl,
      exportName: `janna-${envName}-ingestion-queue-url`,
    });
  }
}
