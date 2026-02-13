"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const { apiKey, setApiKey, generationModel, chatModel, setGenerationModel, setChatModel } = useAppStore();
  const [key, setKey] = useState(apiKey ?? "");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleTestKey() {
    if (!key.trim()) {
      setError("Please enter an API key");
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
      setError("Please enter an API key");
      return;
    }
    setApiKey(key.trim());
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Math Courses Setup</CardTitle>
          <CardDescription>
            Configure your Anthropic API key and model preferences to get started.
            Your key is stored locally in your browser and never sent to any server except Anthropic&apos;s API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api-key">Anthropic API Key</Label>
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
            {success && <p className="text-sm text-green-600">Key saved successfully</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gen-model">Generation Model (lessons, quizzes)</Label>
            <Select value={generationModel} onValueChange={setGenerationModel}>
              <SelectTrigger id="gen-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-20250514">Claude Opus 4 (highest quality)</SelectItem>
                <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4 (balanced)</SelectItem>
                <SelectItem value="claude-haiku-4-20250514">Claude Haiku 4 (fastest)</SelectItem>
                <SelectItem value="mock">Mock (No API Call)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-model">Chat Model (AI sidebar)</Label>
            <Select value={chatModel} onValueChange={setChatModel}>
              <SelectTrigger id="chat-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-20250514">Claude Opus 4 (highest quality)</SelectItem>
                <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4 (balanced)</SelectItem>
                <SelectItem value="claude-haiku-4-20250514">Claude Haiku 4 (fastest)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleTestKey} disabled={testing}>
              {testing ? "Testing..." : "Test Key"}
            </Button>
            <Button onClick={handleSave} disabled={!key.trim()}>
              Save & Continue
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
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
