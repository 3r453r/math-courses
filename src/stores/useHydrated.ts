"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "./appStore";

/**
 * Hook that returns true once Zustand's persist middleware has finished
 * hydrating from localStorage. Use this to prevent redirect/render races
 * where the initial (null) state would trigger a redirect to /setup
 * before the stored API key is loaded.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // persist API is only available on the client
    const persist = useAppStore.persist;
    if (!persist) {
      // No persist middleware (shouldn't happen, but be safe)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHydrated(true);
      return;
    }
    if (persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  return hydrated;
}
