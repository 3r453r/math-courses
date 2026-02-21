"use client";

import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];

interface GalleryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedSubjects: string[];
  onSubjectsChange: (values: string[]) => void;
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
  selectedSubjects,
  onSubjectsChange,
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

  const sortedDifficulties = [...difficulties].sort(
    (a, b) => (DIFFICULTY_ORDER.indexOf(a) ?? 99) - (DIFFICULTY_ORDER.indexOf(b) ?? 99)
  );

  function toggleSubject(s: string) {
    if (selectedSubjects.includes(s)) {
      onSubjectsChange(selectedSubjects.filter((x) => x !== s));
    } else {
      onSubjectsChange([...selectedSubjects, s]);
    }
  }

  const subjectLabel =
    selectedSubjects.length === 0
      ? t("gallery:filters.allSubjects")
      : selectedSubjects.length === 1
        ? selectedSubjects[0]
        : t("gallery:filters.subjectsSelected", { count: selectedSubjects.length });

  return (
    <div className="flex flex-wrap gap-3 items-center w-full">
      <Input
        placeholder={t("gallery:search")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full sm:w-64"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full sm:w-44 justify-between font-normal">
            <span className="truncate">{subjectLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52 max-h-72 overflow-y-auto">
          {selectedSubjects.length > 0 && (
            <>
              <DropdownMenuItem
                onSelect={() => onSubjectsChange([])}
                className="text-muted-foreground text-xs"
              >
                {t("gallery:filters.clearSubjects")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {subjects.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={selectedSubjects.includes(s)}
              onCheckedChange={() => toggleSubject(s)}
              onSelect={(e) => e.preventDefault()}
            >
              {s}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={language} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-full sm:w-40">
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
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder={t("gallery:filters.allDifficulties")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("gallery:filters.allDifficulties")}</SelectItem>
          {sortedDifficulties.map((d) => (
            <SelectItem key={d} value={d} className="capitalize">
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-full sm:w-40">
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
