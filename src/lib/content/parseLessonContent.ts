import type { LessonContent, LessonSection } from "@/types/lesson";

/**
 * Parse lesson contentJson and normalize fields that may be absent in older
 * AI-generated content (batch-generated courses pre-dating the full schema).
 * Guarantees the returned LessonContent always has array fields initialized.
 *
 * Also fixes sections where AI used a generic `content` field instead of the
 * type-specific fields required by the renderer:
 *   - math sections missing `latex`  → converted to text sections
 *   - definition sections missing `term` or `definition` → converted to text sections
 *   - theorem sections missing `name` or `statement` → converted to text sections
 *   - visualization sections missing/invalid `vizType` → inferred from spec or dropped
 *
 * @param onSchemaWarning  Optional callback invoked (once) when any section is
 *                         normalised or dropped. Use this to show a toast to the user.
 */
export function parseLessonContent(
  contentJson: string,
  onSchemaWarning?: () => void,
): LessonContent {
  const parsed = JSON.parse(contentJson);
  const rawSections: unknown[] = Array.isArray(parsed.sections) ? parsed.sections : [];
  let hadIssues = false;
  const normalizedSections = rawSections.map((s) => {
    const result = normalizeSection(s);
    if (result !== s) hadIssues = true; // null (dropped) or converted section
    return result;
  }).filter(Boolean) as LessonSection[];

  if (hadIssues) onSchemaWarning?.();

  return {
    ...parsed,
    learningObjectives: Array.isArray(parsed.learningObjectives) ? parsed.learningObjectives : [],
    sections: normalizedSections,
    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
    workedExamples: Array.isArray(parsed.workedExamples) ? parsed.workedExamples : [],
    practiceExercises: Array.isArray(parsed.practiceExercises) ? parsed.practiceExercises : [],
  };
}

function normalizeSection(s: unknown): LessonSection | null {
  if (!s || typeof s !== "object") return null;
  const sec = s as Record<string, unknown>;

  // math section must have a non-empty latex string; fall back to text
  if (sec.type === "math") {
    if (typeof sec.latex === "string" && sec.latex.trim()) {
      return s as LessonSection;
    }
    const fallback = sec.content ?? sec.statement ?? sec.definition ?? "";
    if (typeof fallback === "string" && fallback.trim()) {
      return { type: "text", content: fallback } as LessonSection;
    }
    return null; // nothing to render
  }

  // definition section must have term + definition strings; fall back to text
  if (sec.type === "definition") {
    if (typeof sec.term === "string" && sec.term.trim() && typeof sec.definition === "string" && sec.definition.trim()) {
      return s as LessonSection;
    }
    const fallback = sec.content ?? sec.statement ?? "";
    if (typeof fallback === "string" && fallback.trim()) {
      return { type: "text", content: fallback } as LessonSection;
    }
    return null;
  }

  // theorem section must have name + statement strings; fall back to text
  if (sec.type === "theorem") {
    if (typeof sec.name === "string" && sec.name.trim() && typeof sec.statement === "string" && sec.statement.trim()) {
      return s as LessonSection;
    }
    const fallback = sec.content ?? sec.definition ?? "";
    if (typeof fallback === "string" && fallback.trim()) {
      return { type: "text", content: fallback } as LessonSection;
    }
    return null;
  }

  // visualization section must have a valid vizType; try to infer it
  if (sec.type === "visualization") {
    const validVizTypes = [
      "function_plot", "parametric_plot", "vector_field", "geometry",
      "3d_surface", "manifold", "tangent_space", "coordinate_transform",
    ];
    const vt = typeof sec.vizType === "string" ? sec.vizType : "";

    // Parse spec if it's a JSON string
    let spec = sec.spec;
    if (typeof spec === "string") {
      try { spec = JSON.parse(spec); } catch { spec = undefined; }
    }

    if (validVizTypes.includes(vt) && spec) {
      return { ...sec, spec } as LessonSection;
    }

    // Infer vizType from spec contents
    if (spec && typeof spec === "object") {
      const specObj = spec as Record<string, unknown>;
      let inferredType: string | undefined;
      if (Array.isArray(specObj.functions) && specObj.functions.length > 0) inferredType = "function_plot";
      else if (specObj.parametricSurface) inferredType = "3d_surface";
      else if (specObj.fieldFunction) inferredType = "vector_field";
      else if (Array.isArray(specObj.shapes)) inferredType = "geometry";
      else if (Array.isArray(specObj.vectors)) inferredType = "vector_field";

      if (inferredType) {
        const caption = typeof sec.caption === "string" && sec.caption.trim()
          ? sec.caption
          : typeof sec.content === "string" ? sec.content : "";
        return { ...sec, vizType: inferredType, spec, caption } as LessonSection;
      }
    }

    // No recoverable spec — render caption as text if available
    const caption = typeof sec.caption === "string" ? sec.caption : typeof sec.content === "string" ? sec.content : "";
    if (caption.trim()) return { type: "text", content: `*[Visualization: ${caption}]*` } as LessonSection;
    return null;
  }

  return s as LessonSection;
}
