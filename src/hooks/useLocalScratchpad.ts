"use client";

import { useState, useEffect } from "react";

export function useLocalScratchpad(key: string) {
  const storageKey = `preview-scratchpad-${key}`;
  const [content, setContent] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setContent(saved);
  }, [storageKey]);

  function updateContent(value: string) {
    setContent(value);
    localStorage.setItem(storageKey, value);
  }

  return { content, setContent: updateContent };
}
