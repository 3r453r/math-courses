import { prisma } from "@/lib/db";

const DEFAULT_RETENTION_HOURS = 24;

function getRetentionHours(): number {
  const parsed = Number(process.env.AI_LOG_SENSITIVE_TTL_HOURS ?? DEFAULT_RETENTION_HOURS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETENTION_HOURS;
  return parsed;
}

export function getSensitiveTextExpiryDate(from = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setHours(expiresAt.getHours() + getRetentionHours());
  return expiresAt;
}

export async function cleanupExpiredGenerationLogPayloads(now = new Date()): Promise<number> {
  const result = await prisma.aiGenerationLog.updateMany({
    where: {
      sensitiveTextExpiresAt: { lte: now },
      sensitiveTextRedactedAt: null,
      OR: [{ rawOutputText: { not: null } }, { promptText: { not: null } }],
    },
    data: {
      rawOutputText: null,
      promptText: null,
      sensitiveTextRedactedAt: now,
    },
  });

  return result.count;
}
