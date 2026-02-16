"use client";

import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "pl", label: "PL" },
] as const;

export function LanguageToggle() {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  function cycle() {
    const currentIndex = LANGUAGES.findIndex((l) => l.code === language);
    const next = LANGUAGES[(currentIndex + 1) % LANGUAGES.length];
    setLanguage(next.code);
  }

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-8 p-0 text-xs font-medium"
      onClick={cycle}
      title={`Language: ${current.label}`}
    >
      {current.label}
    </Button>
  );
}
