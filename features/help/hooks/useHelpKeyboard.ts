import { useEffect } from "react";
import type { HelpContextValue } from "../types";

export function useHelpKeyboard(help: HelpContextValue) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F1 toggles help mode
      if (e.key === "F1") {
        e.preventDefault();
        help.toggle();
        return;
      }

      if (!help.isActive) return;

      // Escape closes help mode
      if (e.key === "Escape") {
        e.preventDefault();
        help.deactivate();
        return;
      }

      // Arrow keys for tour navigation
      if (help.isTourActive) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          help.nextTourStep();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          help.prevTourStep();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [help]);
}
