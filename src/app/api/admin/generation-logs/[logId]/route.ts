import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { cleanupExpiredGenerationLogPayloads } from "@/lib/ai/generationLogRetention";

/**
 * GET /api/admin/generation-logs/[logId] — Fetch a single log with details.
 * Raw payload fields are only returned for owners or the log owner.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;

  if (!["admin", "owner"].includes(auth.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    await cleanupExpiredGenerationLogPayloads();
    const { logId } = await params;
    const log = await prisma.aiGenerationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const canViewRawPayload = auth.role === "owner" || (log.userId !== null && log.userId === auth.userId);

    return NextResponse.json({
      ...log,
      rawOutputText: canViewRawPayload ? log.rawOutputText : null,
      promptText: canViewRawPayload ? log.promptText : null,
      rawPayloadAvailable: canViewRawPayload,
    });
  } catch (error) {
    console.error("Failed to fetch generation log:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation log" },
      { status: 500 }
    );
  }
}
