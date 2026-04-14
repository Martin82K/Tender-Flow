import { useEffect } from "react";

/**
 * Globální Ctrl+K / Cmd+K listener pro otevření search modalu.
 * Ignoruje opakované stisky (e.repeat). Funguje i když je focus v jiném inputu.
 */
export const useGlobalSearchHotkey = (onTrigger: () => void): void => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const isKComboKey = e.key.toLowerCase() === "k";
      const comboPressed = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
      if (isKComboKey && comboPressed) {
        e.preventDefault();
        e.stopPropagation();
        onTrigger();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onTrigger]);
};
