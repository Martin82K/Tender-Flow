import React, { useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  children,
  onSearchChange,
  searchPlaceholder = "Search...",
  showSearch = true,
  showNotifications = true,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange?.(query);
  };

  return (
    <header
      className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 dark:border-slate-800 pl-14 pr-6 md:px-8 py-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shrink-0 select-none shadow-sm"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <h1 className="text-slate-900 dark:text-white text-lg font-extrabold tracking-tight leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-normal truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="flex items-center gap-4"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        {children}
        <div className="flex items-center gap-3">
          {showSearch && (
            <div className="hidden md:flex h-10 w-64 items-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400/70 ml-2"
              />
            </div>
          )}
          {showNotifications && (
            <button className="relative flex items-center justify-center size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md transition-all">
              <span className="material-symbols-outlined text-[20px]">
                notifications
              </span>
              <span className="absolute top-2.5 right-2.5 size-2 bg-primary rounded-full ring-2 ring-white dark:ring-slate-800"></span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
