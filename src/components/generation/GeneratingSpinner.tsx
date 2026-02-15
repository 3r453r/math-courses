"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function GeneratingSpinner() {
  const { t } = useTranslation("generation");
  const words = t("funWords", { returnObjects: true }) as string[];

  const shuffled = useMemo(() => shuffle(words), [words]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setVisible(false);

      // After fade-out, change word and fade in
      setTimeout(() => {
        setIndex((i) => (i + 1) % shuffled.length);
        setVisible(true);
      }, 300);
    }, 2500);

    return () => clearInterval(interval);
  }, [shuffled.length]);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="animate-spin">&#9696;</span>
      <span
        className="transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {shuffled[index]}
      </span>
    </span>
  );
}
