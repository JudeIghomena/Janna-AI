import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';

export interface EcsServiceProps {
  envName: string;
  cluster: ecs.Cluster;
  vpc: ec2.Vpc;
  serviceSecurityGroup: ec2.SecurityGroup;
  taskRole: iam.Role;
  executionRole: iam.Role;
  dockerfileDir: string;
  /** 
   * Optional: the Docker build context root. Defaults to dockerfileDir.
   * For monorepo builds, set to the monorepo root and provide dockerfile
   * as the relative path from buildContext to the Dockerfile.
   */
  buildContext?: string;
  /**
   * Path to the Dockerfile, relative to buildContext (or dockerfileDir if
   * buildContext is not set). Defaults to 'Dockerfile'.
   */
  dockerfile?: string;
  containerName: string;
  containerPort: number;
  environment: Record<string, string>;
  secrets?: Record<string, ecs.Secret>;
  cpu?: number;
  memoryLimitMiB?: number;
  desiredCount?: number;
  healthCheckPath?: string;
  // Optional ALB target group — omit for worker (no HTTP)
  targetGroup?: elbv2.ApplicationTargetGroup;
}

export class EcsService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: EcsServiceProps) {
    super(scope, id);

    const {
      envName,
      cluster,
      vpc,
      serviceSecurityGroup,
      taskRole,
      executionRole,
      dockerfileDir,
      buildContext,
      dockerfile,
      containerName,
      containerPort,
      environment,
      secrets = {},
      cpu = 512,
      memoryLimitMiB = 1024,
      desiredCount = 1,
      healthCheckPath = '/health',
      targetGroup,
    } = props;

    // The Docker build context — defaults to dockerfileDir for single-app repos.
    // For monorepos, use the monorepo root and pass the Dockerfile path via `dockerfile`.
    const imageDirectory = buildContext ?? dockerfileDir;
    const dockerfilePath = dockerfile
      ?? (buildContext ? path.relative(buildContext, path.join(dockerfileDir, 'Dockerfile')) : undefined);

    // ─── Docker image (build from local context) ───────────────────────────────
    const image = new ecr_assets.DockerImageAsset(this, 'Image', {
      directory: imageDirectory,
      ...(dockerfilePath ? { file: dockerfilePath } : {}),
      target: 'production',
      // Exclude large non-essential directories from build context
      exclude: [
        'node_modules',
        '.next',
        'cdk.out',
        '.git',
        'infra/cdk.out',
        '**/.next',
        '**/cdk.out',
      ],
    });

    // ─── Log group ────────────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/janna/${envName}/${containerName}`,
      retention: envName === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Task Definition ──────────────────────────────────────────────────────
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      taskRole,
      executionRole,
      cpu,
      memoryLimitMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const container = this.taskDefinition.addContainer(containerName, {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      environment,
      secrets,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: containerName,
        logGroup,
      }),
      healthCheck: targetGroup
        ? {
            command: [
              'CMD-SHELL',
              `wget -qO- http://localhost:${containerPort}${healthCheckPath} || exit 1`,
            ],
            interval: cdk.Duration.seconds(30),
            timeout: cdk.Duration.seconds(5),
            retries: 3,
            startPeriod: cdk.Duration.seconds(60),
          }
        : undefined,
      portMappings: targetGroup
        ? [{ containerPort, protocol: ecs.Protocol.TCP }]
        : undefined,
    });

    // ─── Fargate Service ──────────────────────────────────────────────────────
    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: this.taskDefinition,
      desiredCount,
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      enableExecuteCommand: true, // ECS Exec for debugging
      circuitBreaker: { rollback: true },
      deploymentController: { type: ecs.DeploymentControllerType.ECS },
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });

    // ─── Register with ALB target group ───────────────────────────────────────
    if (targetGroup) {
      this.service.attachToApplicationTargetGroup(targetGroup);
    }
  }
}
