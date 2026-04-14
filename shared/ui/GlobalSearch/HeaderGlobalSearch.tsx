import React, { useEffect, useRef, useState } from "react";
import { GlobalSearch } from "./GlobalSearch";

/**
 * Wrapper stylující GlobalSearch jako původní Header "Search..." pole.
 * Vlastní kontejner obsahuje ikonu lupy vlevo, input ve středu a Ctrl+K kbd
 * napravo. Dropdown s výsledky se rozbaluje pod inputem (absolutně poziciovaný).
 */
export const HeaderGlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="hidden md:block">
      <div className="flex h-10 w-64 items-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px] mr-2">
          search
        </span>
        <GlobalSearch
          variant="dropdown"
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          placeholder="Hledat…"
        />
        <kbd className="ml-2 hidden lg:inline text-[10px] text-slate-400 dark:text-slate-500 font-mono px-1.5 py-0.5 rounded border border-slate-300/60 dark:border-slate-600/60 shrink-0">
          Ctrl K
        </kbd>
      </div>
    </div>
  );
};
