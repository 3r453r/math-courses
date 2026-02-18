"use client";

import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
import ReactMarkdown from "react-markdown";

interface TermsContentProps {
  terms: Record<string, string>;
}

export function TermsContent({ terms }: TermsContentProps) {
  const { t } = useTranslation(["terms"]);
  const language = useAppStore((s) => s.language);
  const content = terms[language] ?? terms.en;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">{t("terms:pageTitle")}</h1>
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
