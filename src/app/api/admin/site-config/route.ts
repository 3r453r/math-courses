import { prisma } from "@/lib/db";
import { requireAdmin, requireAdminFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

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

// Only these keys are allowed for site config — prevents arbitrary key creation
const ALLOWED_CONFIG_KEYS = new Set([
  "showGalleryStatsOnPricing",
]);

/**
 * PATCH /api/admin/site-config — Upsert a config key/value (admin only)
 */
export async function PATCH(request: Request) {
  const { error: authError } = await requireAdminFromRequest(request);
  if (authError) return authError;

  try {
    const siteConfigSchema = z.object({
      key: z.string().min(1).refine((k) => ALLOWED_CONFIG_KEYS.has(k), {
        message: "Unknown config key",
      }),
      value: z.string().max(2000),
    });

    const { data: body, error: parseError } = await parseBody(request, siteConfigSchema);
    if (parseError) return parseError;

    const { key, value } = body;

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
