export const maxDuration = 120;

import { generateObject, NoObjectGeneratedError } from "ai";
import {
  getApiKeysFromRequest,
  getModelInstance,
  getProviderOptions,
  hasAnyApiKey,
  createRepairFunction,
  createRepairTracker,
} from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  getCheapestModel,
  tryCoerceAndValidate,
  unwrapParameter,
} from "@/lib/ai/repairSchema";
import { validateAndRepairVisualizations } from "@/lib/content/vizValidation";
import { parseLessonContent } from "@/lib/content/parseLessonContent";
import { parseBody } from "@/lib/api-validation";
import { buildVizRegenerationPrompt } from "@/lib/ai/prompts/vizRegeneration";
import { z } from "zod";

const generateVizBodySchema = z.object({
  lessonId: z.string().min(1).max(50),
  courseId: z.string().min(1).max(50),
  sectionIndex: z.number().int().min(0),
  userFeedback: z.string().max(1000).optional(),
  screenshotBase64: z.string().optional(),
  screenshotMimeType: z.string().max(50).optional(),
  model: z.string().max(100).optional(),
});

const GENERATE_VIZ_RATE_LIMIT = {
  namespace: "generate:visualization",
  windowMs: 60_000,
  maxRequests: 20,
} as const;

const vizOutputSchema = z.object({
  vizType: z.enum([
    "function_plot",
    "parametric_plot",
    "vector_field",
    "geometry",
    "3d_surface",
    "manifold",
    "tangent_space",
    "coordinate_transform",
  ]),
  spec: z
    .string()
    .describe(
      "(visualization) JSON string with visualization data. VIZTYPE SELECTION: function_plot for y=f(x) single-variable plots; vector_field for 2D fields F(x,y); 3d_surface for z=f(u,v) surfaces; geometry for points/lines/circles. " +
        'function_plot: {"xRange":[min,max],"yRange":[min,max],"functions":[{"expression":"Math.pow(x,2)","color":"blue","label":"x²"}]}. Expressions must use ONLY variable x (single-variable functions). ' +
        'vector_field: {"xRange":[min,max],"yRange":[min,max],"fieldFunction":"[dx_expr, dy_expr]"} where dx_expr and dy_expr use variables x and y. ' +
        'parametric_plot/3d_surface: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}. ' +
        'geometry: {"xRange":[min,max],"yRange":[min,max],"points":[...],"shapes":[...],"vectors":[...]}'
    ),
  caption: z.string(),
  interactionHint: z.string().optional(),
});

export async function POST(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/generate/visualization",
    config: GENERATE_VIZ_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const { data: body, error: parseError } = await parseBody(
    request,
    generateVizBodySchema
  );
  if (parseError) return parseError;

  const { lessonId, courseId, sectionIndex } = body;

  // Verify course ownership
  const { error: ownershipError } = await verifyCourseOwnership(
    courseId,
    userId
  );
  if (ownershipError) return ownershipError;

  // Load lesson with course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  if (!lesson.contentJson) {
    return NextResponse.json(
      { error: "Lesson has no content" },
      { status: 400 }
    );
  }

  // Parse lesson content
  const content = parseLessonContent(lesson.contentJson);

  // Validate section index points to a visualization
  if (
    sectionIndex < 0 ||
    sectionIndex >= content.sections.length ||
    content.sections[sectionIndex].type !== "visualization"
  ) {
    return NextResponse.json(
      {
        error:
          "sectionIndex does not point to a visualization section",
      },
      { status: 400 }
    );
  }

  const vizSection = content.sections[sectionIndex] as {
    type: "visualization";
    vizType: string;
    spec: unknown;
    caption: string;
    interactionHint?: string;
  };

  // Mock mode: return an improved hardcoded visualization without calling AI
  if (body.model === "mock") {
    const mockSection = {
      type: "visualization" as const,
      vizType: vizSection.vizType as import("@/types/lesson").VisualizationSection["vizType"],
      spec: {
        xRange: [-4, 4] as [number, number],
        yRange: [-2, 16] as [number, number],
        functions: [
          { expression: "Math.pow(x,2)", color: "blue", label: "x² (mock regenerated)" },
          { expression: "2*x+1", color: "orange", label: "2x+1" },
        ],
      } as import("@/types/lesson").VisualizationSpec,
      caption: `${vizSection.caption} (mock regenerated)`,
      interactionHint: "Mock: drag to pan, scroll to zoom.",
    };
    const updatedSections = [...content.sections];
    updatedSections[sectionIndex] = mockSection;
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { contentJson: JSON.stringify({ ...content, sections: updatedSections }) },
    });
    return NextResponse.json({ section: mockSection });
  }

  // Build surrounding sections context (2 before + 2 after, text/math/theorem/definition only)
  const contextTypes = new Set(["text", "math", "theorem", "definition"]);
  const surroundingIndices = [
    Math.max(0, sectionIndex - 2),
    Math.max(0, sectionIndex - 1),
    Math.min(content.sections.length - 1, sectionIndex + 1),
    Math.min(content.sections.length - 1, sectionIndex + 2),
  ].filter((i) => i !== sectionIndex);

  const surroundingSections = [...new Set(surroundingIndices)]
    .map((i) => content.sections[i])
    .filter((s) => contextTypes.has(s.type))
    .map((s) => {
      const sec = s as unknown as Record<string, unknown>;
      if (sec.type === "text") return `[text] ${sec.content ?? ""}`;
      if (sec.type === "math") return `[math] ${sec.latex ?? ""}`;
      if (sec.type === "theorem") return `[theorem] ${sec.name ?? ""}: ${sec.statement ?? ""}`;
      if (sec.type === "definition") return `[definition] ${sec.term ?? ""}: ${sec.definition ?? ""}`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  // Model selection
  const modelId = body.model ?? getCheapestModel(apiKeys);
  if (!modelId) {
    return NextResponse.json(
      { error: "No AI model available for your API keys" },
      { status: 400 }
    );
  }

  const modelInstance = getModelInstance(modelId, apiKeys);

  const currentSpec =
    typeof vizSection.spec === "string"
      ? vizSection.spec
      : JSON.stringify(vizSection.spec, null, 2);

  const promptText = buildVizRegenerationPrompt({
    vizType: vizSection.vizType,
    currentSpec,
    caption: vizSection.caption,
    lessonTitle: lesson.title,
    lessonSummary: lesson.summary,
    contextDoc: lesson.course.contextDoc ?? "",
    surroundingSections,
    userFeedback: body.userFeedback,
    hasScreenshot: !!body.screenshotBase64,
  });

  // Build messages array (with optional screenshot)
  type MessageContent =
    | { type: "text"; text: string }
    | { type: "image"; image: string; mimeType: string };

  const userContent: MessageContent[] = [{ type: "text", text: promptText }];

  if (body.screenshotBase64 && body.screenshotMimeType) {
    userContent.push({
      type: "image",
      image: body.screenshotBase64,
      mimeType: body.screenshotMimeType,
    });
  }

  let generated: z.infer<typeof vizOutputSchema> | null = null;

  try {
    const tracker = createRepairTracker();
    const { object } = await generateObject({
      model: modelInstance,
      schema: vizOutputSchema,
      messages: [{ role: "user", content: userContent }],
      providerOptions: getProviderOptions(modelId),
      experimental_repairText: createRepairFunction(vizOutputSchema, tracker),
    });
    generated = object;
  } catch (genErr) {
    if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
      // Layer 1: direct coercion
      try {
        const parsed = JSON.parse(genErr.text);
        const { unwrapped } = unwrapParameter(parsed);
        const coerced = tryCoerceAndValidate(unwrapped, vizOutputSchema);
        if (coerced) generated = coerced;
      } catch {
        // ignore parse errors
      }
    }

    if (!generated) {
      const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
      console.error("[viz-regen] Generation failed:", errMsg);
      return NextResponse.json(
        { error: "Failed to generate visualization. Please try again." },
        { status: 500 }
      );
    }
  }

  if (!generated) {
    return NextResponse.json(
      { error: "No output generated" },
      { status: 500 }
    );
  }

  // Validate and repair the generated visualization
  const vizResult = validateAndRepairVisualizations([
    { type: "visualization", vizType: generated.vizType, spec: (() => {
      // Parse spec string to object
      if (typeof generated!.spec === "string") {
        try { return JSON.parse(generated!.spec); } catch { return generated!.spec; }
      }
      return generated!.spec;
    })() },
  ]);

  const vizWarnings = vizResult.warnings;

  // If the viz was removed by validation, it's unusable
  if (vizResult.sections.length === 0 || vizResult.sections[0].type !== "visualization") {
    return NextResponse.json(
      {
        error:
          "Generated visualization spec was invalid and could not be repaired. Please try again with different feedback.",
        warnings: vizWarnings,
      },
      { status: 422 }
    );
  }

  // Parse spec string to object for storage (matches lesson route normalization)
  let specParsed: unknown = generated.spec;
  if (typeof specParsed === "string") {
    try {
      specParsed = JSON.parse(specParsed);
    } catch {
      // keep as-is
    }
  }

  // Patch the section in content
  const updatedSection = {
    type: "visualization" as const,
    vizType: generated.vizType,
    spec: specParsed as import("@/types/lesson").VisualizationSpec,
    caption: generated.caption,
    ...(generated.interactionHint
      ? { interactionHint: generated.interactionHint }
      : {}),
  };

  const updatedSections = [...content.sections];
  updatedSections[sectionIndex] = updatedSection;
  const updatedContent = { ...content, sections: updatedSections };

  // Save to DB
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { contentJson: JSON.stringify(updatedContent) },
  });

  return NextResponse.json({
    section: updatedSection,
    ...(vizWarnings.length > 0 && { warnings: vizWarnings }),
  });
}
