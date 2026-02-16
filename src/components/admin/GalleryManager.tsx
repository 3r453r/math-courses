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
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";
import { parseSubjects } from "@/lib/subjects";

interface GalleryShareInfo {
  id: string;
  shareToken: string;
  isGalleryListed: boolean;
  galleryTitle: string | null;
  galleryDescription: string | null;
  tags: string;
  starCount: number;
  cloneCount: number;
  featuredAt: string | null;
  expiresAt: string | null;
}

interface GalleryCourse {
  id: string;
  title: string;
  topic: string;
  subject: string;
  difficulty: string;
  status: string;
  language: string;
  clonedFromId: string | null;
  user: { name: string | null; email: string | null };
  shares: GalleryShareInfo[];
  eligibility: {
    isEligible: boolean;
    totalLessons: number;
    generatedLessons: number;
  };
}

interface CloneConflict {
  /** shareId for PATCH, or courseId for POST */
  identifier: string;
  mode: "patch" | "post";
  conflictingShare: {
    id: string;
    shareToken: string;
    course: { title: string; topic: string; subject: string };
  };
}

export function GalleryManager() {
  const { t } = useTranslation(["admin"]);
  const [courses, setCourses] = useState<GalleryCourse[]>([]);
  const [callerRole, setCallerRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Clone conflict dialog
  const [cloneConflict, setCloneConflict] = useState<CloneConflict | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    try {
      const res = await fetch("/api/admin/gallery");
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses);
        setCallerRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  }

  /** PATCH an existing share */
  async function updateShare(shareId: string, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/admin/gallery/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.cloneConflict) {
        setCloneConflict({ identifier: shareId, mode: "patch", conflictingShare: result.conflictingShare });
        return;
      }

      if (res.ok) {
        fetchCourses();
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch (err) {
      console.error("Failed to update share:", err);
    }
  }

  /** POST to create a new share + gallery listing for a course without shares */
  async function createGalleryListing(courseId: string, data?: Record<string, unknown>) {
    try {
      const res = await fetch("/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, ...data }),
      });
      const result = await res.json();

      if (result.cloneConflict) {
        setCloneConflict({ identifier: courseId, mode: "post", conflictingShare: result.conflictingShare });
        return;
      }

      if (res.ok) {
        fetchCourses();
      } else {
        toast.error(result.error || "Failed to create gallery listing");
      }
    } catch (err) {
      console.error("Failed to create gallery listing:", err);
    }
  }

  /** Add course to gallery — uses PATCH if share exists, POST if not */
  function addToGallery(course: GalleryCourse) {
    if (course.shares.length > 0) {
      updateShare(course.shares[0].id, { isGalleryListed: true });
    } else {
      createGalleryListing(course.id);
    }
  }

  async function handleCloneConflictAction(action: "replace" | "add") {
    if (!cloneConflict) return;
    const { identifier, mode } = cloneConflict;
    setCloneConflict(null);

    if (mode === "patch") {
      await updateShare(identifier, { isGalleryListed: true, cloneConflictAction: action });
    } else {
      await createGalleryListing(identifier, { cloneConflictAction: action });
    }
  }

  function getGalleryShare(course: GalleryCourse): GalleryShareInfo | null {
    return course.shares.find((s) => s.isGalleryListed) ?? course.shares[0] ?? null;
  }

  function startEditTags(share: GalleryShareInfo) {
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
    const subjects = [...new Set(courses.flatMap((c) => parseSubjects(c.subject)))].sort();
    const languages = [...new Set(courses.map((c) => c.language).filter(Boolean))].sort();
    const difficulties = [...new Set(courses.map((c) => c.difficulty))].sort();
    return { subjects, languages, difficulties };
  }, [courses]);

  // Client-side filtering
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (subjectFilter !== "all" && !parseSubjects(course.subject).includes(subjectFilter)) return false;
      if (languageFilter !== "all" && course.language !== languageFilter) return false;
      if (difficultyFilter !== "all" && course.difficulty !== difficultyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = course.title.toLowerCase().includes(q);
        const matchTopic = course.topic.toLowerCase().includes(q);
        const matchOwner = (course.user.name || course.user.email || "").toLowerCase().includes(q);
        if (!matchTitle && !matchTopic && !matchOwner) return false;
      }
      return true;
    });
  }, [courses, search, subjectFilter, languageFilter, difficultyFilter]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (courses.length === 0) {
    return <p className="text-muted-foreground">{t("admin:gallery.noCourses")}</p>;
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
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("admin:gallery.allLanguages")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:gallery.allLanguages")}</SelectItem>
            {filterOptions.languages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANGUAGE_NAMES[lang] ?? lang}
              </SelectItem>
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
              <th className="text-left p-3 font-medium">{t("admin:gallery.language")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.eligibility")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.galleryStatus")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.stars")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.clones")}</th>
              <th className="text-left p-3 font-medium">{t("admin:gallery.tags")}</th>
              <th className="text-left p-3 font-medium">{t("admin:accessCodes.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map((course) => {
              const galleryShare = getGalleryShare(course);
              const isListed = course.shares.some((s) => s.isGalleryListed);
              const listedShare = course.shares.find((s) => s.isGalleryListed);
              const featuredAt = listedShare?.featuredAt ?? null;

              return (
                <tr key={course.id} className="border-t">
                  <td className="p-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <a href={`/courses/${course.id}`} target="_blank" rel="noopener noreferrer"
                           className="font-medium hover:underline text-primary">
                          {course.title}
                        </a>
                        {course.clonedFromId && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {t("admin:gallery.cloned")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {parseSubjects(course.subject).join(", ")} / {course.topic} / {course.difficulty}
                      </p>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {course.user.name || course.user.email || "\u2014"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {LANGUAGE_NAMES[course.language] ?? course.language ?? "\u2014"}
                  </td>
                  <td className="p-3">
                    {course.eligibility.isEligible ? (
                      <Badge variant="default">{t("admin:gallery.eligible")}</Badge>
                    ) : (
                      <div>
                        <Badge variant="destructive">{t("admin:gallery.notEligible")}</Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("admin:gallery.lessonsGenerated", {
                            generated: course.eligibility.generatedLessons,
                            total: course.eligibility.totalLessons,
                          })}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {isListed ? (
                        <Badge variant="default">{t("admin:gallery.listed")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("admin:gallery.notListed")}</Badge>
                      )}
                      {featuredAt && (
                        <Badge variant="secondary">{t("admin:gallery.featured")}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 tabular-nums">
                    {galleryShare?.starCount ?? 0}
                  </td>
                  <td className="p-3 tabular-nums">
                    {galleryShare?.cloneCount ?? 0}
                  </td>
                  <td className="p-3">
                    {galleryShare ? (
                      editingTags === galleryShare.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            className="h-7 text-xs w-32"
                            placeholder="math, calc"
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveTags(galleryShare.id)}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditTags(galleryShare)}
                        >
                          {t("admin:gallery.editTags")}
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {isListed && listedShare ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateShare(listedShare.id, { isGalleryListed: false })}
                          >
                            {t("admin:gallery.removeFromGallery")}
                          </Button>
                          {featuredAt ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateShare(listedShare.id, { featuredAt: null })}
                            >
                              {t("admin:gallery.unfeature")}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateShare(listedShare.id, { featuredAt: new Date().toISOString() })
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
                          disabled={!course.eligibility.isEligible && callerRole !== "owner"}
                          onClick={() => addToGallery(course)}
                          title={!course.eligibility.isEligible && callerRole !== "owner" ? t("admin:gallery.notEligible") : ""}
                        >
                          {course.shares.length > 0
                            ? t("admin:gallery.addToGallery")
                            : t("admin:gallery.createShare")}
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
