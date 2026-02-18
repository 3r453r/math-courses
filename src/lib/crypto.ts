import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function deriveKey(): Buffer {
  // Prefer dedicated encryption key; fall back to AUTH_SECRET for backward compat.
  // Using a separate key allows AUTH_SECRET rotation without breaking encrypted data.
  const secret = process.env.API_KEY_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("API_KEY_ENCRYPTION_KEY or AUTH_SECRET is required for API key encryption");
  return scryptSync(secret, "api-key-encryption-v1", KEY_LENGTH);
}

export function encryptApiKey(plaintext: string): { encrypted: string; iv: string } {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptApiKey(encrypted: string, iv: string): string {
  const key = deriveKey();
  const ivBuf = Buffer.from(iv, "base64");
  const data = Buffer.from(encrypted, "base64");
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(0, data.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, ivBuf, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
