export interface LessonContent {
  title: string;
  summary: string;
  learningObjectives: string[];
  sections: LessonSection[];
  workedExamples: WorkedExample[];
  practiceExercises: PracticeExercise[];
  keyTakeaways: string[];
}

export type LessonSection =
  | TextSection
  | MathSection
  | DefinitionSection
  | TheoremSection
  | VisualizationSection
  | CodeBlockSection;

export interface TextSection {
  type: "text";
  content: string; // Markdown+LaTeX
}

export interface MathSection {
  type: "math";
  latex: string;
  explanation?: string;
}

export interface DefinitionSection {
  type: "definition";
  term: string;
  definition: string; // Markdown+LaTeX
  intuition?: string;
}

export interface TheoremSection {
  type: "theorem";
  name: string;
  statement: string; // Markdown+LaTeX
  proof?: string;
  intuition?: string;
}

export interface VisualizationSection {
  type: "visualization";
  vizType:
    | "function_plot"
    | "parametric_plot"
    | "vector_field"
    | "geometry"
    | "3d_surface"
    | "manifold"
    | "tangent_space"
    | "coordinate_transform";
  spec: VisualizationSpec;
  caption: string;
  interactionHint?: string;
}

export interface VisualizationSpec {
  xRange?: [number, number];
  yRange?: [number, number];
  zRange?: [number, number];
  functions?: Array<{
    expression: string; // JS Math expression of x
    color?: string;
    label?: string;
  }>;
  parametricSurface?: {
    xExpr: string; // f(u,v)
    yExpr: string;
    zExpr: string;
    uRange: [number, number];
    vRange: [number, number];
  };
  points?: Array<{
    x: number;
    y: number;
    z?: number;
    label?: string;
    color?: string;
    draggable?: boolean;
  }>;
  vectors?: Array<{
    origin: [number, number] | [number, number, number];
    direction: [number, number] | [number, number, number];
    color?: string;
    label?: string;
  }>;
  fieldFunction?: string; // JS: "([x,y]) => [dx,dy]"
  shapes?: Array<{
    type: "line" | "circle" | "polygon" | "angle" | "plane";
    params: Record<string, unknown>;
  }>;
}

export interface CodeBlockSection {
  type: "code_block";
  language: string;
  code: string;
  explanation?: string;
}

export interface WorkedExample {
  title: string;
  problemStatement: string; // Markdown+LaTeX
  steps: Array<{
    description: string;
    math?: string;
  }>;
  finalAnswer: string;
}

export interface PracticeExercise {
  id: string;
  problemStatement: string;
  hints: string[];
  solution: string;
  answerType: "free_response" | "multiple_choice" | "numeric";
  expectedAnswer?: string;
  choices?: Array<{ label: string; correct: boolean }>;
}
