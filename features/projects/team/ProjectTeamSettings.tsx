import React, { useCallback, useEffect, useMemo, useState } from "react";
import { organizationService, type OrganizationMember } from "@features/organization/api";
import { projectService } from "@/services/projectService";
import { PROJECT_TEAM_ROLE_LABELS } from "@shared/authorization/projectRoles";
import { ThemedSelect } from "@shared/ui/ThemedSelect";

interface ProjectTeamSettingsProps {
  projectId: string;
  organizationId?: string;
  currentUserId?: string;
  readOnly?: boolean;
}

export const ProjectTeamSettings: React.FC<ProjectTeamSettingsProps> = ({ projectId, organizationId, currentUserId, readOnly = false }) => {
  const [team, setTeam] = useState<Awaited<ReturnType<typeof projectService.getProjectTeam>>>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectTeam, members] = await Promise.all([
        projectService.getProjectTeam(projectId),
        organizationId ? organizationService.getOrganizationMembers(organizationId) : Promise.resolve([]),
      ]);
      setTeam(projectTeam);
      setOrgMembers(members.filter((member) => member.is_active));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tým se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, projectId]);

  useEffect(() => { void load(); }, [load]);
  const myAccess = team.find((member) => member.userId === currentUserId)?.accessKind;
  const canManage = !readOnly && myAccess === "system_owner";
  const candidates = useMemo(() => orgMembers.filter((member) => !team.some((teamMember) => teamMember.userId === member.user_id)), [orgMembers, team]);

  const addMember = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await projectService.setProjectTeamMember(projectId, selectedUserId);
      setSelectedUserId("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Člena se nepodařilo přidat."); }
    finally { setSaving(false); }
  };

  const removeMember = async (userId: string) => {
    setSaving(true);
    try { await projectService.removeProjectTeamMember(projectId, userId); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Člena se nepodařilo odebrat."); }
    finally { setSaving(false); }
  };

  return <section className="mx-auto w-full max-w-4xl space-y-5 p-6 lg:p-10">
    <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Realizační tým</h2><p className="mt-1 text-sm text-slate-500">Členství uložené zde řídí pouze přístup ke stavbě. Profesní role se spravuje centrálně v organizaci a schvalování se přiděluje samostatně.</p></div>
    {readOnly && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Archivovaná stavba je pouze ke čtení. Tým nelze měnit.</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {canManage && <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] dark:border-slate-700 dark:bg-slate-900">
      <ThemedSelect
        ariaLabel="Vyberte člena organizace"
        value={selectedUserId}
        onChange={setSelectedUserId}
        disabled={saving || candidates.length === 0}
        options={[
          { value: "", label: candidates.length === 0 ? "Všichni členové už jsou v týmu" : "Vyberte člena organizace" },
          ...candidates.map((member) => ({ value: member.user_id, label: member.display_name || member.email })),
        ]}
      />
      <button type="button" disabled={!selectedUserId || saving} onClick={() => void addMember()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Přidat</button>
    </div>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {loading ? <div className="p-8 text-center text-slate-500">Načítám tým…</div> : team.map((member) => <div key={member.userId} className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800">
        <div className="min-w-0 flex-1"><div className="truncate font-medium">{member.displayName}</div><div className="truncate text-xs text-slate-400">{member.email}{member.legacyExternal ? " · přechodný externí read-only přístup" : ""}</div></div>
        {member.accessKind === "system_owner" && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Systémový vlastník</span>}
        <span className="text-sm text-slate-500">{member.professionalRole ? PROJECT_TEAM_ROLE_LABELS[member.professionalRole] : member.legacyExternal ? "Přechodný externí přístup" : "Bez profesní role"}</span>
        {canManage && member.accessKind !== "system_owner" && <button type="button" disabled={saving} onClick={() => void removeMember(member.userId)} className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">Odebrat</button>}
      </div>)}
    </div>
  </section>;
};
