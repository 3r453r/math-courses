"use client";

import { useEffect } from "react";
import i18n from "@/i18n/config";
import { useAppStore } from "@/stores/appStore";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useAppStore((s) => s.language);

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    document.documentElement.lang = language;
  }, [language]);

  return <>{children}</>;
}
