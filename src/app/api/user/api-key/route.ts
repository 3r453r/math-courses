import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, getAuthUserFromRequest } from "@/lib/auth-utils";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";
import type { AIProvider } from "@/lib/ai/client";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const putApiKeysSchema = z.object({
  apiKeys: z.record(
    z.enum(["anthropic", "openai", "google"]),
    z.string().max(500).optional()
  ),
});

interface StoredKeyEntry {
  encrypted: string;
  iv: string;
  lastUpdated?: string;
}

type StoredKeys = Partial<Record<AIProvider, StoredKeyEntry>>;

interface ApiKeyMetadata {
  present: boolean;
  maskedSuffix: string | null;
  lastUpdated: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStoredKeys(raw: string | null | undefined): StoredKeys {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!isRecord(parsed)) return {};

  const normalized: StoredKeys = {};

  for (const [provider, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      // Legacy shape where plaintext was stored directly.
      const { encrypted, iv } = encryptApiKey(value);
      normalized[provider as AIProvider] = {
        encrypted,
        iv,
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    if (!isRecord(value)) continue;

    const encrypted = typeof value.encrypted === "string"
      ? value.encrypted
      : typeof value.ciphertext === "string"
        ? value.ciphertext
        : null;
    const iv = typeof value.iv === "string" ? value.iv : null;
    if (!encrypted || !iv) continue;

    normalized[provider as AIProvider] = {
      encrypted,
      iv,
      lastUpdated: typeof value.lastUpdated === "string" ? value.lastUpdated : undefined,
    };
  }

  return normalized;
}

function maskSuffixForEntry(entry: StoredKeyEntry): string | null {
  try {
    const decrypted = decryptApiKey(entry.encrypted, entry.iv);
    if (!decrypted) return null;
    return decrypted.slice(-4);
  } catch {
    return null;
  }
}

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedApiKeys: true },
    });

    const stored = parseStoredKeys(user?.encryptedApiKeys);
    const apiKeys: Partial<Record<AIProvider, ApiKeyMetadata>> = {};

    for (const [provider, entry] of Object.entries(stored)) {
      apiKeys[provider as AIProvider] = {
        present: true,
        maskedSuffix: maskSuffixForEntry(entry),
        lastUpdated: entry.lastUpdated ?? null,
      };
    }

    return NextResponse.json({ apiKeys });
  } catch {
    return NextResponse.json({ error: "Failed to retrieve API keys" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  try {
    const { data: body, error: parseError } = await parseBody(request, putApiKeysSchema);
    if (parseError) return parseError;

    const { apiKeys } = body as { apiKeys: Partial<Record<AIProvider, string>> };

    // Load existing stored keys
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedApiKeys: true },
    });

    const stored = parseStoredKeys(user?.encryptedApiKeys);

    // Merge new keys
    for (const [provider, key] of Object.entries(apiKeys)) {
      if (key && typeof key === "string") {
        const { encrypted, iv } = encryptApiKey(key);
        stored[provider as AIProvider] = { encrypted, iv, lastUpdated: new Date().toISOString() };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { encryptedApiKeys: JSON.stringify(stored) },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save API keys" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") as AIProvider | null;

    if (provider) {
      // Delete a single provider's key
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { encryptedApiKeys: true },
      });

      if (user?.encryptedApiKeys) {
        const stored = parseStoredKeys(user.encryptedApiKeys);
        delete stored[provider];
        await prisma.user.update({
          where: { id: userId },
          data: { encryptedApiKeys: Object.keys(stored).length > 0 ? JSON.stringify(stored) : null },
        });
      }
    } else {
      // Delete all keys
      await prisma.user.update({
        where: { id: userId },
        data: { encryptedApiKeys: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove API key(s)" }, { status: 500 });
  }
}
