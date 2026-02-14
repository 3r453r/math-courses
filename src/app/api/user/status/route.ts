import { getAuthUserAnyStatus } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/user/status
 * Returns the current user's access status and role.
 * Accessible to any authenticated user (including pending).
 */
export async function GET() {
  const { userId, role, accessStatus, error } = await getAuthUserAnyStatus();
  if (error) return error;

  return NextResponse.json({ userId, role, accessStatus });
}
