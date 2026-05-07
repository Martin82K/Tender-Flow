import React, { useState } from "react";
import { useAccountMenu } from "@/shared/ui/AccountMenuContext";
import { HeaderGlobalSearch } from "@/shared/ui/GlobalSearch";
import { renderIndustrialProjectTitle } from "@/shared/ui/brandedTitle";
import type { ThemeSkin } from "@/hooks/useTheme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /**
   * Optional legacy per-page filter callback. When provided, renders a local
   * filter input INSTEAD of the global search. New code should migrate filters
   * into the page body and rely on the global search in the Header.
   */
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  /** Slot for help button (rendered by caller) */
  helpSlot?: React.ReactNode;
  /** Slot for notification bell + dropdown (rendered by caller) */
  notificationSlot?: React.ReactNode;
  /** Hide account menu for nested toolbars that live inside another app header. */
  showAccountMenu?: boolean;
  /**
   * When true, render title/subtitle on a second row BELOW children (menu) so
   * long titles don't compete with the menu for horizontal space.
   */
  titleBelow?: boolean;
  /**
   * Renders title/context and actions in the first row, with children as a
   * second navigation row. Useful for dense project-level top bars.
   */
  childrenBelow?: boolean;
  /**
   * Optional custom title/context block. Keeps header actions/search intact
   * while allowing feature shells to render interactive context selectors.
   */
  titleSlot?: React.ReactNode;
  skin?: ThemeSkin;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  children,
  onSearchChange,
  searchPlaceholder = "Filtrovat…",
  showSearch = true,
  helpSlot,
  notificationSlot,
  showAccountMenu = true,
  titleBelow = false,
  childrenBelow = false,
  titleSlot,
  skin = "classic",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const accountMenu = useAccountMenu();
  const isIndustrialSkin = skin === "industrial";

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange?.(query);
  };

  const useLocalFilter = Boolean(onSearchChange);
  const titleClass = isIndustrialSkin
    ? "text-[#14110a] text-base font-extrabold tracking-tight leading-tight truncate"
    : "text-slate-900 dark:text-white text-base font-extrabold tracking-tight leading-tight truncate";
  const subtitleClass = isIndustrialSkin
    ? "text-[#6e6757] text-[11px] font-medium leading-normal truncate"
    : "text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-normal truncate";
  const searchBoxClass = isIndustrialSkin
    ? "hidden md:flex h-10 w-56 lg:w-72 items-center rounded-md bg-[#ece8de]/70 border border-[rgba(20,16,8,0.10)] px-3 focus-within:ring-2 focus-within:ring-[#ff8a33]/20 transition-all"
    : "hidden md:flex h-10 w-56 lg:w-72 items-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all";
  const searchBoxWideClass = isIndustrialSkin
    ? "hidden md:flex h-10 w-64 items-center rounded-md bg-[#ece8de]/70 border border-[rgba(20,16,8,0.10)] px-3 focus-within:ring-2 focus-within:ring-[#ff8a33]/20 transition-all"
    : "hidden md:flex h-10 w-64 items-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all";
  const searchInputClass = isIndustrialSkin
    ? "ml-2 min-w-0 flex-1 bg-transparent border-none focus:ring-0 text-sm text-[#14110a] placeholder-[#9c9684]"
    : "ml-2 min-w-0 flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400/70";
  const searchInputWideClass = isIndustrialSkin
    ? "ml-2 flex-1 bg-transparent border-none focus:ring-0 text-sm text-[#14110a] placeholder-[#9c9684]"
    : "flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400/70 ml-2";
  const headerChildrenBelowClass = isIndustrialSkin
    ? "tf-topbar whitespace-nowrap border-b border-[rgba(20,16,8,0.10)] pl-14 pr-3 sm:pr-4 md:px-6 pt-2 pb-0 bg-[#f6f4ee]/95 sticky top-0 z-30 shrink-0 select-none shadow-none"
    : "tf-topbar whitespace-nowrap border-b border-slate-200 dark:border-slate-800 pl-14 pr-3 sm:pr-4 md:px-6 pt-2 pb-0 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shrink-0 select-none shadow-sm";
  const headerTitleBelowClass = isIndustrialSkin
    ? "tf-topbar whitespace-nowrap border-b border-[rgba(20,16,8,0.10)] pl-14 pr-3 sm:pr-4 md:px-8 pt-3 pb-3 bg-[#f6f4ee]/95 sticky top-0 z-30 shrink-0 select-none shadow-none"
    : "tf-topbar whitespace-nowrap border-b border-slate-200 dark:border-slate-800 pl-14 pr-3 sm:pr-4 md:px-8 pt-3 pb-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shrink-0 select-none shadow-sm";
  const headerDefaultClass = isIndustrialSkin
    ? "tf-topbar flex items-center justify-between gap-3 whitespace-nowrap border-b border-[rgba(20,16,8,0.10)] pl-14 pr-3 sm:pr-4 md:px-8 py-4 bg-[#f6f4ee]/95 sticky top-0 z-30 shrink-0 select-none shadow-none"
    : "tf-topbar flex items-center justify-between gap-3 whitespace-nowrap border-b border-slate-200 dark:border-slate-800 pl-14 pr-3 sm:pr-4 md:px-8 py-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shrink-0 select-none shadow-sm";

  const titleBlock = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h1 className={titleClass} aria-label={title}>
        {renderIndustrialProjectTitle(title, isIndustrialSkin)}
      </h1>
      {subtitle && (
        <p className={subtitleClass}>
          {subtitle}
        </p>
      )}
    </div>
  );
  const renderedTitleBlock = titleSlot || titleBlock;

  const actionsBlock = (
    <div
      className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4"
      style={{ WebkitAppRegion: "no-drag" } as any}
    >
      {children}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {showSearch && (
          useLocalFilter ? (
            <div className={searchBoxWideClass}>
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px]">
                filter_list
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className={searchInputWideClass}
              />
            </div>
          ) : (
            <HeaderGlobalSearch />
          )
        )}
        {helpSlot}
        {notificationSlot}
        {showAccountMenu && accountMenu}
      </div>
    </div>
  );

  if (childrenBelow) {
    return (
      <header
        className={headerChildrenBelowClass}
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div className="flex min-w-0 items-center justify-between gap-2.5 pb-2">
          <div className="min-w-0 flex-1">
            {renderedTitleBlock}
          </div>
          <div
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {showSearch && (
              useLocalFilter ? (
                <div className={searchBoxClass}>
                  <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px]">
                    filter_list
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={searchPlaceholder}
                    className={searchInputClass}
                  />
                </div>
              ) : (
                <HeaderGlobalSearch />
              )
            )}
            {helpSlot}
            {notificationSlot}
            {showAccountMenu && accountMenu}
          </div>
        </div>
        {children && (
          <div
            className={`-mx-3 sm:-mx-4 md:-mx-6 border-t px-3 sm:px-4 md:px-6 py-1.5 overflow-x-auto ${isIndustrialSkin ? "border-[rgba(20,16,8,0.10)]" : "border-slate-200/70 dark:border-slate-800/70"}`}
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {children}
          </div>
        )}
      </header>
    );
  }

  if (titleBelow) {
    return (
      <header
        className={headerTitleBelowClass}
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div
            className="flex min-w-0 items-center gap-4"
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {children}
          </div>
          <div
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {showSearch && (
              useLocalFilter ? (
                <div className={searchBoxWideClass}>
                  <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px]">
                    filter_list
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={searchPlaceholder}
                    className={searchInputWideClass}
                  />
                </div>
              ) : (
                <HeaderGlobalSearch />
              )
            )}
            {helpSlot}
            {notificationSlot}
            {showAccountMenu && accountMenu}
          </div>
        </div>
        <div className="mt-5">
          {renderedTitleBlock}
        </div>
      </header>
    );
  }

  return (
    <header
      className={headerDefaultClass}
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="min-w-0 flex-1">
        {renderedTitleBlock}
      </div>
      {actionsBlock}
    </header>
  );
};
