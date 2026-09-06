import { useEffect, useState } from "react";

const TASKS_DESKTOP_BREAKPOINT = 1024;

const TASKS_DESKTOP_MEDIA_QUERY = `(min-width: ${TASKS_DESKTOP_BREAKPOINT}px)`;

const getIsTasksMobileLayout = (): boolean => {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return !window.matchMedia(TASKS_DESKTOP_MEDIA_QUERY).matches;
  }
  return window.innerWidth < TASKS_DESKTOP_BREAKPOINT;
};

export const useIsTasksMobileLayout = (): boolean => {
  const [isMobileLayout, setIsMobileLayout] = useState(getIsTasksMobileLayout);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => setIsMobileLayout(getIsTasksMobileLayout());

    if (typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia(TASKS_DESKTOP_MEDIA_QUERY);
      update();
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", update);
        return () => mediaQuery.removeEventListener("change", update);
      }

      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobileLayout;
};
