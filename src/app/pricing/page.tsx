"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  "generate",
  "clone",
  "quiz",
  "chat",
  "export",
  "gallery",
] as const;

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation(["pricing", "common"]);
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (!session?.user) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payment/checkout", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Learning Courses</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/gallery")}>
              Gallery
            </Button>
            {session?.user ? (
              <Button variant="outline" onClick={() => router.push("/")}>
                Dashboard
              </Button>
            ) : (
              <Button variant="outline" onClick={() => router.push("/login")}>
                Log in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">{t("pricing:title")}</h2>
          <p className="text-lg text-muted-foreground">{t("pricing:subtitle")}</p>
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">{t("pricing:features.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-emerald-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t(`pricing:features.${feature}`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">{t("pricing:byok.title")}</CardTitle>
            <CardDescription>{t("pricing:byok.description")}</CardDescription>
          </CardHeader>
        </Card>

        <div className="text-center space-y-4">
          <Button size="lg" className="text-lg px-8" onClick={handleCheckout} disabled={loading}>
            {loading ? t("pricing:processing") : t("pricing:cta")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("pricing:paymentMethods")}</p>

          <div className="pt-4 text-sm text-muted-foreground">
            <p>{t("pricing:haveCode")}</p>
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => router.push("/redeem")}
            >
              {t("pricing:redeemLink")}
            </Button>
          </div>

          {process.env.NEXT_PUBLIC_DISCORD_INVITE_URL && (
            <div className="pt-2">
              <a
                href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Join our Discord community
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
