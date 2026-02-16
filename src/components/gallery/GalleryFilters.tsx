"use client";

import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";

interface GalleryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  difficulty: string;
  onDifficultyChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  subjects: string[];
  languages: string[];
  difficulties: string[];
}

export function GalleryFilters({
  search,
  onSearchChange,
  subject,
  onSubjectChange,
  language,
  onLanguageChange,
  difficulty,
  onDifficultyChange,
  sort,
  onSortChange,
  subjects,
  languages,
  difficulties,
}: GalleryFiltersProps) {
  const { t } = useTranslation(["gallery"]);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Input
        placeholder={t("gallery:search")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64"
      />

      <Select value={subject} onValueChange={onSubjectChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("gallery:filters.allSubjects")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("gallery:filters.allSubjects")}</SelectItem>
          {subjects.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={language} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("gallery:filters.allLanguages")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("gallery:filters.allLanguages")}</SelectItem>
          {languages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {LANGUAGE_NAMES[lang] ?? lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={difficulty} onValueChange={onDifficultyChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("gallery:filters.allDifficulties")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("gallery:filters.allDifficulties")}</SelectItem>
          {difficulties.map((d) => (
            <SelectItem key={d} value={d} className="capitalize">
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">{t("gallery:filters.sortRecent")}</SelectItem>
          <SelectItem value="stars">{t("gallery:filters.sortStars")}</SelectItem>
          <SelectItem value="clones">{t("gallery:filters.sortClones")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
