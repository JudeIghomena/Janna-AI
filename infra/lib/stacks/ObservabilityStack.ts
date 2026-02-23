import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";

interface ObservabilityStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
  apiService: ecs.FargateService;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { prefix, isProd, apiService } = props;

    // SNS Alert Topic
    const alertTopic = new sns.Topic(this, "AlertTopic", {
      topicName: `${prefix}-alerts`,
      displayName: "Janna AI Alerts",
    });

    // ──────────────────────────────────────────
    // Dashboard
    // ──────────────────────────────────────────
    const dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `${prefix}-dashboard`,
    });

    const cpuMetric = apiService.metricCpuUtilization({
      period: cdk.Duration.minutes(1),
      statistic: "Average",
    });

    const memMetric = apiService.metricMemoryUtilization({
      period: cdk.Duration.minutes(1),
      statistic: "Average",
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "ECS CPU/Memory",
        left: [cpuMetric],
        right: [memMetric],
        width: 12,
      }),
      new cloudwatch.SingleValueWidget({
        title: "Running Tasks",
        metrics: [
          new cloudwatch.Metric({
            namespace: "ECS/ContainerInsights",
            metricName: "RunningTaskCount",
            dimensionsMap: {
              ServiceName: apiService.serviceName,
              ClusterName: apiService.cluster.clusterName,
            },
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 6,
      })
    );

    // ──────────────────────────────────────────
    // Alarms
    // ──────────────────────────────────────────
    const cpuAlarm = new cloudwatch.Alarm(this, "CpuAlarm", {
      alarmName: `${prefix}-high-cpu`,
      metric: cpuMetric,
      threshold: 80,
      evaluationPeriods: 2,
      alarmDescription: "API CPU utilization > 80%",
    });

    const memAlarm = new cloudwatch.Alarm(this, "MemAlarm", {
      alarmName: `${prefix}-high-memory`,
      metric: memMetric,
      threshold: 85,
      evaluationPeriods: 2,
      alarmDescription: "API Memory utilization > 85%",
    });

    if (isProd) {
      cpuAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
      memAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
    }

    // Outputs
    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${prefix}-dashboard`,
    });
  }
}
