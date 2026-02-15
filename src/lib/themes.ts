export type ColorThemeId = "neutral" | "ocean" | "sage" | "amber";

export interface ColorTheme {
  id: ColorThemeId;
  label: string;
  labelPl: string;
  /** Tailwind bg class for the preview swatch */
  preview: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: "neutral", label: "Neutral", labelPl: "Neutralny", preview: "bg-zinc-500" },
  { id: "ocean", label: "Ocean", labelPl: "Ocean", preview: "bg-blue-500" },
  { id: "sage", label: "Sage", labelPl: "Szałwia", preview: "bg-emerald-500" },
  { id: "amber", label: "Amber", labelPl: "Bursztyn", preview: "bg-amber-500" },
];
