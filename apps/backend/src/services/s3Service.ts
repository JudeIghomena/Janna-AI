import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.AWS_REGION,
      ...(config.AWS_ENDPOINT_URL
        ? {
            endpoint: config.AWS_ENDPOINT_URL,
            forcePathStyle: true, // required for LocalStack
          }
        : {}),
    });
  }
  return s3Client;
}

export async function generatePresignedUploadUrl(
  s3Key: string,
  mimeType: string,
  maxSizeBytes: number
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: maxSizeBytes,
    ServerSideEncryption: 'AES256',
  });
  return getSignedUrl(client, command, {
    expiresIn: config.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

export async function generatePresignedDownloadUrl(
  s3Key: string
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
  });
  return getSignedUrl(client, command, {
    expiresIn: config.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

export async function getObjectStream(s3Key: string): Promise<NodeJS.ReadableStream> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
  });
  const response = await client.send(command);
  if (!response.Body) throw new Error('No body in S3 response');
  return response.Body as unknown as NodeJS.ReadableStream;
}

export async function getObjectBuffer(s3Key: string): Promise<Buffer> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
  });
  const response = await client.send(command);
  if (!response.Body) throw new Error('No body in S3 response');
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — AWS SDK Body is a union type; runtime is always AsyncIterable in Node
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(s3Key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: s3Key,
    })
  );
}

export async function objectExists(s3Key: string): Promise<boolean> {
  const client = getS3Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: s3Key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function buildS3Key(
  userId: string,
  attachmentId: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `uploads/${userId}/${attachmentId}/${sanitized}`;
}
