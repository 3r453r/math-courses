"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import {
  isInAppBrowser,
  getInAppBrowserName,
  getPlatform,
  getOpenInBrowserUrl,
} from "@/lib/detectInAppBrowser";
import { BrandMark } from "@/components/BrandMark";
import {
  HeroSection,
  HowItWorksSection,
  FeaturesSection,
  FeaturedCoursesSection,
  LandingFooter,
} from "@/components/landing";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const authError = searchParams.get("error");
  const { t } = useTranslation(["login", "common"]);
  const [devEmail, setDevEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState<string | null>(null);
  const [inAppPlatform, setInAppPlatform] = useState<"android" | "ios" | "unknown">("unknown");
  const [dismissedWarning, setDismissedWarning] = useState(false);

  useEffect(() => {
    if (isInAppBrowser()) {
      setInAppBrowser(getInAppBrowserName());
      setInAppPlatform(getPlatform());
    }
  }, []);

  const isDev = process.env.NODE_ENV === "development";

  function handleOAuth(provider: string) {
    setLoading(provider);
    signIn(provider, { callbackUrl });
  }

  function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!devEmail.trim()) return;
    setLoading("credentials");
    signIn("credentials", { email: devEmail.trim(), callbackUrl });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("login:title")}</CardTitle>
        <CardDescription>{t("login:description")}</CardDescription>
        <p className="text-xs text-muted-foreground pt-1">{t("login:tagline")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {inAppBrowser && !dismissedWarning && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {t("login:inAppBrowserWarning", { browser: inAppBrowser })}
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  {t("login:inAppBrowserDescription")}
                </p>
                {inAppPlatform === "android" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900"
                    onClick={() => {
                      const intentUrl = getOpenInBrowserUrl(window.location.href);
                      if (intentUrl) window.location.href = intentUrl;
                    }}
                  >
                    {t("login:openInBrowser")}
                  </Button>
                )}
                {inAppPlatform === "ios" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t("login:iosOpenInstructions")}
                  </p>
                )}
                <button
                  type="button"
                  className="text-xs text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                  onClick={() => setDismissedWarning(true)}
                >
                  {t("login:continueAnyway")}
                </button>
              </div>
            </div>
          </div>
        )}

        {authError && (
          <p className="text-sm text-destructive text-center">
            {t("login:authError")}
          </p>
        )}

        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={() => handleOAuth("google")}
          disabled={loading !== null}
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading === "google" ? t("common:loading") : t("login:signInGoogle")}
        </Button>

        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={() => handleOAuth("github")}
          disabled={loading !== null}
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {loading === "github" ? t("common:loading") : t("login:signInGitHub")}
        </Button>

        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={() => handleOAuth("discord")}
          disabled={loading !== null}
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#5865F2">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
          </svg>
          {loading === "discord" ? t("common:loading") : t("login:signInDiscord")}
        </Button>

        {isDev && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                {t("login:devOnly")}
              </span>
            </div>

            <form onSubmit={handleDevLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-email">{t("login:emailLabel")}</Label>
                <Input
                  id="dev-email"
                  type="email"
                  placeholder="dev@example.com"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!devEmail.trim() || loading !== null}
              >
                {loading === "credentials"
                  ? t("common:loading")
                  : t("login:devSignIn")}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AutoScrollToSignIn() {
  const searchParams = useSearchParams();
  const scrolled = useRef(false);

  useEffect(() => {
    if (scrolled.current) return;
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl && callbackUrl !== "/") {
      scrolled.current = true;
      // Delay slightly so the DOM is fully painted
      setTimeout(() => {
        document.getElementById("sign-in")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [searchParams]);

  return null;
}

export default function LoginPage() {
  const { t } = useTranslation(["login"]);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "authenticated") return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <BrandMark size={24} className="rounded-lg" />
          <span className="text-sm font-semibold bg-gradient-to-r from-brand-from to-brand-to bg-clip-text text-transparent">
            StemForge
          </span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <Suspense>
        <AutoScrollToSignIn />
      </Suspense>

      <div className="container mx-auto px-4">
        <HeroSection />
      </div>

      <HowItWorksSection />

      <div className="container mx-auto px-4">
        <FeaturesSection />
      </div>

      <FeaturedCoursesSection />

      <section id="sign-in" className="py-16">
        <div className="mx-auto max-w-sm h-[3px] rounded-full mb-12" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
        <div className="max-w-sm mx-auto text-center space-y-6">
          <BrandMark size={28} className="mx-auto text-brand-from" />
          <h2 className="text-3xl font-bold">{t("login:signInSection.title")}</h2>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
