"use client";

import { useAppStore } from "@/stores/appStore";
import { COLOR_THEMES } from "@/lib/themes";
import type { ColorThemeId } from "@/lib/themes";

export function ColorThemeSelector() {
  const colorTheme = useAppStore((s) => s.colorTheme);
  const setColorTheme = useAppStore((s) => s.setColorTheme);

  return (
    <div className="flex gap-3">
      {COLOR_THEMES.map((theme) => (
        <button
          key={theme.id}
          onClick={() => setColorTheme(theme.id as ColorThemeId)}
          className={`
            size-8 rounded-full transition-all
            ${theme.preview}
            ${colorTheme === theme.id
              ? "ring-2 ring-ring ring-offset-2 ring-offset-background scale-110"
              : "hover:scale-105 opacity-70 hover:opacity-100"
            }
          `}
          title={theme.label}
        />
      ))}
    </div>
  );
}
