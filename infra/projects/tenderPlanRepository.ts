import { supabase } from "@/services/supabase";
import type { TenderPlanItem } from "@/types";

type TenderPlanRow = {
  id: string;
  name: string;
  date_from: string | null;
  date_to: string | null;
  category_id: string | null;
};

type UpdateTenderPlanInput = {
  id: string;
  name?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  categoryId?: string | null;
};

const mapTenderPlanRow = (row: TenderPlanRow): TenderPlanItem => ({
  id: row.id,
  name: row.name,
  dateFrom: row.date_from || "",
  dateTo: row.date_to || "",
  categoryId: row.category_id || undefined,
});

const toNullableDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const tenderPlanRepository = {
  async listByProject(projectId: string): Promise<TenderPlanItem[]> {
    const { data, error } = await supabase
      .from("tender_plans")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => mapTenderPlanRow(row as TenderPlanRow));
  },

  async create(input: {
    id: string;
    projectId: string;
    name: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    categoryId?: string | null;
  }) {
    const { error } = await supabase.from("tender_plans").insert({
      id: input.id,
      project_id: input.projectId,
      name: input.name,
      date_from: toNullableDate(input.dateFrom),
      date_to: toNullableDate(input.dateTo),
      category_id: input.categoryId ?? null,
    });

    if (error) {
      throw error;
    }
  },

  async update(input: UpdateTenderPlanInput) {
    const payload: Record<string, string | null> = {};

    if (typeof input.name === "string") {
      payload.name = input.name;
    }
    if ("dateFrom" in input) {
      payload.date_from = toNullableDate(input.dateFrom ?? null);
    }
    if ("dateTo" in input) {
      payload.date_to = toNullableDate(input.dateTo ?? null);
    }
    if ("categoryId" in input) {
      payload.category_id = input.categoryId ?? null;
    }

    const { error } = await supabase.from("tender_plans").update(payload).eq("id", input.id);
    if (error) {
      throw error;
    }
  },

  async remove(id: string) {
    const { error } = await supabase.from("tender_plans").delete().eq("id", id);
    if (error) {
      throw error;
    }
  },

  async updateCategoryRealizationWindow(input: {
    categoryId: string;
    realizationStart: string | null;
    realizationEnd: string | null;
  }) {
    const { error } = await supabase
      .from("demand_categories")
      .update({
        realization_start: toNullableDate(input.realizationStart),
        realization_end: toNullableDate(input.realizationEnd),
      })
      .eq("id", input.categoryId);

    if (error) {
      throw error;
    }
  },

  async updateCategoryDeadline(categoryId: string, deadline: string | null) {
    const { error } = await supabase
      .from("demand_categories")
      .update({ deadline: toNullableDate(deadline) })
      .eq("id", categoryId);

    if (error) {
      throw error;
    }
  },
};
