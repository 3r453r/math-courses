"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BookOpen, Shield, User, Heart } from "lucide-react";

interface AcceptTermsContentProps {
  terms: Record<string, string>;
}

function AcceptTermsInner({ terms }: AcceptTermsContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["terms"]);
  const language = useAppStore((s) => s.language);
  const content = terms[language] ?? terms.en;
  const [accepting, setAccepting] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch("/api/user/tos", { method: "PATCH" });
      if (res.ok) {
        router.push(callbackUrl);
      }
    } catch {
      // silently fail, user can retry
    } finally {
      setAccepting(false);
    }
  }

  const highlights = [
    {
      icon: BookOpen,
      titleKey: "terms:acceptPage.highlights.community.title",
      descKey: "terms:acceptPage.highlights.community.description",
    },
    {
      icon: Shield,
      titleKey: "terms:acceptPage.highlights.curation.title",
      descKey: "terms:acceptPage.highlights.curation.description",
    },
    {
      icon: User,
      titleKey: "terms:acceptPage.highlights.attribution.title",
      descKey: "terms:acceptPage.highlights.attribution.description",
    },
    {
      icon: Heart,
      titleKey: "terms:acceptPage.highlights.preferences.title",
      descKey: "terms:acceptPage.highlights.preferences.description",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{t("terms:acceptPage.title")}</h1>
          <p className="text-muted-foreground">{t("terms:acceptPage.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {highlights.map(({ icon: Icon, titleKey, descKey }) => (
            <Card key={titleKey} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="inline-flex items-center justify-center size-8 rounded-lg text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-sm">{t(titleKey)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs">{t(descKey)}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {t("terms:acceptPage.fullTermsLabel")}
          </button>

          {showFull && (
            <div className="max-h-64 overflow-y-auto rounded-lg border p-4">
              <article className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </article>
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full text-base text-white border-0 hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? t("terms:acceptPage.accepting") : t("terms:acceptPage.acceptButton")}
        </Button>
      </div>
    </div>
  );
}

export function AcceptTermsContent(props: AcceptTermsContentProps) {
  return (
    <Suspense>
      <AcceptTermsInner {...props} />
    </Suspense>
  );
}
