"use client";

import { useAppStore } from "@/stores/appStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useApiKey(redirectIfMissing = true) {
  const apiKey = useAppStore((s) => s.apiKey);
  const router = useRouter();

  useEffect(() => {
    if (redirectIfMissing && !apiKey) {
      router.push("/setup");
    }
  }, [apiKey, redirectIfMissing, router]);

  return apiKey;
}
