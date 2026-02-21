"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MODEL_REGISTRY } from "@/lib/ai/client";
import type { AIProvider } from "@/lib/ai/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ColorThemeSelector } from "@/components/ColorThemeSelector";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

interface ProviderConfig {
  id: AIProvider;
  label: string;
  placeholder: string;
  helpUrl: string;
  helpSteps: string;
}

interface ProviderKeyMetadata {
  present: boolean;
  maskedSuffix: string | null;
  lastUpdated: string | null;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-api03-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpSteps: "console.anthropic.com",
  },
  {
    id: "openai",
    label: "OpenAI (GPT)",
    placeholder: "sk-proj-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpSteps: "platform.openai.com",
  },
  {
    id: "google",
    label: "Google (Gemini)",
    placeholder: "AI...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpSteps: "aistudio.google.com",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    apiKeys,
    setProviderApiKey,
    generationModel,
    chatModel,
    setGenerationModel,
    setChatModel,
    language,
    setLanguage,
    freeResponseCheckMode,
    setFreeResponseCheckMode,
  } = useAppStore();
  const { t } = useTranslation(["setup", "common", "login"]);
  const { theme, setTheme } = useTheme();

  // Local draft keys (one per provider)
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({
    anthropic: apiKeys.anthropic ?? "",
    openai: apiKeys.openai ?? "",
    google: apiKeys.google ?? "",
  });
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "valid" | "error">>({
    anthropic: apiKeys.anthropic ? "valid" : "idle",
    openai: apiKeys.openai ? "valid" : "idle",
    google: apiKeys.google ? "valid" : "idle",
  });
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({
    anthropic: true,
    openai: !apiKeys.anthropic,
    google: !apiKeys.anthropic && !apiKeys.openai,
  });
  const [syncToServer, setSyncToServer] = useState(false);
  const [serverKeyMetadata, setServerKeyMetadata] = useState<Partial<Record<AIProvider, ProviderKeyMetadata>>>({});

  // On mount, fetch server-side key metadata.
  useEffect(() => {
    fetch("/api/user/api-key")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.apiKeys) {
          const metadata = data.apiKeys as Partial<Record<AIProvider, ProviderKeyMetadata>>;
          setServerKeyMetadata(metadata);
          for (const [provider, entry] of Object.entries(metadata)) {
            if (entry?.present) {
              setTestStatus((prev) => ({ ...prev, [provider]: "valid" }));
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Available models: only from providers that have a key configured
  const configuredProviders = useMemo(() => {
    const providers = new Set<AIProvider>();
    if (draftKeys.anthropic?.trim()) providers.add("anthropic");
    if (draftKeys.openai?.trim()) providers.add("openai");
    if (draftKeys.google?.trim()) providers.add("google");
    if (serverKeyMetadata.anthropic?.present) providers.add("anthropic");
    if (serverKeyMetadata.openai?.present) providers.add("openai");
    if (serverKeyMetadata.google?.present) providers.add("google");
    return providers;
  }, [draftKeys, serverKeyMetadata]);

  const availableModels = useMemo(() => {
    return MODEL_REGISTRY.filter((m) => configuredProviders.has(m.provider));
  }, [configuredProviders]);

  // Group models by provider for SelectGroup
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, typeof MODEL_REGISTRY> = {};
    for (const model of availableModels) {
      const key = model.provider;
      if (!groups[key]) groups[key] = [];
      groups[key].push(model);
    }
    return groups;
  }, [availableModels]);

  async function handleTestKey(provider: AIProvider) {
    const key = draftKeys[provider]?.trim();
    if (!key) return;

    setTestStatus((prev) => ({ ...prev, [provider]: "testing" }));
    setTestErrors((prev) => ({ ...prev, [provider]: "" }));

    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, [provider]: "valid" }));
        setProviderApiKey(provider, key);
      } else {
        const data = await res.json();
        setTestStatus((prev) => ({ ...prev, [provider]: "error" }));
        setTestErrors((prev) => ({ ...prev, [provider]: data.error || "Invalid API key" }));
      }
    } catch {
      setProviderApiKey(provider, key);
      setTestStatus((prev) => ({ ...prev, [provider]: "valid" }));
    }
  }

  function handleKeyChange(provider: AIProvider, value: string) {
    setDraftKeys((prev) => ({ ...prev, [provider]: value }));
    setTestStatus((prev) => ({ ...prev, [provider]: "idle" }));
    setTestErrors((prev) => ({ ...prev, [provider]: "" }));
  }

  async function handleRevoke(provider: AIProvider) {
    setDraftKeys((prev) => ({ ...prev, [provider]: "" }));
    setProviderApiKey(provider, null);
    setTestStatus((prev) => ({ ...prev, [provider]: "idle" }));
    setTestErrors((prev) => ({ ...prev, [provider]: "" }));
    setServerKeyMetadata((prev) => ({ ...prev, [provider]: { present: false, maskedSuffix: null, lastUpdated: null } }));

    try {
      await fetch(`/api/user/api-key?provider=${provider}`, { method: "DELETE" });
    } catch {
      // Non-blocking
    }
  }

  async function handleSave() {
    // Save all non-empty keys to store
    for (const provider of PROVIDERS) {
      const key = draftKeys[provider.id]?.trim();
      if (key) {
        setProviderApiKey(provider.id, key);
      } else if (!serverKeyMetadata[provider.id]?.present) {
        setProviderApiKey(provider.id, null);
      }
    }

    // Optionally sync to server
    if (syncToServer) {
      const keysToSync: Record<string, string> = {};
      for (const provider of PROVIDERS) {
        const key = draftKeys[provider.id]?.trim();
        if (key) keysToSync[provider.id] = key;
      }
      if (Object.keys(keysToSync).length > 0) {
        try {
          await fetch("/api/user/api-key", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKeys: keysToSync }),
          });
        } catch {
          // Non-blocking
        }
      }
    }

    router.push("/");
  }

  const hasAnyKey = Object.values(draftKeys).some((k) => k?.trim());

  function statusIndicator(provider: AIProvider) {
    const status = testStatus[provider];
    switch (status) {
      case "valid":
        return <span className="text-xs text-green-600 font-medium">{t("setup:keyVerified")}</span>;
      case "error":
        return <span className="text-xs text-destructive">{testErrors[provider] || t("setup:keyInvalid")}</span>;
      case "testing":
        return <span className="text-xs text-muted-foreground">{t("setup:testing")}</span>;
      default:
        return draftKeys[provider]?.trim()
          ? <span className="text-xs text-muted-foreground">{t("setup:keyNotTested")}</span>
          : <span className="text-xs text-muted-foreground">{t("setup:keyNotConfigured")}</span>;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{t("setup:title")}</CardTitle>
          <CardDescription>
            {t("setup:description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider cards */}
          {PROVIDERS.map((provider) => (
            <Collapsible
              key={provider.id}
              open={openProviders[provider.id]}
              onOpenChange={(open) => setOpenProviders((prev) => ({ ...prev, [provider.id]: open }))}
            >
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{provider.label}</span>
                      {statusIndicator(provider.id)}
                    </div>
                    <svg
                      className={`size-4 text-muted-foreground transition-transform ${openProviders[provider.id] ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor={`key-${provider.id}`} className="text-xs">
                        {t("setup:apiKeyLabel")}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`key-${provider.id}`}
                          type="password"
                          placeholder={provider.placeholder}
                          value={draftKeys[provider.id] || ""}
                          onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestKey(provider.id)}
                          disabled={!draftKeys[provider.id]?.trim() || testStatus[provider.id] === "testing"}
                        >
                          {testStatus[provider.id] === "testing" ? t("setup:testing") : t("setup:testKey")}
                        </Button>
                      </div>
                      {serverKeyMetadata[provider.id]?.present && !draftKeys[provider.id]?.trim() && (
                        <p className="text-xs text-muted-foreground">
                          Saved key: ••••{serverKeyMetadata[provider.id]?.maskedSuffix || "????"}
                          {serverKeyMetadata[provider.id]?.lastUpdated && (
                            <span> · updated {new Date(serverKeyMetadata[provider.id]!.lastUpdated!).toLocaleDateString()}</span>
                          )}
                        </p>
                      )}
                      {serverKeyMetadata[provider.id]?.present && (
                        <div>
                          <Button variant="ghost" size="sm" onClick={() => handleRevoke(provider.id)}>
                            Revoke saved key
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("setup:getApiKeyFrom")}{" "}
                      <a
                        href={provider.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-foreground"
                      >
                        {provider.helpSteps}
                      </a>
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}

          {/* Model selection */}
          <div className="space-y-2 pt-2">
            <Label htmlFor="gen-model">{t("setup:generationModelLabel")}</Label>
            <Select value={generationModel} onValueChange={setGenerationModel}>
              <SelectTrigger id="gen-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modelsByProvider).map(([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="capitalize">{provider}</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>{t("setup:other")}</SelectLabel>
                  <SelectItem value="mock">{t("setup:mock")}</SelectItem>
                </SelectGroup>
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
                {Object.entries(modelsByProvider).map(([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="capitalize">{provider}</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
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

          {/* Learning Preferences */}
          <div className="space-y-3 pt-2">
            <Label>{t("setup:learningPreferences")}</Label>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("setup:freeResponseCheckMode")}</p>
              <Select
                value={freeResponseCheckMode}
                onValueChange={(v) => setFreeResponseCheckMode(v as "ai" | "solution")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai">{t("setup:freeResponseCheckModeAi")}</SelectItem>
                  <SelectItem value="solution">{t("setup:freeResponseCheckModeSolution")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("setup:freeResponseCheckModeHelp")}</p>
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-3 pt-2">
            <Label>{t("setup:appearance.title")}</Label>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("setup:appearance.darkMode")}</p>
              <div className="flex gap-1">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  className="gap-1.5"
                >
                  <Sun className="size-3.5" />
                  {t("setup:appearance.light")}
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  className="gap-1.5"
                >
                  <Moon className="size-3.5" />
                  {t("setup:appearance.dark")}
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  className="gap-1.5"
                >
                  <Monitor className="size-3.5" />
                  {t("setup:appearance.system")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("setup:appearance.colorTheme")}</p>
              <ColorThemeSelector />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="sync-key"
              type="checkbox"
              checked={syncToServer}
              onChange={(e) => setSyncToServer(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="sync-key" className="text-sm font-normal">
              {t("setup:syncApiKey")}
            </Label>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave}>
              {t("setup:saveAndContinue")}
            </Button>
          </div>

          {!hasAnyKey && (
            <p className="text-xs text-muted-foreground">
              {t("setup:configureAtLeastOne")}
            </p>
          )}

          {process.env.NEXT_PUBLIC_DISCORD_INVITE_URL && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">
                <p>{t("setup:apiKeyHelp.needHelp")}</p>
                <a
                  href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-foreground"
                >
                  {t("setup:apiKeyHelp.discordHelp")}
                </a>
              </div>
            </div>
          )}

          {session?.user && (
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("setup:signedInAs")} <strong>{session.user.name || session.user.email}</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                {t("login:signOut")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
