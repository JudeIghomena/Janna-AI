import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  envName: string;
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecret: secretsmanager.ISecret;
  public readonly dbEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { envName, vpc, dbSecurityGroup } = props;
    const isProd = envName === 'prod';

    // ─── Aurora Postgres Serverless V2 ─────────────────────────────────────────
    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      clusterIdentifier: `janna-${envName}`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('janna_admin', {
        secretName: `janna/${envName}/db-credentials`,
      }),
      defaultDatabaseName: 'janna_db',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      serverlessV2MinCapacity: isProd ? 2 : 0.5,
      serverlessV2MaxCapacity: isProd ? 32 : 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: isProd
        ? [rds.ClusterInstance.serverlessV2('reader', { scaleWithWriter: true })]
        : [],
      backup: {
        retention: cdk.Duration.days(isProd ? 14 : 1),
        preferredWindow: '03:00-04:00',
      },
      deletionProtection: isProd,
      storageEncrypted: true,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: isProd ? 90 : 7,
    });

    this.dbSecret = this.cluster.secret!;
    this.dbEndpoint = this.cluster.clusterEndpoint.hostname;

    // ─── Enable pgvector extension via custom resource ─────────────────────────
    // Note: pgvector must be installed via `CREATE EXTENSION IF NOT EXISTS vector`
    // on first migration. Prisma migrate handles this.

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.dbEndpoint,
      exportName: `janna-${envName}-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
      exportName: `janna-${envName}-db-secret`,
    });
  }
}
