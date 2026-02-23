// ============================================================
// Janna AI - API Configuration
// ============================================================
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // AWS
  AWS_REGION: z.string().default("us-east-1"),
  S3_BUCKET_NAME: z.string().min(1),
  S3_PRESIGN_EXPIRY_SECONDS: z.coerce.number().default(3600),
  SQS_INGESTION_QUEUE_URL: z.string().optional(),

  // Cognito
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_CLIENT_ID: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),

  // Local vLLM
  LOCAL_VLLM_BASE_URL: z.string().optional(),
  LOCAL_VLLM_API_KEY: z.string().optional(),
  LOCAL_VLLM_MODEL: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().default(60),
  RATE_LIMIT_TOKENS_PER_DAY: z.coerce.number().default(1_000_000),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
export type Config = typeof config;
