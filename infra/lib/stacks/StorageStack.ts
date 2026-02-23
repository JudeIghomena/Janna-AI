import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

interface StorageStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
}

export class StorageStack extends cdk.Stack {
  readonly attachmentsBucket: s3.Bucket;
  readonly ingestionQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { prefix, isProd } = props;

    // ──────────────────────────────────────────
    // S3 - Attachments (private)
    // ──────────────────────────────────────────
    this.attachmentsBucket = new s3.Bucket(this, "AttachmentsBucket", {
      bucketName: `${prefix}-attachments-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: "delete-incomplete-multipart",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        ...(isProd
          ? [
              {
                id: "archive-old",
                transitions: [
                  {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: cdk.Duration.days(90),
                  },
                ],
              },
            ]
          : []),
      ],
    });

    // ──────────────────────────────────────────
    // SQS - Ingestion Queue (FIFO for ordered processing per user)
    // ──────────────────────────────────────────
    const dlq = new sqs.Queue(this, "IngestionDlq", {
      queueName: `${prefix}-ingestion-dlq.fifo`,
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.ingestionQueue = new sqs.Queue(this, "IngestionQueue", {
      queueName: `${prefix}-ingestion.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    // Outputs
    new cdk.CfnOutput(this, "BucketName", {
      value: this.attachmentsBucket.bucketName,
    });
    new cdk.CfnOutput(this, "QueueUrl", {
      value: this.ingestionQueue.queueUrl,
    });
  }
}
