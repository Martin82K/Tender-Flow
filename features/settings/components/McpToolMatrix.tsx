import React from "react";

interface McpToolMatrixProps {
  contactsActive: boolean;
  writeActive: boolean;
}

interface PermissionGroup {
  title: string;
  description: string;
  state: (contactsActive: boolean, writeActive: boolean) => string;
  active: (contactsActive: boolean, writeActive: boolean) => boolean;
}

const permissionGroups: PermissionGroup[] = [
  {
    title: "Základní čtení",
    description: "Stavby, poptávky, termíny a vlastní úkoly v rozsahu přihlášeného uživatele.",
    state: () => "Aktivní",
    active: () => true,
  },
  {
    title: "Kontaktní a dodavatelská data",
    description: "Kontakty, detail nabídek a bezpečné párování odpovědí z Outlooku.",
    state: (contactsActive) => contactsActive ? "Aktivní" : "Vyžaduje kontaktní údaje",
    active: (contactsActive) => contactsActive,
  },
  {
    title: "Zápisové operace",
    description: "Úkoly a kanban přes potvrzované návrhy; Outlook vazby jako omezený metadata zápis.",
    state: (_contactsActive, writeActive) => writeActive
      ? "Zápisové operace povoleny"
      : "Vyžaduje zápis",
    active: (_contactsActive, writeActive) => writeActive,
  },
];

export const McpToolMatrix: React.FC<McpToolMatrixProps> = ({ contactsActive, writeActive }) => (
  <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
    <h4 className="font-semibold text-slate-900 dark:text-white">Skupiny oprávnění</h4>
    <p className="mt-1 max-w-3xl text-sm text-slate-500">
      Konkrétní nástroje publikuje vzdálený MCP server. Tender Flow spravuje jen stabilní skupiny
      oprávnění, takže přidání podporovaného nástroje nevyžaduje nový build aplikace.
    </p>

    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {permissionGroups.map((group) => {
        const isEnabled = group.active(contactsActive, writeActive);
        return (
          <div key={group.title} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <p className="font-semibold text-slate-900 dark:text-white">{group.title}</p>
            <p className="mt-1 text-sm text-slate-500">{group.description}</p>
            <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              isEnabled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}>
              {group.state(contactsActive, writeActive)}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);
