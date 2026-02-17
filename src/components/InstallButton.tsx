"use client";

import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt, promptInstall } from "@/hooks/useInstallPrompt";

export function InstallButton() {
  const { isStandalone } = useInstallPrompt();
  const { t } = useTranslation("common");

  if (isStandalone) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-8 p-0"
      title={t("installApp")}
      onClick={() => promptInstall(t("installAppFallback"))}
    >
      <Download className="size-4" />
    </Button>
  );
}
