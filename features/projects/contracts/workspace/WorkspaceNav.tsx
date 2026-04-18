import React from 'react';

export type WorkspaceSectionId =
  | 'hlavicka'
  | 'ocr'
  | 'finance'
  | 'dodatky'
  | 'faktury'
  | 'cerpani'
  | 'poz'
  | 'zaruka';

export interface WorkspaceSection {
  id: WorkspaceSectionId;
  label: string;
  badge?: number;
}

interface Props {
  sections: WorkspaceSection[];
  active: WorkspaceSectionId;
  onNavigate: (id: WorkspaceSectionId) => void;
}

export const WorkspaceNav: React.FC<Props> = ({ sections, active, onNavigate }) => (
  <nav className="bg-slate-950/60 border-r border-slate-800 p-3 flex flex-col gap-1 overflow-y-auto">
    {sections.map((s) => (
      <button
        key={s.id}
        type="button"
        onClick={() => onNavigate(s.id)}
        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium flex items-center gap-2 transition ${
          active === s.id
            ? 'bg-primary/15 text-primary'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        <span>{s.label}</span>
        {s.badge !== undefined && s.badge > 0 && (
          <span
            className={`ml-auto rounded-full px-1.5 text-[10px] ${
              active === s.id ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {s.badge}
          </span>
        )}
      </button>
    ))}
  </nav>
);
