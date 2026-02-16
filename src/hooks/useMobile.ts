import { useState, useEffect } from "react";

export function useMobile(): { isMobile: boolean; isTablet: boolean } {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)"
    );

    setIsMobile(mobileQuery.matches);
    setIsTablet(tabletQuery.matches);

    function onMobileChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    function onTabletChange(e: MediaQueryListEvent) {
      setIsTablet(e.matches);
    }

    mobileQuery.addEventListener("change", onMobileChange);
    tabletQuery.addEventListener("change", onTabletChange);
    return () => {
      mobileQuery.removeEventListener("change", onMobileChange);
      tabletQuery.removeEventListener("change", onTabletChange);
    };
  }, []);

  return { isMobile, isTablet };
}
