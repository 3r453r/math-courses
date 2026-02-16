import { z } from "zod";
import { generateObject } from "ai";
import {
  type ProviderApiKeys,
  MODEL_REGISTRY,
  getProviderForModel,
  getModelInstance,
  getProviderOptions,
} from "./client";

/**
 * Recursively coerce a raw value to match a Zod schema.
 * Strips unknown properties, coerces types, normalizes enums, defaults missing arrays.
 * Returns the cleaned value or null if coercion fails.
 *
 * Uses `any` for schema parameter because Zod v4's `.unwrap()` / `.element`
 * return internal `$ZodType` which isn't assignable to the public `ZodType`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function coerceToSchema(raw: unknown, schema: any): unknown {
  if (raw === undefined || raw === null) {
    return raw;
  }

  // Unwrap optionals
  if (schema instanceof z.ZodOptional) {
    return coerceToSchema(raw, schema.unwrap());
  }

  // Unwrap defaults
  if (schema instanceof z.ZodDefault) {
    return coerceToSchema(raw, schema.removeDefault());
  }

  // String
  if (schema instanceof z.ZodString) {
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw);
  }

  // Number
  if (schema instanceof z.ZodNumber) {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const n = Number(raw);
      if (!isNaN(n)) return n;
    }
    return raw;
  }

  // Boolean
  if (schema instanceof z.ZodBoolean) {
    if (typeof raw === "boolean") return raw;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw;
  }

  // Enum — fuzzy match
  if (schema instanceof z.ZodEnum) {
    const options = schema.options as string[];
    if (typeof raw === "string") {
      // Exact match
      if (options.includes(raw)) return raw;
      // Case-insensitive match
      const lower = raw.toLowerCase().replace(/[\s_-]+/g, "_");
      for (const opt of options) {
        if (opt.toLowerCase().replace(/[\s_-]+/g, "_") === lower) return opt;
      }
      // Substring match (e.g. "code" → "code_block")
      for (const opt of options) {
        if (opt.includes(raw) || raw.includes(opt)) return opt;
      }
    }
    return raw;
  }

  // Array
  if (schema instanceof z.ZodArray) {
    // Anthropic jsonTool mode sometimes returns arrays as JSON strings
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          console.log(`[coerce] Parsed stringified array (${parsed.length} items)`);
          return parsed.map((item: unknown) => coerceToSchema(item, schema.element));
        }
      } catch { /* not valid JSON, fall through */ }
    }
    if (!Array.isArray(raw)) {
      // null/undefined for required arrays → empty array
      return [];
    }
    const elementSchema = schema.element;
    return raw.map((item) => coerceToSchema(item, elementSchema));
  }

  // Object — strip unknown keys, recurse into known keys
  if (schema instanceof z.ZodObject) {
    // Anthropic jsonTool mode sometimes returns objects as JSON strings
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          console.log(`[coerce] Parsed stringified object`);
          return coerceToSchema(parsed, schema);
        }
      } catch { /* not valid JSON, fall through */ }
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return raw;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shape = schema.shape as Record<string, any>;
    const result: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const value = (raw as Record<string, unknown>)[key];

      if (value === undefined || value === null) {
        // For required arrays, default to empty
        const inner = fieldSchema instanceof z.ZodOptional ? fieldSchema.unwrap() : fieldSchema;
        if (inner instanceof z.ZodArray && !(fieldSchema instanceof z.ZodOptional)) {
          result[key] = [];
        } else if (value === null && fieldSchema instanceof z.ZodOptional) {
          // Convert null → undefined for optional fields (omit from result)
          continue;
        } else if (value !== undefined) {
          result[key] = value;
        }
        continue;
      }

      result[key] = coerceToSchema(value, fieldSchema);
    }

    return result;
  }

  // Fallback — return raw
  return raw;
}

/**
 * Attempt to coerce and validate raw data against a Zod schema.
 * Returns the validated object or null.
 */
export function tryCoerceAndValidate<T>(raw: unknown, schema: z.ZodType<T>): T | null {
  try {
    const coerced = coerceToSchema(raw, schema);

    // Log coerced shape for debugging
    if (coerced && typeof coerced === "object" && !Array.isArray(coerced)) {
      const obj = coerced as Record<string, unknown>;
      const keys = Object.keys(obj);
      const sectionsVal = obj.sections;
      console.log(`[repair] Coerced object keys: [${keys.join(", ")}]`);
      console.log(`[repair] sections type=${typeof sectionsVal}, isArray=${Array.isArray(sectionsVal)}, length=${Array.isArray(sectionsVal) ? sectionsVal.length : "N/A"}`);
      if (Array.isArray(sectionsVal) && sectionsVal.length > 0) {
        const types = sectionsVal.map((s: Record<string, unknown>) => s?.type ?? "undefined").slice(0, 5);
        console.log(`[repair] First section types: [${types.join(", ")}]`);
      }
    }

    const result = schema.safeParse(coerced);
    if (result.success) {
      return result.data;
    }

    // Log Zod validation errors
    console.log(`[repair] Zod validation failed with ${result.error.issues.length} issues:`);
    for (const issue of result.error.issues) {
      console.log(`[repair]   path=[${issue.path.join(".")}] code=${issue.code} message="${issue.message}"`);
    }

    return null;
  } catch (err) {
    console.error(`[repair] tryCoerceAndValidate exception:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// Model cost tier preference for repack (cheapest first)
const REPACK_MODEL_PREFERENCE = [
  "claude-haiku-4-5-20251001",
  "gpt-5-mini",
  "gemini-2.5-flash",
  "claude-sonnet-4-5-20250929",
  "o3-mini",
  "gemini-2.5-pro",
  "claude-opus-4-6",
  "gpt-5.2",
  "gemini-3-pro-preview",
];

/**
 * Get the cheapest available model ID given the user's API keys.
 */
export function getCheapestModel(apiKeys: ProviderApiKeys): string | null {
  for (const modelId of REPACK_MODEL_PREFERENCE) {
    const entry = MODEL_REGISTRY.find((m) => m.id === modelId);
    if (!entry) continue;
    if (apiKeys[entry.provider]) return modelId;
  }
  return null;
}

/**
 * Layer 2: AI repack — use a cheap model to fix malformed JSON.
 * Returns validated object or null on failure.
 */
export async function repackWithAI<T>(
  rawText: string,
  schema: z.ZodType<T>,
  apiKeys: ProviderApiKeys,
  repackModelId: string
): Promise<T | null> {
  try {
    const modelInstance = getModelInstance(repackModelId, apiKeys);
    const provider = getProviderForModel(repackModelId);

    const prompt = `The following JSON was generated by an AI but doesn't match the required schema. Fix it to conform exactly to the schema. Preserve ALL content — only fix structural issues (wrong types, extra fields, missing fields, wrong enum values). Do not invent new content.

JSON to fix:
${rawText}`;

    const { object } = await generateObject({
      model: modelInstance,
      schema,
      prompt,
      providerOptions: provider === "anthropic"
        ? { anthropic: { structuredOutputMode: "jsonTool" as const } }
        : undefined,
    });

    return object;
  } catch (err) {
    console.error("[repack] AI repack failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
