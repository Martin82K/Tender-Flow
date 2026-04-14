import React from "react";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchResult, SearchResultGroup } from "./types";

interface SearchResultsListProps {
  groups: SearchResultGroup[];
  query: string;
  activeIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (flatIndex: number) => void;
  listboxId: string;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  groups,
  query,
  activeIndex,
  onSelect,
  onHover,
  listboxId,
}) => {
  let flatIndex = -1;
  return (
    <div id={listboxId} role="listbox" className="flex flex-col gap-2 py-1">
      {groups.map((group) => (
        <div key={group.category} className="flex flex-col">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.label}
          </div>
          <div className="flex flex-col">
            {group.items.map((item) => {
              flatIndex += 1;
              const myIndex = flatIndex;
              return (
                <SearchResultItem
                  key={item.id}
                  id={`gs-option-${myIndex}`}
                  result={item}
                  query={query}
                  isActive={myIndex === activeIndex}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => onHover(myIndex)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
