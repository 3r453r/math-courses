import { createHash } from "crypto";

const INLINE_MAX_CHARS = 800;
const LONG_BLOCK_MIN_CHARS = 1200;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildRedactionMarker(label: string, value: string): string {
  return `[REDACTED:${label}:sha256=${sha256(value)}:chars=${value.length}]`;
}

export function sanitizeTextForPersistence(value: string | null | undefined, label: string): {
  sanitized: string | null;
  redacted: boolean;
  hash: string | null;
} {
  if (!value) {
    return { sanitized: null, redacted: false, hash: null };
  }

  const hash = sha256(value);
  if (value.length <= INLINE_MAX_CHARS) {
    return { sanitized: value, redacted: false, hash };
  }

  return {
    sanitized: buildRedactionMarker(label, value),
    redacted: true,
    hash,
  };
}

export function sanitizePromptForPersistence(prompt: string | null | undefined): {
  sanitized: string | null;
  redacted: boolean;
  hash: string | null;
} {
  if (!prompt) {
    return { sanitized: null, redacted: false, hash: null };
  }

  let redacted = false;
  let output = prompt;

  output = output.replace(
    /COURSE CONTEXT DOCUMENT:\n([\s\S]*?)(\n\n[A-Z][A-Z _-]+:|$)/gi,
    (_, contextBlock: string, nextSection: string) => {
      redacted = true;
      return `COURSE CONTEXT DOCUMENT:\n${buildRedactionMarker("contextDoc", contextBlock)}${nextSection}`;
    }
  );

  output = output.replace(
    /(IMPORTANT - WEAK AREAS FEEDBACK:\n)([\s\S]*?)(\n\n[A-Z][A-Z _-]+:|$)/gi,
    (_, intro: string, userBlock: string, nextSection: string) => {
      redacted = true;
      return `${intro}${buildRedactionMarker("userFeedback", userBlock)}${nextSection}`;
    }
  );

  if (output.length > LONG_BLOCK_MIN_CHARS) {
    redacted = true;
    output = buildRedactionMarker("prompt", output);
  }

  return {
    sanitized: output,
    redacted,
    hash: sha256(prompt),
  };
}
