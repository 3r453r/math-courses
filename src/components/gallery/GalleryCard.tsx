"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarRating } from "./StarRating";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";
import { parseSubjects } from "@/lib/subjects";
import { computeDagLayers } from "@/lib/course/dagLayers";

interface LessonStructure {
  id: string;
  title: string;
  orderIndex: number;
}

interface GalleryItem {
  shareToken: string;
  starCount: number;
  cloneCount: number;
  tags: string;
  featuredAt: string | null;
  hasPreview?: boolean;
  creatorName?: string | null;
  course: {
    title: string;
    description: string;
    topic: string;
    subject: string;
    difficulty: string;
    language: string;
    _count: { lessons: number };
    user: { name: string | null };
  };
}

interface GalleryCardProps {
  item: GalleryItem;
  onClone: (shareToken: string) => void;
  onTranslate?: (shareToken: string, targetLanguage: string) => void;
  cloning: boolean;
  translating?: boolean;
  isAuthenticated: boolean;
}

export function GalleryCard({
  item,
  onClone,
  onTranslate,
  cloning,
  translating,
  isAuthenticated,
}: GalleryCardProps) {
  const { t } = useTranslation(["gallery"]);
  const [expanded, setExpanded] = useState(false);
  const [lessonLayers, setLessonLayers] = useState<LessonStructure[][] | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);

  async function handleToggle() {
    if (!expanded && !lessonLayers) {
      setLoadingLessons(true);
      try {
        const res = await fetch(`/api/gallery/${item.shareToken}/lessons`);
        if (res.ok) {
          const { lessons, edges } = await res.json();
          setLessonLayers(computeDagLayers(lessons, edges));
        }
      } finally {
        setLoadingLessons(false);
      }
    }
    setExpanded((v) => !v);
  }
  const tags: string[] = (() => {
    try {
      return JSON.parse(item.tags);
    } catch {
      return [];
    }
  })();

  const languageName = LANGUAGE_NAMES[item.course.language] ?? item.course.language;
  const subjects = parseSubjects(item.course.subject);
  const busy = cloning || !!translating;

  // Languages available for translation (exclude the course's own language)
  const translateLanguages = Object.entries(LANGUAGE_NAMES).filter(
    ([code]) => code !== item.course.language,
  );

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{item.course.title}</CardTitle>
          {item.featuredAt && (
            <Badge variant="secondary" className="shrink-0">
              {t("gallery:card.featured")}
            </Badge>
          )}
        </div>
        {item.creatorName && (
          <p className="text-xs text-muted-foreground">
            {t("gallery:card.byAuthor", { name: item.creatorName })}
          </p>
        )}
        <CardDescription className="line-clamp-2">
          {item.course.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((subj) => (
              <Badge key={subj} variant="secondary" className="text-xs">{subj}</Badge>
            ))}
            <Badge variant="outline">{item.course.topic}</Badge>
            <Badge variant="outline" className="capitalize">
              {item.course.difficulty}
            </Badge>
            {languageName && (
              <Badge variant="outline" className="text-xs">
                {languageName}
              </Badge>
            )}
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {t("gallery:card.lessons", { count: item.course._count.lessons })}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <StarRating rating={item.starCount > 0 ? item.starCount : 0} />
            <span className="text-xs text-muted-foreground">
              {item.starCount > 0 && t("gallery:card.rating", {
                rating: item.starCount,
              })}
            </span>
            {item.cloneCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("gallery:card.cloneCount", { count: item.cloneCount })}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleToggle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? t("gallery:card.hideLessons") : t("gallery:card.showLessons")}
        </button>

        {expanded && (
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border-t pt-2">
            {loadingLessons ? (
              <p className="text-xs text-muted-foreground">{t("gallery:card.loadingLessons")}</p>
            ) : lessonLayers?.map((layer, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">
                  {t("gallery:card.step", { n: i + 1 })}
                </p>
                <ul className="space-y-0.5">
                  {layer.map((lesson) => (
                    <li key={lesson.id} className="text-xs truncate pl-1">• {lesson.title}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {item.hasPreview && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = `/preview/${item.shareToken}`}
            >
              {t("gallery:card.tryPreview")}
            </Button>
          )}

          {/* Clone + Translate dropdown */}
          {isAuthenticated && onTranslate ? (
            <div className="flex gap-1">
              <Button
                className="flex-1"
                onClick={() => onClone(item.shareToken)}
                disabled={busy}
              >
                {cloning
                  ? t("gallery:card.cloning")
                  : translating
                    ? t("gallery:card.translating")
                    : t("gallery:card.clone")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={busy}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onClone(item.shareToken)}>
                    {t("gallery:card.clone")}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {t("gallery:card.translateTo")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                      {translateLanguages.map(([code, name]) => (
                        <DropdownMenuItem
                          key={code}
                          onClick={() => onTranslate(item.shareToken, code)}
                        >
                          {name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => onClone(item.shareToken)}
              disabled={busy || !isAuthenticated}
            >
              {cloning
                ? t("gallery:card.cloning")
                : isAuthenticated
                  ? t("gallery:card.clone")
                  : t("gallery:card.loginToClone")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
