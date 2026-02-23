import { CognitoJwtVerifier } from "aws-jwt-verify";
import { config } from "../config";

export const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: config.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: config.COGNITO_CLIENT_ID,
});

export interface CognitoPayload {
  sub: string;
  email?: string;
  "cognito:groups"?: string[];
  username?: string;
}

export async function verifyCognitoToken(token: string): Promise<CognitoPayload> {
  const payload = await cognitoVerifier.verify(token);
  return payload as unknown as CognitoPayload;
}
