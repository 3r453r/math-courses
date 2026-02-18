import { prisma } from "@/lib/db";
import { requireOwner, requireOwnerFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/access-codes — List all access codes with usage stats (admin only)
 */
export async function GET() {
  const { error: authError } = await requireOwner();
  if (authError) return authError;

  try {
    const codes = await prisma.accessCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return NextResponse.json(codes);
  } catch (error) {
    console.error("Failed to list access codes:", error);
    return NextResponse.json({ error: "Failed to list access codes" }, { status: 500 });
  }
}

function generateCode(): string {
  // Generate a readable 8-character uppercase alphanumeric code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 for readability
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * POST /api/access-codes — Generate access code(s) (admin only)
 * Body: { count?: number, type?: string, maxUses?: number, expiresAt?: string }
 */
export async function POST(request: Request) {
  const { userId, error: authError } = await requireOwnerFromRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const count = Math.min(body.count ?? 1, 100);
    const type = body.type ?? "general";
    const maxUses = body.maxUses ?? 1;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = await prisma.accessCode.create({
        data: {
          code: generateCode(),
          type,
          maxUses,
          expiresAt,
          createdBy: userId,
        },
      });
      codes.push(code);
    }

    return NextResponse.json(codes, { status: 201 });
  } catch (error) {
    console.error("Failed to generate access codes:", error);
    return NextResponse.json({ error: "Failed to generate access codes" }, { status: 500 });
  }
}
