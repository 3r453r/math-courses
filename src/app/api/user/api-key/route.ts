import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, getAuthUserFromRequest } from "@/lib/auth-utils";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";
import type { AIProvider } from "@/lib/ai/client";

interface StoredKeyEntry {
  encrypted: string;
  iv: string;
}

type StoredKeys = Partial<Record<AIProvider, StoredKeyEntry>>;

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedApiKeys: true },
    });

    if (!user?.encryptedApiKeys) {
      return NextResponse.json({ apiKeys: {} });
    }

    const stored: StoredKeys = JSON.parse(user.encryptedApiKeys);
    const apiKeys: Partial<Record<AIProvider, string>> = {};

    for (const [provider, entry] of Object.entries(stored)) {
      if (entry?.encrypted && entry?.iv) {
        apiKeys[provider as AIProvider] = decryptApiKey(entry.encrypted, entry.iv);
      }
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
    const { apiKeys } = await request.json() as { apiKeys: Partial<Record<AIProvider, string>> };
    if (!apiKeys || typeof apiKeys !== "object") {
      return NextResponse.json({ error: "apiKeys object is required" }, { status: 400 });
    }

    // Load existing stored keys
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedApiKeys: true },
    });

    const stored: StoredKeys = user?.encryptedApiKeys
      ? JSON.parse(user.encryptedApiKeys)
      : {};

    // Merge new keys
    for (const [provider, key] of Object.entries(apiKeys)) {
      if (key && typeof key === "string") {
        const { encrypted, iv } = encryptApiKey(key);
        stored[provider as AIProvider] = { encrypted, iv };
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
        const stored: StoredKeys = JSON.parse(user.encryptedApiKeys);
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
