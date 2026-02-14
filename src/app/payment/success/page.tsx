"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const { t } = useTranslation(["pricing"]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{t("pricing:success.title")}</CardTitle>
          <CardDescription>{t("pricing:success.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => router.push("/")}>
            {t("pricing:success.goToDashboard")}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push("/setup")}>
            {t("pricing:success.goToSetup")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
