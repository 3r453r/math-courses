import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the validated data or a 400 NextResponse with validation errors.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ data: z.infer<S>; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return {
      data: null,
      error: NextResponse.json(
        { error: "Validation error", details: issues },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}

// ── Shared field schemas ─────────────────────────────────────

/** Bounded string — prevents megabyte-sized payloads in text fields */
export const boundedString = (max = 2000) => z.string().max(max);

/** CUID-shaped ID */
export const cuidId = z.string().min(1).max(50);

/** Model ID */
export const modelId = z.string().min(1).max(100);

/** Difficulty enum */
export const difficulty = z.enum(["beginner", "intermediate", "advanced"]);

/** Language code */
export const languageCode = z.string().min(2).max(10);

/** Star rating */
export const starRating = z.number().int().min(1).max(5);

/** Generic bounded array */
export const boundedArray = <T extends z.ZodTypeAny>(schema: T, max = 200) =>
  z.array(schema).max(max);
