"use client";

import { useTranslation } from "react-i18next";
import { Target, Sparkles, GraduationCap } from "lucide-react";

const STEPS = [
  { icon: Target, key: "choose" },
  { icon: Sparkles, key: "generate" },
  { icon: GraduationCap, key: "learn" },
] as const;

export function HowItWorksSection() {
  const { t } = useTranslation(["login"]);

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-4xl">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t("login:howItWorks.title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map(({ icon: Icon, key }, i) => (
            <div key={key} className="text-center space-y-3">
              <div className="inline-flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary">
                <Icon className="size-7" />
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {t("login:howItWorks.stepLabel", { step: i + 1 })}
              </div>
              <h3 className="text-lg font-semibold">
                {t(`login:howItWorks.${key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(`login:howItWorks.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
