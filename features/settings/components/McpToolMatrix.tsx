import React from "react";
import { MCP_PERMISSION_IDS, MCP_TOOL_CATALOG } from "@/shared/mcp/toolCatalog.js";

interface McpToolMatrixProps {
  contactsActive: boolean;
  writeActive: boolean;
}

const getToolState = (
  requiredPermissions: readonly string[],
  contactsActive: boolean,
  writeActive: boolean,
): { label: string; classes: string; active: boolean } => {
  if (requiredPermissions.includes(MCP_PERMISSION_IDS.write)) {
    return writeActive
      ? {
          label: "Aktivní",
          classes: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200",
          active: true,
        }
      : {
          label: "Vyžaduje zápis",
          classes: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
          active: false,
        };
  }

  if (requiredPermissions.includes(MCP_PERMISSION_IDS.contactsRead)) {
    return contactsActive
      ? {
          label: "Aktivní",
          classes: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200",
          active: true,
        }
      : {
          label: "Vyžaduje kontaktní údaje",
          classes: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
          active: false,
        };
  }

  return {
    label: "Aktivní",
    classes: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    active: true,
  };
};

export const McpToolMatrix: React.FC<McpToolMatrixProps> = ({ contactsActive, writeActive }) => {
  const states = MCP_TOOL_CATALOG.map((tool) => ({
    tool,
    state: getToolState(tool.requiredPermissions, contactsActive, writeActive),
  }));
  const activeCount = states.filter(({ state }) => state.active).length;

  return (
    <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">Přehled dostupných nástrojů</h4>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Matice vychází ze stejného katalogu jako serverová kontrola oprávnění. Každý nástroj navíc
            respektuje vaše role, členství projektu a databázové RLS.
          </p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {activeCount} z {MCP_TOOL_CATALOG.length} aktivních
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Nástroj</th>
              <th className="px-4 py-3 font-semibold">Data a účel</th>
              <th className="px-4 py-3 font-semibold">Režim</th>
              <th className="px-4 py-3 font-semibold">Potvrzení</th>
              <th className="px-4 py-3 font-semibold">Stav</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {states.map(({ tool, state }) => (
              <tr key={tool.name} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{tool.title}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{tool.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{tool.category}</p>
                </td>
                <td className="max-w-md px-4 py-3 text-slate-600 dark:text-slate-300">{tool.data}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {tool.mode === "write" ? "Zápis" : "Čtení"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {tool.mode === "write" ? "3 kroky + audit" : "Bez dalšího potvrzení"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${state.classes}`}>
                    {state.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
