import React, { useCallback, useEffect, useMemo, useState } from "react";
import { organizationService, type OrganizationMember } from "@features/organization/api";
import { projectService } from "@/services/projectService";
import type { ProjectTeamRole } from "@/types";

const roleLabels: Record<ProjectTeamRole | "owner_admin", string> = {
  owner_admin: "Vlastník projektu",
  project_admin: "Administrátor projektu",
  project_manager: "Projektový manažer",
  team_member: "Člen týmu",
  viewer: "Pouze čtení",
};

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
  const [selectedRole, setSelectedRole] = useState<ProjectTeamRole>("team_member");
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
  const myRole = team.find((member) => member.userId === currentUserId)?.role;
  const canManage = !readOnly && (myRole === "owner_admin" || myRole === "project_admin");
  const candidates = useMemo(() => orgMembers.filter((member) => !team.some((teamMember) => teamMember.userId === member.user_id)), [orgMembers, team]);

  const addMember = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await projectService.setProjectTeamMember(projectId, selectedUserId, selectedRole);
      setSelectedUserId("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Člena se nepodařilo přidat."); }
    finally { setSaving(false); }
  };

  const updateRole = async (userId: string, role: ProjectTeamRole) => {
    setSaving(true);
    try { await projectService.setProjectTeamMember(projectId, userId, role); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Roli se nepodařilo změnit."); }
    finally { setSaving(false); }
  };

  const removeMember = async (userId: string) => {
    setSaving(true);
    try { await projectService.removeProjectTeamMember(projectId, userId); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Člena se nepodařilo odebrat."); }
    finally { setSaving(false); }
  };

  return <section className="mx-auto w-full max-w-4xl space-y-5 p-6 lg:p-10">
    <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Realizační tým</h2><p className="mt-1 text-sm text-slate-500">Členství uložené zde automaticky řídí přístup ke stavbě. Schvalování výběru se přiděluje samostatným krokem a není součástí týmové role.</p></div>
    {readOnly && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Archivovaná stavba je pouze ke čtení. Tým nelze měnit.</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {canManage && <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_220px_auto] dark:border-slate-700 dark:bg-slate-900">
      <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm"><option value="">Vyberte člena organizace</option>{candidates.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}</select>
      <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as ProjectTeamRole)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm">{Object.entries(roleLabels).filter(([role]) => role !== "owner_admin").map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select>
      <button type="button" disabled={!selectedUserId || saving} onClick={() => void addMember()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Přidat</button>
    </div>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {loading ? <div className="p-8 text-center text-slate-500">Načítám tým…</div> : team.map((member) => <div key={member.userId} className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800">
        <div className="min-w-0 flex-1"><div className="truncate font-medium">{member.displayName}</div><div className="truncate text-xs text-slate-400">{member.email}{member.legacyExternal ? " · přechodný externí read-only přístup" : ""}</div></div>
        {canManage && member.role !== "owner_admin" && !member.legacyExternal ? <select aria-label={`Role – ${member.displayName}`} disabled={saving} value={member.role} onChange={(event) => void updateRole(member.userId, event.target.value as ProjectTeamRole)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm">{Object.entries(roleLabels).filter(([role]) => role !== "owner_admin").map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select> : <span className="text-sm text-slate-500">{roleLabels[member.role]}</span>}
        {canManage && member.role !== "owner_admin" && <button type="button" disabled={saving} onClick={() => void removeMember(member.userId)} className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">Odebrat</button>}
      </div>)}
    </div>
  </section>;
};
