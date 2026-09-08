import crypto from "node:crypto";

function secretHex(bytes = 32): string {
  // 32 bytes = 64 hex characters
  return crypto.randomBytes(bytes).toString("hex");
}

function encryptionKeyBase64Url(bytes = 32): string {
  // 32 bytes = 256-bit key, encoded safely for .env files
  return crypto.randomBytes(bytes).toString("base64url");
}

const secrets: Record<string, string> = {
  ACCESS_TOKEN_SECRET: secretHex(),
  REFRESH_TOKEN_SECRET: secretHex(),
  PASSWORD_RESET_TOKEN_SECRET: secretHex(),
  TOKEN_ENCRYPTION_KEY: encryptionKeyBase64Url(),
  AI_SAFETY_IDENTIFIER_SECRET: encryptionKeyBase64Url(),
};

for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
