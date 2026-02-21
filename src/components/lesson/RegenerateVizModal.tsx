"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  caption: string;
  onClose: () => void;
  onSubmit: (
    feedback: string,
    screenshot: string | null,
    mimeType: string | null
  ) => void;
}

export function RegenerateVizModal({ open, caption, onClose, onSubmit }: Props) {
  const { t } = useTranslation("lesson");
  const [feedback, setFeedback] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotMimeType, setScreenshotMimeType] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimeType = file.type || "image/png";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Strip "data:image/...;base64," prefix to get raw base64
      const base64 = dataUrl.split(",")[1] ?? dataUrl;
      setScreenshotBase64(base64);
      setScreenshotMimeType(mimeType);
      setScreenshotPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function clearScreenshot() {
    setScreenshotBase64(null);
    setScreenshotMimeType(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    onSubmit(feedback, screenshotBase64, screenshotMimeType);
    // Reset state for next open
    setFeedback("");
    clearScreenshot();
  }

  function handleClose() {
    setFeedback("");
    clearScreenshot();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("regenerateVizModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("regenerateVizModal.description")}
          </DialogDescription>
        </DialogHeader>

        {/* Caption context */}
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {caption}
        </div>

        {/* Feedback textarea */}
        <div className="space-y-1.5">
          <Label htmlFor="viz-feedback">
            {t("regenerateVizModal.feedbackLabel")}
          </Label>
          <Textarea
            id="viz-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t("regenerateVizModal.feedbackPlaceholder")}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Screenshot upload */}
        <div className="space-y-1.5">
          <Label htmlFor="viz-screenshot">
            {t("regenerateVizModal.screenshotLabel")}
          </Label>
          <input
            ref={fileInputRef}
            id="viz-screenshot"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:bg-background file:text-foreground file:cursor-pointer cursor-pointer"
          />
          {screenshotPreview && (
            <div className="relative inline-block mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                className="max-h-32 rounded-md border border-border object-contain"
              />
              <button
                type="button"
                onClick={clearScreenshot}
                className="absolute -top-2 -right-2 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                aria-label={t("regenerateVizModal.screenshotClear")}
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            {t("common:cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={handleSubmit}>
            {t("regenerateViz")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
