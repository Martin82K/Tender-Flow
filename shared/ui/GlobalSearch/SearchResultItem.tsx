import React from "react";
import { normalize } from "./searchEngine";
import type { SearchResult } from "./types";

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  id: string;
}

/**
 * Highlight matched tokens in text by wrapping them in <mark>.
 * Matching is diacritic-insensitive but preserves original casing/diacritics in output.
 */
const highlight = (text: string, query: string): React.ReactNode => {
  if (!text || !query.trim()) return text;
  const tokens = Array.from(
    new Set(
      normalize(query)
        .split(/[\s.,;]+/)
        .filter((t) => t.length >= 1),
    ),
  );
  if (tokens.length === 0) return text;

  const normalizedText = normalize(text);
  const ranges: Array<[number, number]> = [];
  for (const tok of tokens) {
    let from = 0;
    while (from < normalizedText.length) {
      const idx = normalizedText.indexOf(tok, from);
      if (idx === -1) break;
      ranges.push([idx, idx + tok.length]);
      from = idx + tok.length;
    }
  }
  if (ranges.length === 0) return text;

  // Merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark
        key={i}
        className="bg-primary/20 text-primary dark:text-primary rounded px-0.5"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
};

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  query,
  isActive,
  onClick,
  onMouseEnter,
  id,
}) => {
  return (
    <button
      id={id}
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => e.preventDefault()}
      className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors rounded-lg ${
        isActive
          ? "bg-primary/10 text-slate-900 dark:text-white"
          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
      }`}
    >
      <span
        className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${
          isActive ? "text-primary" : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {result.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {highlight(result.title, query)}
        </div>
        {result.subtitle && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {highlight(result.subtitle, query)}
          </div>
        )}
      </div>
      {isActive && (
        <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 mt-1 shrink-0">
          keyboard_return
        </span>
      )}
    </button>
  );
};
