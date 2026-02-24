import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import pino from 'pino';
import { processAttachment, IngestionJob } from './processor';
import { z } from 'zod';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

const QUEUE_URL = process.env.SQS_INGESTION_QUEUE_URL ?? '';
const POLL_INTERVAL_MS = 5_000;
const MAX_MESSAGES = 5;
const VISIBILITY_TIMEOUT_S = 300; // 5 min per job

const jobSchema = z.object({
  attachmentId: z.string(),
  s3Key: z.string(),
  mimeType: z.string(),
  userId: z.string(),
});

const sqs = new SQSClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  ...(process.env.AWS_ENDPOINT_URL
    ? { endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true }
    : {}),
});

async function processMessage(msg: Message): Promise<void> {
  if (!msg.Body) return;

  let job: IngestionJob;
  try {
    job = jobSchema.parse(JSON.parse(msg.Body));
  } catch (err) {
    logger.error({ err, body: msg.Body }, 'Invalid job message');
    return;
  }

  try {
    await processAttachment(job);
    // Delete from queue on success
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle!,
      })
    );
    logger.info({ attachmentId: job.attachmentId }, 'Job completed, message deleted');
  } catch (err) {
    logger.error({ err, attachmentId: job.attachmentId }, 'Job failed, message will be retried');
    // Do NOT delete — SQS will re-deliver after visibility timeout
  }
}

async function poll(): Promise<void> {
  try {
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: MAX_MESSAGES,
        VisibilityTimeout: VISIBILITY_TIMEOUT_S,
        WaitTimeSeconds: 20, // long polling
      })
    );

    const messages = response.Messages ?? [];
    if (messages.length === 0) return;

    logger.info({ count: messages.length }, 'Received messages');

    // Process concurrently
    await Promise.allSettled(messages.map(processMessage));
  } catch (err) {
    logger.error({ err }, 'Poll error');
  }
}

async function main(): Promise<void> {
  if (!QUEUE_URL) {
    logger.warn('SQS_INGESTION_QUEUE_URL not set — worker will idle');
    // Keep process alive for dev
    await new Promise(() => {});
    return;
  }

  logger.info({ queueUrl: QUEUE_URL }, 'Ingestion worker started');

  // Graceful shutdown
  let running = true;
  const shutdown = () => {
    logger.info('Shutting down worker');
    running = false;
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (running) {
    await poll();
    if (running) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  logger.info('Worker stopped');
}

main().catch((err) => {
  logger.fatal(err, 'Fatal worker error');
  process.exit(1);
});
