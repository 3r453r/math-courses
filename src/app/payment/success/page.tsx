"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["pricing"]);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVerifying(true);
    fetch("/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .catch((err) => console.error("Payment verification failed:", err))
      .finally(() => setVerifying(false));
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{t("pricing:success.title")}</CardTitle>
          <CardDescription>
            {verifying ? t("pricing:success.verifying", "Verifying payment...") : t("pricing:success.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => router.push("/")} disabled={verifying}>
            {t("pricing:success.goToDashboard")}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push("/setup")} disabled={verifying}>
            {t("pricing:success.goToSetup")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessContent />
    </Suspense>
  );
}
