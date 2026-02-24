import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { config } from '../config';

let secretsClient: SecretsManagerClient | null = null;

function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({
      region: config.AWS_REGION,
      ...(config.AWS_ENDPOINT_URL
        ? { endpoint: config.AWS_ENDPOINT_URL }
        : {}),
    });
  }
  return secretsClient;
}

let cachedSecrets: Record<string, string> | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export async function getSecrets(): Promise<Record<string, string>> {
  // In development, use env vars directly
  if (config.NODE_ENV === 'development' || !config.SECRETS_MANAGER_SECRET_ID) {
    return {
      OPENAI_API_KEY: config.OPENAI_API_KEY ?? '',
      ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY ?? '',
      LOCAL_MODEL_API_KEY: config.LOCAL_MODEL_API_KEY ?? '',
    };
  }

  // Return cached if still valid
  if (cachedSecrets && Date.now() < cacheExpiry) {
    return cachedSecrets;
  }

  try {
    const client = getSecretsClient();
    const command = new GetSecretValueCommand({
      SecretId: config.SECRETS_MANAGER_SECRET_ID,
    });
    const response = await client.send(command);

    if (response.SecretString) {
      cachedSecrets = JSON.parse(response.SecretString) as Record<
        string,
        string
      >;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return cachedSecrets;
    }
  } catch (err) {
    console.error('[Secrets] Failed to fetch from Secrets Manager:', err);
  }

  // Fallback to env vars
  return {
    OPENAI_API_KEY: config.OPENAI_API_KEY ?? '',
    ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY ?? '',
    LOCAL_MODEL_API_KEY: config.LOCAL_MODEL_API_KEY ?? '',
  };
}
