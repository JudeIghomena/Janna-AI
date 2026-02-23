import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { config } from "../config";

const client = new SecretsManagerClient({ region: config.AWS_REGION });

let cachedSecrets: Record<string, string> | null = null;

export async function loadSecrets(secretId: string): Promise<Record<string, string>> {
  if (cachedSecrets) return cachedSecrets;
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);
  if (!response.SecretString) throw new Error("Secret has no string value");
  cachedSecrets = JSON.parse(response.SecretString);
  return cachedSecrets!;
}
