import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { config } from "../config";

export const sqsClient = new SQSClient({ region: config.AWS_REGION });

export interface IngestionJob {
  attachmentId: string;
  s3Key: string;
  mimeType: string;
  userId: string;
}

export async function enqueueIngestionJob(job: IngestionJob): Promise<void> {
  if (!config.SQS_INGESTION_QUEUE_URL) {
    // Dev mode: process inline
    console.warn("[SQS] No queue URL configured - skipping enqueue");
    return;
  }
  const command = new SendMessageCommand({
    QueueUrl: config.SQS_INGESTION_QUEUE_URL,
    MessageBody: JSON.stringify(job),
    MessageGroupId: job.userId, // FIFO queue grouping by user
  });
  await sqsClient.send(command);
}
