"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StarRating } from "./StarRating";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";
import { parseSubjects } from "@/lib/subjects";

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
  cloning: boolean;
  isAuthenticated: boolean;
}

export function GalleryCard({ item, onClone, cloning, isAuthenticated }: GalleryCardProps) {
  const { t } = useTranslation(["gallery"]);
  const tags: string[] = (() => {
    try {
      return JSON.parse(item.tags);
    } catch {
      return [];
    }
  })();

  const languageName = LANGUAGE_NAMES[item.course.language] ?? item.course.language;
  const subjects = parseSubjects(item.course.subject);

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
          <Button
            className="w-full"
            onClick={() => onClone(item.shareToken)}
            disabled={cloning || !isAuthenticated}
          >
            {cloning
              ? t("gallery:card.cloning")
              : isAuthenticated
                ? t("gallery:card.clone")
                : t("gallery:card.loginToClone")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
