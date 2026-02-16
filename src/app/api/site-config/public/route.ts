import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Only these keys are exposed publicly
const PUBLIC_KEYS = ["showGalleryStatsOnPricing"];

/**
 * GET /api/site-config/public — Public config (no auth)
 * Returns only whitelisted config keys.
 */
export async function GET() {
  try {
    const configs = await prisma.siteConfig.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json(configMap);
  } catch (error) {
    console.error("Failed to get public config:", error);
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 });
  }
}
