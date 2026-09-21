import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { dbAdapter } from "@infra/db/dbAdapter";
import type { ProjectClientCard, ProjectDetails } from "@/types";
import { resolveClientCardDraft, draftFromClientCard } from "./clientCardModel";

interface ClientCardRow {
  company_name?: string | null;
  ico?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  internal_note?: string | null;
}

const optional = (value: string | null | undefined): string | undefined => {
  const next = value?.trim();
  return next ? next : undefined;
};

export const mapClientCardRow = (row: ClientCardRow | null | undefined): ProjectClientCard | null => {
  const companyName = row?.company_name?.trim() ?? "";
  if (!companyName) return null;
  return {
    companyName,
    ico: optional(row?.ico),
    street: optional(row?.street),
    zip: optional(row?.zip),
    city: optional(row?.city),
    contactName: optional(row?.contact_name),
    contactEmail: optional(row?.contact_email),
    contactPhone: optional(row?.contact_phone),
    internalNote: optional(row?.internal_note),
  };
};

const toRow = (projectId: string, organizationId: string, card: ProjectClientCard) => ({
  project_id: projectId,
  organization_id: organizationId,
  company_name: card.companyName,
  ico: card.ico ?? null,
  street: card.street ?? null,
  zip: card.zip ?? null,
  city: card.city ?? null,
  contact_name: card.contactName ?? null,
  contact_email: card.contactEmail ?? null,
  contact_phone: card.contactPhone ?? null,
  internal_note: card.internalNote ?? null,
});

const userFacingError = (error: { message?: string; code?: string } | null): Error => {
  const message = error?.message ?? "";
  const code = error?.code ?? "";
  if (message.includes("archived") || message.includes("Project is archived")) {
    return new Error("Archivovanou stavbu nelze upravit.");
  }
  if (message.includes("organization must match")) {
    return new Error("Karta objednatele patří jen ke své stavbě.");
  }
  if (message.includes("ico") || message.includes("is_valid_czech_ico")) {
    return new Error("IČO nemá platný formát.");
  }
  if (code === "42501" || /permission|row-level security|policy/i.test(message)) {
    return new Error("K úpravě objednatele nemáte oprávnění.");
  }
  return new Error("Kartu objednatele se nepodařilo uložit.");
};

const readDemoCard = (projectId: string): ProjectClientCard | null => {
  const details = projectDemoDataApi.getDemoData()?.projectDetails?.[projectId] as ProjectDetails | undefined;
  return details?.clientCard ?? null;
};

const writeDemoCard = (projectId: string, card: ProjectClientCard | null): ProjectClientCard | null => {
  const data = projectDemoDataApi.getDemoData();
  if (!data) throw new Error("Kartu objednatele se nepodařilo uložit.");
  const current = (data.projectDetails[projectId] ?? {
    id: projectId,
    title: "",
    location: "",
    finishDate: "",
    siteManager: "",
    categories: [],
  }) as ProjectDetails;
  current.clientCard = card;
  data.projectDetails[projectId] = current;
  projectDemoDataApi.saveDemoData(data);
  return card;
};

const assertCard = (card: ProjectClientCard): ProjectClientCard => {
  const resolved = resolveClientCardDraft(draftFromClientCard(card));
  if (!resolved.card || Object.keys(resolved.errors).length > 0) {
    throw new Error(Object.values(resolved.errors)[0] || "Karta objednatele není platná.");
  }
  return resolved.card;
};

export const clientCardApi = {
  async get(projectId: string): Promise<ProjectClientCard | null> {
    if (projectDemoDataApi.isDemoSession()) return readDemoCard(projectId);
    const { data, error } = await dbAdapter
      .from("project_client_cards")
      .select("company_name,ico,street,zip,city,contact_name,contact_email,contact_phone,internal_note")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw userFacingError(error);
    return mapClientCardRow(data as ClientCardRow | null);
  },

  async save(projectId: string, organizationId: string, card: ProjectClientCard): Promise<ProjectClientCard> {
    const normalized = assertCard(card);
    if (!organizationId) throw new Error("Karta objednatele vyžaduje organizaci stavby.");
    if (projectDemoDataApi.isDemoSession()) {
      writeDemoCard(projectId, normalized);
      return normalized;
    }
    const { data, error } = await dbAdapter
      .from("project_client_cards")
      .upsert(toRow(projectId, organizationId, normalized), { onConflict: "project_id" })
      .select("company_name,ico,street,zip,city,contact_name,contact_email,contact_phone,internal_note")
      .single();
    if (error) throw userFacingError(error);
    return mapClientCardRow(data as ClientCardRow) ?? normalized;
  },

  async remove(projectId: string): Promise<void> {
    if (projectDemoDataApi.isDemoSession()) {
      writeDemoCard(projectId, null);
      return;
    }
    const { error } = await dbAdapter.from("project_client_cards").delete().eq("project_id", projectId);
    if (error) throw userFacingError(error);
  },
};
