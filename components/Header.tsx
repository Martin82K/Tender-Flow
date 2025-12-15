import React, { useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, children, onSearchChange, searchPlaceholder = "Search..." }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange?.(query);
  };

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-6 py-4 bg-white/80 dark:bg-background-dark/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {children}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex h-10 w-64 items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3">
            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-500 ml-2"
            />
          </div>
          <button className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
};