"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
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

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const authError = searchParams.get("error");
  const { t } = useTranslation(["login", "common"]);
  const [devEmail, setDevEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

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
      </CardHeader>
      <CardContent className="space-y-4">
        {authError && (
          <p className="text-sm text-destructive text-center">
            {t("login:authError")}
          </p>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleOAuth("google")}
          disabled={loading !== null}
        >
          {loading === "google" ? t("common:loading") : t("login:signInGoogle")}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleOAuth("github")}
          disabled={loading !== null}
        >
          {loading === "github" ? t("common:loading") : t("login:signInGitHub")}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleOAuth("discord")}
          disabled={loading !== null}
        >
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

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
