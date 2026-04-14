import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { GlobalSearch } from "./GlobalSearch";
import { useGlobalSearchContext } from "./GlobalSearchContext";
import { useGlobalSearchHotkey } from "./useGlobalSearchHotkey";

/**
 * Full-screen command palette otevíraný Ctrl+K / Cmd+K.
 * Listener je zaregistrován globálně přes `useGlobalSearchHotkey`.
 */
export const GlobalSearchModal: React.FC = () => {
  const ctx = useGlobalSearchContext();
  const isOpen = ctx?.isModalOpen ?? false;
  const close = ctx?.closeModal ?? (() => {});
  const open = ctx?.openModal ?? (() => {});

  useGlobalSearchHotkey(open);

  // Body scroll lock while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!ctx || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Globální vyhledávání"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <GlobalSearch
          variant="modal"
          isOpen
          onOpenChange={(o) => {
            if (!o) close();
          }}
          autoFocus
          onDismiss={close}
        />
      </div>
    </div>,
    document.body,
  );
};
