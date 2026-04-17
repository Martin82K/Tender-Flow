import { useEffect, useCallback } from "react";
import { useHelpDiscoverySetter } from "../context/HelpContext";
import type { DiscoveredElement } from "../types";

function scanElements(): DiscoveredElement[] {
  const nodes = document.querySelectorAll<HTMLElement>("[data-help-id]");
  const results: DiscoveredElement[] = [];
  nodes.forEach((el) => {
    const helpId = el.getAttribute("data-help-id");
    if (helpId) {
      results.push({
        helpId,
        rect: el.getBoundingClientRect(),
        element: el,
      });
    }
  });
  return results;
}

export function useHelpDiscovery(isActive: boolean) {
  const setDiscovered = useHelpDiscoverySetter();

  const rescan = useCallback(() => {
    if (!isActive) return;
    setDiscovered(scanElements());
  }, [isActive, setDiscovered]);

  useEffect(() => {
    if (!isActive) {
      setDiscovered([]);
      return;
    }

    // Initial scan (with small delay for DOM to settle after help mode activation)
    const initialTimer = setTimeout(rescan, 50);

    // Rescan on scroll and resize
    let rafId: number | null = null;
    const throttledRescan = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rescan();
        rafId = null;
      });
    };

    window.addEventListener("scroll", throttledRescan, true);
    window.addEventListener("resize", throttledRescan);

    // MutationObserver for dynamic content
    const observer = new MutationObserver(throttledRescan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-help-id"],
    });

    return () => {
      clearTimeout(initialTimer);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", throttledRescan, true);
      window.removeEventListener("resize", throttledRescan);
      observer.disconnect();
    };
  }, [isActive, rescan, setDiscovered]);
}
