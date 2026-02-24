/**
 * bootstrap.ts  (Worker)
 *
 * Mirrors apps/backend/src/bootstrap.ts.
 * Fetches secrets from AWS Secrets Manager before the worker process starts,
 * so DATABASE_URL and OPENAI_API_KEY etc. are available when processor.ts
 * instantiates PrismaClient and OpenAI at module level.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface DbSecret {
  username: string;
  password: string;
  host: string;
  port?: number;
  dbname?: string;
}

async function loadSecrets(): Promise<void> {
  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new SecretsManagerClient({ region });

  // ── 1. Build DATABASE_URL from the RDS secret ────────────────────────────
  const dbSecretArn = process.env.DB_SECRET_ARN;
  if (dbSecretArn && !process.env.DATABASE_URL) {
    console.log('[bootstrap] Fetching database credentials from Secrets Manager…');
    const res = await client.send(
      new GetSecretValueCommand({ SecretId: dbSecretArn })
    );
    if (!res.SecretString) throw new Error('DB secret has no SecretString');

    const s = JSON.parse(res.SecretString) as DbSecret;
    const pw = encodeURIComponent(s.password);
    const dbName = s.dbname ?? 'janna';
    const port = s.port ?? 5432;
    process.env.DATABASE_URL = `postgresql://${s.username}:${pw}@${s.host}:${port}/${dbName}`;
    console.log(`[bootstrap] DATABASE_URL configured (host=${s.host} db=${dbName})`);
  }

  // ── 2. Load app secrets (API keys, etc.) ────────────────────────────────
  const appSecretsArn = process.env.APP_SECRETS_ARN;
  if (appSecretsArn) {
    console.log('[bootstrap] Fetching application secrets from Secrets Manager…');
    const res = await client.send(
      new GetSecretValueCommand({ SecretId: appSecretsArn })
    );
    if (res.SecretString) {
      const secrets = JSON.parse(res.SecretString) as Record<string, string>;
      let loaded = 0;
      for (const [key, value] of Object.entries(secrets)) {
        if (value && !process.env[key]) {
          process.env[key] = value;
          loaded++;
        }
      }
      console.log(`[bootstrap] ${loaded} application secret(s) loaded`);
    }
  }
}

loadSecrets()
  .then(() => {
    // Require the main worker entrypoint only after env vars are set.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./index');
  })
  .catch((err: unknown) => {
    console.error('[bootstrap] Fatal: failed to initialise environment:', err);
    process.exit(1);
  });
