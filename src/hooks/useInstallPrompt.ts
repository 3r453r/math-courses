"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __deferredInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

// --- Shared singleton for beforeinstallprompt event ---

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getHasPrompt() {
  return deferredPrompt !== null;
}
function getServerSnapshot() {
  return false;
}

if (typeof window !== "undefined") {
  if (window.__deferredInstallPrompt) {
    deferredPrompt = window.__deferredInstallPrompt;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.__deferredInstallPrompt = deferredPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.__deferredInstallPrompt = null;
    notify();
  });
}

// --- Public API ---

export async function promptInstall(
  fallbackMessage: string
): Promise<"accepted" | "dismissed" | "fallback"> {
  if (deferredPrompt) {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      window.__deferredInstallPrompt = null;
      notify();
    }
    return outcome;
  }
  // No native prompt available — show browser-specific instructions
  toast.info(fallbackMessage, { duration: 8000 });
  return "fallback";
}

let toastShown = false;

export function useInstallPrompt() {
  const hasNativePrompt = useSyncExternalStore(
    subscribe,
    getHasPrompt,
    getServerSnapshot
  );
  const { t } = useTranslation("common");
  const dismissed = useAppStore((s) => s.installPromptDismissed);
  const setDismissed = useAppStore((s) => s.setInstallPromptDismissed);

  const [isStandalone, setIsStandalone] = useState(false);

  // Register service worker + detect standalone mode
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Record<string, unknown>).standalone === true
    );
  }, []);

  // Show toast when native install becomes available
  useEffect(() => {
    if (!hasNativePrompt || dismissed || toastShown || isStandalone) return;

    toastShown = true;
    const timer = setTimeout(() => {
      toast(t("installAppDescription"), {
        duration: 15000,
        action: {
          label: t("install"),
          onClick: () => promptInstall(t("installAppFallback")),
        },
        onDismiss: () => setDismissed(true),
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasNativePrompt, dismissed, isStandalone, t, setDismissed]);

  return { isStandalone, hasNativePrompt };
}
