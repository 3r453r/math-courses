import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/site-config — Get all site config (admin only)
 */
export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const configs = await prisma.siteConfig.findMany();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    return NextResponse.json(configMap);
  } catch (error) {
    console.error("Failed to get site config:", error);
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/site-config — Upsert a config key/value (admin only)
 */
export async function PATCH(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { key, value } = body as { key: string; value: string };

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    if (value === undefined || typeof value !== "string") {
      return NextResponse.json({ error: "value must be a string" }, { status: 400 });
    }

    const config = await prisma.siteConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to update site config:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
