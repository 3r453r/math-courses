import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/generation-logs/[logId] — Fetch a single log with full details
 * Includes rawOutputText and promptText (excluded from list view).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { logId } = await params;
    const log = await prisma.aiGenerationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error("Failed to fetch generation log:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation log" },
      { status: 500 }
    );
  }
}
