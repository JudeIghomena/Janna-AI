import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface DataStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
  vpc: ec2.Vpc;
}

export class DataStack extends cdk.Stack {
  readonly dbSecret: secretsmanager.ISecret;
  readonly dbEndpoint: string;
  readonly dbName: string;
  readonly redisEndpoint: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { prefix, isProd, vpc } = props;

    // ──────────────────────────────────────────
    // RDS PostgreSQL (Aurora Serverless v2 in prod, single in dev)
    // ──────────────────────────────────────────
    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: "Janna AI RDS Security Group",
    });

    const dbCredentials = rds.Credentials.fromGeneratedSecret("janna_admin");

    const dbCluster = new rds.DatabaseCluster(this, "DbCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_2,
      }),
      credentials: dbCredentials,
      defaultDatabaseName: "janna_db",
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      writer: rds.ClusterInstance.serverlessV2("writer"),
      readers: isProd
        ? [rds.ClusterInstance.serverlessV2("reader", { scaleWithWriter: true })]
        : [],
      serverlessV2MinCapacity: isProd ? 2 : 0.5,
      serverlessV2MaxCapacity: isProd ? 16 : 4,
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(isProd ? 14 : 3),
        preferredWindow: "03:00-04:00",
      },
      parameterGroup: new rds.ParameterGroup(this, "DbParamGroup", {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_16_2,
        }),
        parameters: {
          "shared_preload_libraries": "pg_stat_statements,pgvector",
        },
      }),
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.dbSecret = dbCluster.secret!;
    this.dbEndpoint = dbCluster.clusterEndpoint.hostname;
    this.dbName = "janna_db";

    // ──────────────────────────────────────────
    // Redis (ElastiCache)
    // ──────────────────────────────────────────
    const redisSg = new ec2.SecurityGroup(this, "RedisSg", {
      vpc,
      description: "Janna AI Redis Security Group",
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnetGroup", {
      description: "Janna Redis subnet group",
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
        .subnetIds,
    });

    const redis = new elasticache.CfnReplicationGroup(this, "Redis", {
      replicationGroupDescription: `${prefix} Redis`,
      cacheNodeType: isProd ? "cache.r7g.large" : "cache.t4g.micro",
      engine: "redis",
      engineVersion: "7.1",
      numCacheClusters: isProd ? 2 : 1,
      automaticFailoverEnabled: isProd,
      multiAzEnabled: isProd,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [redisSg.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: false, // Enable in prod with TLS
    });

    this.redisEndpoint = redis.attrPrimaryEndPointAddress;

    // Outputs
    new cdk.CfnOutput(this, "DbEndpoint", { value: this.dbEndpoint });
    new cdk.CfnOutput(this, "DbSecretArn", { value: this.dbSecret.secretArn });
    new cdk.CfnOutput(this, "RedisEndpoint", {
      value: this.redisEndpoint,
    });
  }
}
