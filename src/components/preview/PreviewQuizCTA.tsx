"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QuizResult } from "@/types/quiz";

interface Props {
  result: QuizResult;
}

export function PreviewQuizCTA({ result }: Props) {
  const { t } = useTranslation("preview");
  const router = useRouter();
  const scorePercent = Math.round(result.score * 100);

  const messageKey =
    result.recommendation === "advance"
      ? "scoreMessage_advance"
      : result.recommendation === "supplement"
        ? "scoreMessage_supplement"
        : "scoreMessage_regenerate";

  const scoreColor =
    result.recommendation === "advance"
      ? "text-emerald-600 dark:text-emerald-400"
      : result.recommendation === "supplement"
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="text-center">
        <CardTitle>{t("quizComplete")}</CardTitle>
        <p className={`text-3xl font-bold ${scoreColor}`}>
          {t("score", { score: scorePercent })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-muted-foreground">{t(messageKey)}</p>
        <p className="text-sm font-medium">{t("unlockAll")}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button size="lg" onClick={() => router.push("/pricing")}>
            {t("signUp")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push("/pricing")}
          >
            {t("viewPricing")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
