"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AccessCode {
  id: string;
  code: string;
  type: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  _count: { redemptions: number };
}

export function AccessCodeManager() {
  const { t } = useTranslation(["admin"]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [type, setType] = useState("general");

  useEffect(() => {
    fetchCodes();
  }, []);

  async function fetchCodes() {
    try {
      const res = await fetch("/api/access-codes");
      if (res.ok) {
        setCodes(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch codes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function generateCodes() {
    setGenerating(true);
    try {
      const res = await fetch("/api/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, maxUses, type }),
      });
      if (res.ok) {
        toast.success(t("admin:accessCodes.generated", { count }));
        fetchCodes();
      }
    } catch (err) {
      console.error("Failed to generate codes:", err);
      toast.error("Failed to generate codes");
    } finally {
      setGenerating(false);
    }
  }

  async function deactivateCode(codeId: string) {
    try {
      const res = await fetch(`/api/access-codes/${codeId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("admin:accessCodes.deactivated"));
        setCodes((prev) =>
          prev.map((c) => (c.id === codeId ? { ...c, isActive: false } : c))
        );
      }
    } catch (err) {
      console.error("Failed to deactivate code:", err);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success(t("admin:accessCodes.copied"));
  }

  function codeStatus(code: AccessCode): string {
    if (!code.isActive) return "inactive";
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) return "expired";
    return "active";
  }

  return (
    <div className="space-y-6">
      {/* Generate form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin:accessCodes.generate")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>{t("admin:accessCodes.count")}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("admin:accessCodes.maxUses")}</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("admin:accessCodes.type")}</Label>
              <Input
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={generateCodes} disabled={generating}>
              {generating ? t("admin:accessCodes.generating") : t("admin:accessCodes.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Codes list */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : codes.length === 0 ? (
        <p className="text-muted-foreground">{t("admin:accessCodes.noCodes")}</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("admin:accessCodes.code")}</th>
                <th className="text-left p-3 font-medium">{t("admin:accessCodes.type")}</th>
                <th className="text-left p-3 font-medium">{t("admin:accessCodes.uses")}</th>
                <th className="text-left p-3 font-medium">{t("admin:accessCodes.status")}</th>
                <th className="text-left p-3 font-medium">{t("admin:accessCodes.created")}</th>
                <th className="text-left p-3 font-medium">{t("admin:accessCodes.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const status = codeStatus(code);
                return (
                  <tr key={code.id} className="border-t">
                    <td className="p-3 font-mono">{code.code}</td>
                    <td className="p-3">{code.type}</td>
                    <td className="p-3">
                      {code.currentUses}/{code.maxUses}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          status === "active"
                            ? "default"
                            : status === "expired"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {t(`admin:accessCodes.${status}`)}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(code.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(code.code)}
                        >
                          {t("admin:accessCodes.copy")}
                        </Button>
                        {code.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deactivateCode(code.id)}
                          >
                            {t("admin:accessCodes.deactivate")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
