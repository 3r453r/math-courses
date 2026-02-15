"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function RedeemPage() {
  const router = useRouter();
  const { t } = useTranslation(["redeem", "common"]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to redeem code");
        return;
      }

      toast.success(t("redeem:success"));
      setTimeout(() => router.push("/setup"), 1500);
    } catch {
      toast.error("Failed to redeem code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("redeem:title")}</CardTitle>
          <CardDescription>{t("redeem:description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("redeem:codePlaceholder")}
              className="text-center font-mono text-lg tracking-wider"
              maxLength={20}
              autoFocus
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!code.trim() || loading}
            >
              {loading ? t("redeem:submitting") : t("redeem:submit")}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            <p>{t("redeem:orPurchase")}</p>
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => router.push("/pricing")}
            >
              {t("redeem:getPricing")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
