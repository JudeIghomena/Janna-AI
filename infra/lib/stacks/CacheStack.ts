import * as cdk from 'aws-cdk-lib';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface CacheStackProps extends cdk.StackProps {
  envName: string;
  vpc: ec2.Vpc;
  cacheSecurityGroup: ec2.SecurityGroup;
}

export class CacheStack extends cdk.Stack {
  public readonly redisEndpoint: string;
  public readonly redisPort: number;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const { envName, vpc, cacheSecurityGroup } = props;
    const isProd = envName === 'prod';

    // ─── ElastiCache Subnet Group ──────────────────────────────────────────────
    const subnetGroup = new elasticache.CfnSubnetGroup(
      this,
      'RedisSubnetGroup',
      {
        cacheSubnetGroupName: `janna-redis-${envName}`,
        description: 'Janna Redis subnet group',
        subnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
      }
    );

    // ─── Replication Group (Redis) ─────────────────────────────────────────────
    const redis = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: `Janna Redis ${envName}`,
      replicationGroupId: `janna-${envName}`,
      cacheNodeType: isProd ? 'cache.r7g.large' : 'cache.t4g.micro',
      engine: 'redis',
      engineVersion: '7.1',
      numCacheClusters: isProd ? 2 : 1,
      automaticFailoverEnabled: isProd,
      multiAzEnabled: isProd,
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [cacheSecurityGroup.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      snapshotRetentionLimit: isProd ? 5 : 0,
      snapshotWindow: '05:00-06:00',
      preferredMaintenanceWindow: 'sun:06:00-sun:07:00',
    });

    redis.addDependency(subnetGroup);

    this.redisEndpoint =
      redis.attrPrimaryEndPointAddress;
    this.redisPort = 6379;

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisEndpoint,
      exportName: `janna-${envName}-redis-endpoint`,
    });
  }
}
