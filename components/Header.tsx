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
      className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 pl-14 pr-6 md:px-6 py-3 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="flex items-center gap-4"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        {children}
        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="hidden md:flex h-10 w-64 items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3">
              <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 ml-2"
              />
            </div>
          )}
          {showNotifications && (
            <button className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">
                notifications
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
