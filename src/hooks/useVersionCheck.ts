import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useVersionCheck() {
  const { t } = useTranslation("common");
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const clientBuildId = process.env.NEXT_PUBLIC_BUILD_ID;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId: serverBuildId } = await res.json();
        if (serverBuildId && clientBuildId && serverBuildId !== clientBuildId) {
          if (toastIdRef.current) return; // Already showing
          toastIdRef.current = toast(t("newVersionAvailable"), {
            description: t("newVersionRefresh"),
            duration: Infinity,
            action: {
              label: t("refresh"),
              onClick: () => window.location.reload(),
            },
            onDismiss: () => {
              toastIdRef.current = null;
            },
          });
        }
      } catch {
        // Network error — ignore silently
      }
    }

    // Check immediately on mount (no delay)
    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // pageshow fires on iOS Safari bfcache restore (visibilitychange misses it)
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        checkVersion();
      }
    }
    window.addEventListener("pageshow", onPageShow);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [t]);
}
