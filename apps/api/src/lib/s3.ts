import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

export const s3 = new S3Client({ region: config.AWS_REGION });

export async function generatePresignedUploadUrl(
  s3Key: string,
  contentType: string,
  sizeBytes: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    ServerSideEncryption: "AES256",
  });
  return getSignedUrl(s3, command, { expiresIn: config.S3_PRESIGN_EXPIRY_SECONDS });
}

export async function generatePresignedDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
  });
  return getSignedUrl(s3, command, { expiresIn: config.S3_PRESIGN_EXPIRY_SECONDS });
}

export async function getS3Object(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
  });
  const response = await s3.send(command);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: s3Key,
  });
  await s3.send(command);
}

export function buildS3Key(userId: string, filename: string): string {
  const timestamp = Date.now();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${userId}/${timestamp}_${safe}`;
}
