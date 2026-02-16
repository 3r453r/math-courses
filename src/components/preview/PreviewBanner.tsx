"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PreviewBanner() {
  const { t } = useTranslation("preview");
  const router = useRouter();

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
          {t("badge")}
        </Badge>
        <span className="text-sm text-amber-800 dark:text-amber-200 truncate">
          {t("bannerText")}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900"
        onClick={() => router.push("/pricing")}
      >
        {t("signUpForFullAccess")}
      </Button>
    </div>
  );
}
