import React, { useEffect, useMemo, useState } from "react";
import { rolePermissionsService, type OrganizationRolePermissionRow } from "../api";
import {
  PROJECT_PERMISSION_AREAS,
  PROJECT_PERMISSION_LEVEL_LABELS,
  PROJECT_TEAM_ROLE_LABELS,
  PROJECT_TEAM_ROLES,
  type ProjectPermissionLevel,
} from "@shared/authorization/projectRoles";
import type { ProjectTeamRole } from "@/types";
import { ThemedSelect } from "@shared/ui/ThemedSelect";

interface OrgRolePermissionsTabProps {
  orgId: string;
  isAdminOrOwner: boolean;
}

const cellKey = (role: ProjectTeamRole, permission: string) => `${role}:${permission}`;

const permissionLevelOptions = Object.entries(PROJECT_PERMISSION_LEVEL_LABELS) as [
  ProjectPermissionLevel,
  string,
][];

export const OrgRolePermissionsTab: React.FC<OrgRolePermissionsTabProps> = ({
  orgId,
  isAdminOrOwner,
}) => {
  const [rows, setRows] = useState<OrganizationRolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    rolePermissionsService.list(orgId)
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Matici se nepodařilo načíst.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orgId]);

  const values = useMemo(
    () => new Map(rows.map((row) => [cellKey(row.roleKey, row.permissionKey), row])),
    [rows],
  );

  const save = async (
    roleKey: ProjectTeamRole,
    permissionKey: string,
    accessLevel: ProjectPermissionLevel,
    canApprove: boolean,
  ) => {
    const key = cellKey(roleKey, permissionKey);
    setSavingKey(key);
    try {
      await rolePermissionsService.set({ orgId, roleKey, permissionKey, accessLevel, canApprove });
      setRows((current) => {
        const mutuallyExclusiveKey = permissionKey === "contract_overview.organization"
          ? "contract_overview.project_team"
          : permissionKey === "contract_overview.project_team"
            ? "contract_overview.organization"
            : null;
        const next = current.filter((row) => cellKey(row.roleKey, row.permissionKey) !== key);
        if (accessLevel === "read" && mutuallyExclusiveKey) {
          const otherKey = cellKey(roleKey, mutuallyExclusiveKey);
          const withoutOther = next.filter((row) => cellKey(row.roleKey, row.permissionKey) !== otherKey);
          withoutOther.push({ roleKey, permissionKey: mutuallyExclusiveKey, accessLevel: "none", canApprove: false });
          withoutOther.push({ roleKey, permissionKey, accessLevel, canApprove });
          return withoutOther;
        }
        return [...next, { roleKey, permissionKey, accessLevel, canApprove }];
      });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Oprávnění se nepodařilo uložit.");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Načítám matici rolí…</div>;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4" data-help-id="organization-role-permissions">
      <div className="shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Role a oprávnění</h2>
        <p className="mt-1 text-sm text-slate-500">
          Centrální matice profesních rolí realizačního týmu. „K rozhodnutí“ nemění současné chování aplikace.
          Schvalování je samostatné a nikdy se neuděluje automaticky se zápisem.
        </p>
      </div>
      {!isAdminOrOwner && (
        <div className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          Matici můžete zobrazit, ale měnit ji může pouze vlastník nebo administrátor organizace.
        </div>
      )}
      {error && (
        <div role="alert" className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="tf-role-permissions-scroll min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-[1460px] space-y-5 p-3">
          {PROJECT_PERMISSION_AREAS.map((area) => (
            <div key={area.key} className="overflow-clip rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{area.label}</h3>
              </div>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                    <th className="sticky left-0 top-0 z-30 w-48 min-w-48 bg-slate-50 px-4 py-3 dark:bg-slate-800">Podsekce</th>
                    <th className="sticky left-48 top-0 z-30 w-60 min-w-60 border-r border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">Akce</th>
                    {PROJECT_TEAM_ROLES.map((role) => (
                      <th key={role} className="sticky top-0 z-20 w-36 min-w-36 bg-slate-50 px-3 py-3 dark:bg-slate-800">
                        {PROJECT_TEAM_ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {area.sections.map((section) => section.actions.map((action, actionIndex) => (
                    <tr key={action.key} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                      {actionIndex === 0 && (
                        <th
                          scope="rowgroup"
                          rowSpan={section.actions.length}
                          className="sticky left-0 z-10 w-48 min-w-48 bg-slate-50/95 px-4 py-3 text-left align-top text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/95 dark:text-slate-300"
                        >
                          {section.label}
                        </th>
                      )}
                      <th
                        scope="row"
                        className="sticky left-48 z-10 w-60 min-w-60 border-r border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {action.label}
                        {action.hint && (
                          <span className="mt-1 block text-xs font-normal leading-snug text-slate-500 dark:text-slate-400">
                            {action.hint}
                          </span>
                        )}
                      </th>
                      {PROJECT_TEAM_ROLES.map((role) => {
                        const key = cellKey(role, action.key);
                        const value = values.get(key);
                        return (
                          <td key={role} className="px-3 py-2">
                            <ThemedSelect
                              ariaLabel={`${PROJECT_TEAM_ROLE_LABELS[role]} – ${action.label}`}
                              disabled={!isAdminOrOwner || savingKey === key}
                              value={value?.accessLevel || ""}
                              onChange={(nextValue) => {
                                if (!nextValue) return;
                                void save(role, action.key, nextValue as ProjectPermissionLevel, value?.canApprove || false);
                              }}
                              options={[
                                { value: "", label: "K rozhodnutí" },
                                ...permissionLevelOptions
                                .filter(([level]) => !action.allowedLevels || action.allowedLevels.includes(level))
                                .map(([level, label]) => ({ value: level, label })),
                              ]}
                            />
                            {action.supportsApproval && (
                              <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                <input
                                  type="checkbox"
                                  disabled={!isAdminOrOwner || !value || savingKey === key}
                                  checked={value?.canApprove || false}
                                  onChange={(event) => {
                                    if (!value) return;
                                    void save(role, action.key, value.accessLevel, event.target.checked);
                                  }}
                                />
                                Schvalování
                              </label>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
