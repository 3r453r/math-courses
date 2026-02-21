"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MathMarkdown } from "./MathMarkdown";
import { WorkedExample } from "./WorkedExample";
import { PracticeExercise } from "./PracticeExercise";
import {
  TextSectionRenderer,
  MathSectionRenderer,
  DefinitionSectionRenderer,
  TheoremSectionRenderer,
  VisualizationSectionRenderer,
  CodeBlockSectionRenderer,
} from "./sections";
import type { LessonContent, LessonSection } from "@/types/lesson";

interface Props {
  content: LessonContent;
  onRegenerateViz?: (sectionIndex: number) => void;
  regeneratingVizIndex?: number | null;
}

function SectionRenderer({
  section,
  index,
  onRegenerateViz,
  regeneratingVizIndex,
}: {
  section: LessonSection;
  index: number;
  onRegenerateViz?: (sectionIndex: number) => void;
  regeneratingVizIndex?: number | null;
}) {
  switch (section.type) {
    case "text":
      return <TextSectionRenderer section={section} />;
    case "math":
      return <MathSectionRenderer section={section} />;
    case "definition":
      return <DefinitionSectionRenderer section={section} />;
    case "theorem":
      return <TheoremSectionRenderer section={section} />;
    case "visualization":
      return (
        <VisualizationSectionRenderer
          section={section}
          sectionIndex={index}
          onRegenerate={onRegenerateViz}
          isRegenerating={regeneratingVizIndex === index}
        />
      );
    case "code_block":
      return <CodeBlockSectionRenderer section={section} />;
    default:
      return null;
  }
}

export function LessonContentRenderer({ content, onRegenerateViz, regeneratingVizIndex }: Props) {
  const { t } = useTranslation("lessonContent");

  return (
    <div className="space-y-2">
      {/* Learning Objectives */}
      <div className="bg-muted/50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold mb-2">{t("learningObjectives")}</h3>
        <ul className="space-y-1">
          {content.learningObjectives.map((obj, i) => (
            <li
              key={i}
              className="text-sm text-muted-foreground flex gap-2 items-start"
            >
              <span className="text-primary mt-0.5">&#10003;</span>
              <MathMarkdown content={obj} className="inline [&_p]:my-0" />
            </li>
          ))}
        </ul>
      </div>

      {/* Sections */}
      {content.sections.map((section, i) => (
        <SectionRenderer
          key={i}
          section={section}
          index={i}
          onRegenerateViz={onRegenerateViz}
          regeneratingVizIndex={regeneratingVizIndex}
        />
      ))}

      {/* Worked Examples */}
      {content.workedExamples.length > 0 && (
        <>
          <Separator className="my-8" />
          <h2 className="text-xl font-bold mb-4">{t("workedExamples")}</h2>
          {content.workedExamples.map((example, i) => (
            <WorkedExample key={i} example={example} index={i} />
          ))}
        </>
      )}

      {/* Practice Exercises */}
      {content.practiceExercises.length > 0 && (
        <>
          <Separator className="my-8" />
          <h2 className="text-xl font-bold mb-4">{t("practiceExercises")}</h2>
          {content.practiceExercises.map((exercise, i) => (
            <PracticeExercise key={i} exercise={exercise} index={i} />
          ))}
        </>
      )}

      {/* Key Takeaways */}
      {content.keyTakeaways.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="bg-primary/5 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">{t("keyTakeaways")}</h3>
            <ul className="space-y-2">
              {content.keyTakeaways.map((takeaway, i) => (
                <li key={i} className="text-sm flex gap-2 items-start">
                  <Badge
                    variant="outline"
                    className="h-5 w-5 flex-shrink-0 flex items-center justify-center text-xs p-0 mt-0.5"
                  >
                    {i + 1}
                  </Badge>
                  <MathMarkdown content={takeaway} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
