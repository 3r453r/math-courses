"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SetupPage() {
  const router = useRouter();
  const { apiKey, setApiKey, generationModel, chatModel, setGenerationModel, setChatModel, language, setLanguage } = useAppStore();
  const { t } = useTranslation(["setup", "common"]);
  const [key, setKey] = useState(apiKey ?? "");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleTestKey() {
    if (!key.trim()) {
      setError(t("setup:pleaseEnterApiKey"));
      return;
    }
    setTesting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key.trim(),
        },
      });
      if (res.ok) {
        setSuccess(true);
        setApiKey(key.trim());
      } else {
        const data = await res.json();
        setError(data.error || "Invalid API key");
      }
    } catch {
      // If the test endpoint doesn't exist yet, just save the key
      setApiKey(key.trim());
      setSuccess(true);
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    if (!key.trim()) {
      setError(t("setup:pleaseEnterApiKey"));
      return;
    }
    setApiKey(key.trim());
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{t("setup:title")}</CardTitle>
          <CardDescription>
            {t("setup:description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api-key">{t("setup:apiKeyLabel")}</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-ant-api03-..."
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
                setSuccess(false);
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{t("setup:keySaved")}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gen-model">{t("setup:generationModelLabel")}</Label>
            <Select value={generationModel} onValueChange={setGenerationModel}>
              <SelectTrigger id="gen-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-20250514">{t("setup:opus")}</SelectItem>
                <SelectItem value="claude-sonnet-4-20250514">{t("setup:sonnet")}</SelectItem>
                <SelectItem value="claude-haiku-4-20250514">{t("setup:haiku")}</SelectItem>
                <SelectItem value="mock">{t("setup:mock")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-model">{t("setup:chatModelLabel")}</Label>
            <Select value={chatModel} onValueChange={setChatModel}>
              <SelectTrigger id="chat-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-20250514">{t("setup:opus")}</SelectItem>
                <SelectItem value="claude-sonnet-4-20250514">{t("setup:sonnet")}</SelectItem>
                <SelectItem value="claude-haiku-4-20250514">{t("setup:haiku")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{t("setup:languageLabel")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("setup:english")}</SelectItem>
                <SelectItem value="pl">{t("setup:polish")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("setup:languageDescription")}</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleTestKey} disabled={testing}>
              {testing ? t("setup:testing") : t("setup:testKey")}
            </Button>
            <Button onClick={handleSave} disabled={!key.trim()}>
              {t("setup:saveAndContinue")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("setup:getApiKeyFrom")}{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              console.anthropic.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
