"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GalleryShare {
  id: string;
  shareToken: string;
  isActive: boolean;
  isGalleryListed: boolean;
  galleryTitle: string | null;
  galleryDescription: string | null;
  tags: string;
  starCount: number;
  cloneCount: number;
  featuredAt: string | null;
  course: {
    title: string;
    topic: string;
    subject: string;
    difficulty: string;
    status: string;
    clonedFromId: string | null;
    user: { name: string | null; email: string | null };
  };
  eligibility: {
    isEligible: boolean;
    totalLessons: number;
    generatedLessons: number;
  };
}

interface CloneConflict {
  shareId: string;
  conflictingShare: {
    id: string;
    shareToken: string;
    course: { title: string; topic: string; subject: string };
  };
}

export function GalleryManager() {
  const { t } = useTranslation(["admin"]);
  const [shares, setShares] = useState<GalleryShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Clone conflict dialog
  const [cloneConflict, setCloneConflict] = useState<CloneConflict | null>(null);

  useEffect(() => {
    fetchShares();
  }, []);

  async function fetchShares() {
    try {
      const res = await fetch("/api/admin/gallery");
      if (res.ok) {
        setShares(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch shares:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateShare(shareId: string, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/admin/gallery/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.cloneConflict) {
        setCloneConflict({ shareId, conflictingShare: result.conflictingShare });
        return;
      }

      if (res.ok) {
        fetchShares();
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch (err) {
      console.error("Failed to update share:", err);
    }
  }

  async function handleCloneConflictAction(action: "replace" | "add") {
    if (!cloneConflict) return;
    setCloneConflict(null);
    await updateShare(cloneConflict.shareId, {
      isGalleryListed: true,
      cloneConflictAction: action,
    });
  }

  function startEditTags(share: GalleryShare) {
    setEditingTags(share.id);
    try {
      setTagsInput(JSON.parse(share.tags).join(", "));
    } catch {
      setTagsInput("");
    }
  }

  function saveTags(shareId: string) {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateShare(shareId, { tags: JSON.stringify(tags) });
    setEditingTags(null);
    toast.success(t("admin:gallery.tagsSaved"));
  }

  // Derive distinct filter options
  const filterOptions = useMemo(() => {
    const subjects = [...new Set(shares.map((s) => s.course.subject))].sort();
    const topics = [...new Set(shares.map((s) => s.course.topic))].sort();
    const difficulties = [...new Set(shares.map((s) => s.course.difficulty))].sort();
    return { subjects, topics, difficulties };
  }, [shares]);

  // Client-side filtering
  const filteredShares = useMemo(() => {
    return shares.filter((share) => {
      if (subjectFilter !== "all" && share.course.subject !== subjectFilter) return false;
      if (topicFilter !== "all" && share.course.topic !== topicFilter) return false;
      if (difficultyFilter !== "all" && share.course.difficulty !== difficultyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = share.course.title.toLowerCase().includes(q);
        const matchTopic = share.course.topic.toLowerCase().includes(q);
        const matchOwner = (share.course.user.name || share.course.user.email || "").toLowerCase().includes(q);
        if (!matchTitle && !matchTopic && !matchOwner) return false;
      }
      return true;
    });
  }, [shares, search, subjectFilter, topicFilter, difficultyFilter]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (shares.length === 0) {
    return <p className="text-muted-foreground">{t("admin:gallery.noShares")}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder={t("admin:gallery.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("admin:gallery.allSubjects")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:gallery.allSubjects")}</SelectItem>
            {filterOptions.subjects.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("admin:gallery.allTopics")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:gallery.allTopics")}</SelectItem>
            {filterOptions.topics.map((tp) => (
              <SelectItem key={tp} value={tp}>{tp}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("admin:gallery.allDifficulties")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:gallery.allDifficulties")}</SelectItem>
            {filterOptions.difficulties.map((d) => (
              <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">{t("admin:gallery.courseTitle")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.owner")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.eligibility")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.galleryStatus")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.stars")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.clones")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.tags")}</th>
              <th className="text-left p-3 font-medium">{t("admin:accessCodes.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredShares.map((share) => (
              <tr key={share.id} className="border-t">
                <td className="p-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{share.course.title}</p>
                      {share.course.clonedFromId && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {t("admin:gallery.cloned")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {share.course.subject} / {share.course.topic} / {share.course.difficulty}
                    </p>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">
                  {share.course.user.name || share.course.user.email || "\u2014"}
                </td>
                <td className="p-3">
                  {share.eligibility.isEligible ? (
                    <Badge variant="default">{t("admin:gallery.eligible")}</Badge>
                  ) : (
                    <div>
                      <Badge variant="destructive">{t("admin:gallery.notEligible")}</Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("admin:gallery.lessonsGenerated", {
                          generated: share.eligibility.generatedLessons,
                          total: share.eligibility.totalLessons,
                        })}
                      </p>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {share.isGalleryListed ? (
                      <Badge variant="default">{t("admin:gallery.listed")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("admin:gallery.notListed")}</Badge>
                    )}
                    {share.featuredAt && (
                      <Badge variant="secondary">{t("admin:gallery.featured")}</Badge>
                    )}
                  </div>
                </td>
                <td className="p-3 tabular-nums">{share.starCount}</td>
                <td className="p-3 tabular-nums">{share.cloneCount}</td>
                <td className="p-3">
                  {editingTags === share.id ? (
                    <div className="flex gap-1">
                      <Input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        className="h-7 text-xs w-32"
                        placeholder="math, calc"
                      />
                      <Button size="sm" variant="ghost" onClick={() => saveTags(share.id)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditTags(share)}
                    >
                      {t("admin:gallery.editTags")}
                    </Button>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {share.isGalleryListed ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateShare(share.id, { isGalleryListed: false })}
                        >
                          {t("admin:gallery.removeFromGallery")}
                        </Button>
                        {share.featuredAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateShare(share.id, { featuredAt: null })}
                          >
                            {t("admin:gallery.unfeature")}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateShare(share.id, { featuredAt: new Date().toISOString() })
                            }
                          >
                            {t("admin:gallery.feature")}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!share.eligibility.isEligible}
                        onClick={() => updateShare(share.id, { isGalleryListed: true })}
                        title={!share.eligibility.isEligible ? t("admin:gallery.notEligible") : ""}
                      >
                        {t("admin:gallery.addToGallery")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clone conflict dialog */}
      <Dialog open={!!cloneConflict} onOpenChange={() => setCloneConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:gallery.cloneConflict.title")}</DialogTitle>
            <DialogDescription>
              {t("admin:gallery.cloneConflict.message", {
                title: cloneConflict?.conflictingShare.course.title ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          {cloneConflict && (
            <div className="text-sm text-muted-foreground">
              <a
                href={`/shared/${cloneConflict.conflictingShare.shareToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {t("admin:gallery.cloneConflict.viewOriginal")}
              </a>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCloneConflict(null)}>
              {t("admin:gallery.cloneConflict.cancel")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleCloneConflictAction("add")}
            >
              {t("admin:gallery.cloneConflict.addAlongside")}
            </Button>
            <Button onClick={() => handleCloneConflictAction("replace")}>
              {t("admin:gallery.cloneConflict.replace")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
