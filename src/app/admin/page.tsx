"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AccessCodeManager } from "@/components/admin/AccessCodeManager";
import { UserManager } from "@/components/admin/UserManager";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

type Tab = "accessCodes" | "users" | "gallery";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useTranslation(["admin"]);
  const [tab, setTab] = useState<Tab>("gallery");
  const [role, setRole] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== "admin" && data.role !== "owner") {
          router.push("/");
          return;
        }
        setRole(data.role);
        setTab(data.role === "owner" ? "accessCodes" : "gallery");
        setAuthorized(true);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !authorized) return null;

  const isOwner = role === "owner";
  const availableTabs: Tab[] = isOwner
    ? ["accessCodes", "users", "gallery"]
    : ["gallery"];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("admin:title")}</h1>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <UserMenu />
            <Button variant="outline" onClick={() => router.push("/")}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tab buttons */}
        <div className="flex gap-2 mb-6 border-b pb-2">
          {availableTabs.map((tabKey) => (
            <Button
              key={tabKey}
              variant={tab === tabKey ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab(tabKey)}
            >
              {t(`admin:tabs.${tabKey}`)}
            </Button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "accessCodes" && isOwner && <AccessCodeManager />}
        {tab === "users" && isOwner && <UserManager />}
        {tab === "gallery" && <GalleryManager />}
      </main>
    </div>
  );
}
