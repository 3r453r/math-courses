import { requireAdmin } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SCHEMA_FILE_MAP: Record<string, string> = {
  courseStructureSchema: "src/lib/ai/schemas/courseSchema.ts",
  lessonContentSchema: "src/lib/ai/schemas/lessonSchema.ts",
  lessonWithQuizSchema: "src/lib/ai/schemas/lessonWithQuizSchema.ts",
  quizSchema: "src/lib/ai/schemas/quizSchema.ts",
  diagnosticSchema: "src/lib/ai/schemas/diagnosticSchema.ts",
  triviaSchema: "src/lib/ai/schemas/triviaSchema.ts",
  completionSummarySchema: "src/lib/ai/schemas/completionSummarySchema.ts",
};

/**
 * GET /api/admin/generation-logs/schema-source?name=lessonContentSchema
 * Returns the TypeScript source of the named Zod schema file.
 */
export async function GET(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");

    if (!name || !SCHEMA_FILE_MAP[name]) {
      return NextResponse.json(
        { error: "Unknown schema name", available: Object.keys(SCHEMA_FILE_MAP) },
        { status: 400 }
      );
    }

    const relativePath = SCHEMA_FILE_MAP[name];
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, "utf-8");

    return NextResponse.json({ name, filePath: relativePath, source });
  } catch (error) {
    console.error("Failed to read schema source:", error);
    return NextResponse.json(
      { error: "Failed to read schema source" },
      { status: 500 }
    );
  }
}
