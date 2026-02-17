import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-utils";
import { cleanupExpiredGenerationLogPayloads } from "@/lib/ai/generationLogRetention";

/**
 * POST /api/admin/generation-logs/cleanup
 * Owner-only endpoint to redact expired sensitive AI payloads.
 */
export async function POST() {
  const { error } = await requireOwner();
  if (error) return error;

  try {
    const redacted = await cleanupExpiredGenerationLogPayloads();
    return NextResponse.json({ redacted });
  } catch (error) {
    console.error("Failed to cleanup generation logs:", error);
    return NextResponse.json(
      { error: "Failed to cleanup generation logs" },
      { status: 500 }
    );
  }
}
