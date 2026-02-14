"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExportDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ courseId, open, onOpenChange }: ExportDialogProps) {
  const { t } = useTranslation("export");
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleExport(format: "markdown" | "json") {
    setDownloading(format);
    try {
      const res = await fetch(`/api/courses/${courseId}/export/${format}`);
      if (!res.ok) throw new Error("Export failed");

      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `course.${format === "markdown" ? "md" : "json"}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setDownloading(null);
    }
  }

  function handlePrint() {
    onOpenChange(false);
    router.push(`/courses/${courseId}/print`);
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Import failed");
      }
      const result = await res.json();
      toast.success(t("importSuccess"));
      onOpenChange(false);
      router.push(`/courses/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("importFailed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("exportCourse")}</DialogTitle>
          <DialogDescription>{t("exportFormat")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Markdown export */}
          <button
            onClick={() => handleExport("markdown")}
            disabled={downloading !== null}
            className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t("markdown")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("markdownDescription")}
                </p>
              </div>
              {downloading === "markdown" && (
                <span className="text-xs text-muted-foreground">{t("downloading")}</span>
              )}
            </div>
          </button>

          {/* JSON export */}
          <button
            onClick={() => handleExport("json")}
            disabled={downloading !== null}
            className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t("json")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("jsonDescription")}
                </p>
              </div>
              {downloading === "json" && (
                <span className="text-xs text-muted-foreground">{t("downloading")}</span>
              )}
            </div>
          </button>

          {/* Print to PDF */}
          <button
            onClick={handlePrint}
            className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors"
          >
            <p className="font-medium text-sm">{t("printPdf")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("printDescription")}
            </p>
          </button>

          {/* Import from JSON */}
          <div className="pt-2 border-t">
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={importing}
              onClick={() => importRef.current?.click()}
            >
              {importing ? t("importing") : t("importCourse")}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              {t("importDescription")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
