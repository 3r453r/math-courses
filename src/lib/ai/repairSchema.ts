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
 * Repair a JSON string that has unescaped double quotes inside string values.
 * This happens when Anthropic's jsonTool mode returns array/object fields as
 * stringified JSON with single-level escaping instead of double-level escaping.
 *
 * Uses a state machine with two-level look-ahead: for any `"` inside a string,
 * checks whether it could be a structural closing quote by verifying not just
 * the immediate next character, but also whether what follows forms valid JSON
 * continuation (e.g., `"," ` must be followed by `"`, `{`, `[`, digit, etc.).
 */
export function repairJsonString(str: string): string {
  const result: string[] = [];
  let inString = false;
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    if (inString) {
      if (ch === "\\" && i + 1 < str.length) {
        // Escape sequence — copy both characters
        result.push(ch, str[i + 1]);
        i += 2;
        continue;
      }
      if (ch === '"') {
        // Is this a structural closing quote or an unescaped content quote?
        // Two-level look-ahead: check next significant char AND what follows it
        if (isStructuralClose(str, i)) {
          inString = false;
          result.push(ch);
        } else {
          // Content quote — escape it
          result.push("\\", '"');
        }
        i++;
        continue;
      }
      result.push(ch);
      i++;
    } else {
      if (ch === '"') {
        inString = true;
      }
      result.push(ch);
      i++;
    }
  }

  return result.join("");
}

/** Skip whitespace in str starting from position j, return index of next non-ws char */
function skipWs(str: string, j: number): number {
  while (j < str.length && " \t\n\r".includes(str[j])) j++;
  return j;
}

/** Check if a char could begin a JSON value (string, number, object, array, boolean, null) */
function isJsonValueStart(ch: string): boolean {
  return ch === '"' || ch === '{' || ch === '[' ||
    ch === 't' || ch === 'f' || ch === 'n' ||
    ch === '-' || (ch >= '0' && ch <= '9');
}

/**
 * Determine if the `"` at position i is a structural JSON closing quote.
 * Checks that what follows forms valid JSON continuation, not just the immediate char.
 */
function isStructuralClose(str: string, i: number): boolean {
  let j = skipWs(str, i + 1);
  if (j >= str.length) return true; // EOF — structural

  const next = str[j];

  // `"}` or `"]` — always structural (end of object/array)
  if (next === "}" || next === "]") return true;

  // `":` — structural if followed by a valid JSON value
  if (next === ":") {
    const k = skipWs(str, j + 1);
    if (k >= str.length) return false; // colon at EOF — broken, treat as content
    return isJsonValueStart(str[k]);
  }

  // `",` — structural if what follows the comma is a valid JSON continuation
  // (could be another key-value pair starting with `"`, or a value in an array)
  if (next === ",") {
    const k = skipWs(str, j + 1);
    if (k >= str.length) return false; // comma at EOF — broken, treat as content
    // After comma in an object: next should be `"` (key) or `}` (trailing comma)
    // After comma in an array: next should be a value start or `]`
    return isJsonValueStart(str[k]) || str[k] === "]" || str[k] === "}";
  }

  // Anything else — not structural (content quote)
  return false;
}

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
      let parsed: unknown = undefined;
      let parseOk = false;
      try {
        parsed = JSON.parse(raw);
        parseOk = true;
      } catch (e) {
        console.log(`[coerce] String failed JSON.parse for array field (length=${raw.length}), trying repair. Error: ${e instanceof Error ? e.message : e}`);
        // Try repairing unescaped quotes in inner JSON strings
        try {
          const repaired = repairJsonString(raw);
          parsed = JSON.parse(repaired);
          parseOk = true;
          console.log(`[coerce] Repair succeeded for stringified array`);
        } catch (e2) {
          console.log(`[coerce] WARNING: Repair also failed. Error: ${e2 instanceof Error ? e2.message : e2}, preview: ${raw.substring(0, 500)}`);
        }
      }
      if (parseOk) {
        if (Array.isArray(parsed)) {
          console.log(`[coerce] Parsed stringified array (${parsed.length} items)`);
          return parsed.map((item: unknown) => coerceToSchema(item, schema.element));
        } else {
          console.log(`[coerce] WARNING: String parsed to non-array type=${typeof parsed}. Length=${raw.length}, preview: ${raw.substring(0, 500)}`);
        }
      }
    }
    if (!Array.isArray(raw)) {
      console.log(`[coerce] WARNING: Non-array value defaulting to []. Actual type=${typeof raw}, constructor=${(raw as object)?.constructor?.name}, preview=${typeof raw === "string" ? raw.substring(0, 200) : JSON.stringify(raw)?.substring(0, 200)}`);
      return [];
    }
    const elementSchema = schema.element;
    return raw.map((item) => coerceToSchema(item, elementSchema));
  }

  // Object — strip unknown keys, recurse into known keys
  if (schema instanceof z.ZodObject) {
    // Anthropic jsonTool mode sometimes returns objects as JSON strings
    if (typeof raw === "string") {
      let parsed: unknown = undefined;
      let parseOk = false;
      try {
        parsed = JSON.parse(raw);
        parseOk = true;
      } catch {
        // Try repairing unescaped quotes
        try {
          parsed = JSON.parse(repairJsonString(raw));
          parseOk = true;
          console.log(`[coerce] Repair succeeded for stringified object`);
        } catch { /* truly broken */ }
      }
      if (parseOk && typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        console.log(`[coerce] Parsed stringified object`);
        return coerceToSchema(parsed, schema);
      }
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
          console.log(`[coerce] WARNING: Required array field "${key}" is ${value === null ? "null" : "undefined"}, defaulting to []. Available keys: [${Object.keys(raw as object).join(", ")}]`);
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
export function tryCoerceAndValidate<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  zodErrorCollector?: { issues: z.ZodIssue[] },
): T | null {
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

    // Collect Zod errors for logging if collector provided
    if (zodErrorCollector) {
      zodErrorCollector.issues = result.error.issues;
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
