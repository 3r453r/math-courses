"use client";

import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Sparkles,
  ClipboardCheck,
  MessageCircle,
  GitBranch,
  Download,
  LayoutGrid,
} from "lucide-react";

const FEATURES = [
  { icon: Sparkles, key: "generation" },
  { icon: ClipboardCheck, key: "quizzes" },
  { icon: MessageCircle, key: "chat" },
  { icon: GitBranch, key: "graph" },
  { icon: Download, key: "export" },
  { icon: LayoutGrid, key: "gallery" },
] as const;

export function FeaturesSection() {
  const { t } = useTranslation(["login"]);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t("login:features.title")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, key }) => (
            <Card key={key} className="border-border/50">
              <CardHeader className="space-y-2">
                <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-base">
                  {t(`login:features.${key}.title`)}
                </CardTitle>
                <CardDescription>
                  {t(`login:features.${key}.description`)}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
