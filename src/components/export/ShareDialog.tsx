"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";

interface ShareLink {
  id: string;
  shareToken: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface ShareDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ courseId, open, onOpenChange }: ShareDialogProps) {
  const { t } = useTranslation("export");
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLinks();
    }
  }, [open, courseId]);

  async function fetchLinks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/share`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
      const newLink = await res.json();
      setLinks((prev) => [newLink, ...prev]);
      const url = `${window.location.origin}/shared/${newLink.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("shareFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(shareId: string) {
    try {
      const res = await fetch(`/api/courses/${courseId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!res.ok) throw new Error("Failed");
      setLinks((prev) =>
        prev.map((l) => (l.id === shareId ? { ...l, isActive: false } : l))
      );
      toast.success(t("linkRevoked"));
    } catch {
      toast.error(t("revokeFailed"));
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }

  const activeLinks = links.filter((l) => l.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shareCourse")}</DialogTitle>
          <DialogDescription>{t("shareLinkDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? t("downloading") : t("generateShareLink")}
          </Button>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("downloading")}
            </p>
          ) : activeLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("noActiveLinks")}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("activeLinks")}</p>
              {activeLinks.map((link) => (
                <div
                  key={link.id}
                  className="p-3 rounded-lg border text-sm space-y-2"
                >
                  <p className="font-mono text-xs truncate">
                    {window.location.origin}/shared/{link.shareToken}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t("createdOn", {
                        date: new Date(link.createdAt).toLocaleDateString(),
                      })}
                      {link.expiresAt && (
                        <>
                          {" · "}
                          {t("expires", {
                            date: new Date(link.expiresAt).toLocaleDateString(),
                          })}
                        </>
                      )}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(link.shareToken)}
                      >
                        {t("copyLink")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(link.id)}
                      >
                        {t("revokeLink")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Show revoked links */}
          {links.filter((l) => !l.isActive).length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              {links
                .filter((l) => !l.isActive)
                .map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 p-2 text-sm text-muted-foreground"
                  >
                    <span className="font-mono text-xs truncate flex-1">
                      ...{link.shareToken.slice(-8)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      revoked
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
