import React, { useEffect, useMemo, useState } from "react";
import { useUI } from "@/context/UIContext";
import {
  getAllTiers,
  getDisplayTiers,
  SubscriptionTierId,
} from "@/config/subscriptionTiers";
import { subscriptionFeaturesService } from "@/services/subscriptionFeaturesService";
import { SubscriptionFeature } from "@/types";

type FlagKey = `${SubscriptionTierId}:${string}`;
type GroupId = "AI" | "Export" | "Kontakty" | "Moduly" | "Tools" | "Ostatní";
type FeatureSeed = Required<
  Pick<
    SubscriptionFeature,
    "key" | "name" | "description" | "category" | "sortOrder"
  >
>;
type FeatureViewModel = SubscriptionFeature & {
  group: GroupId | string;
  isSystem: boolean;
};
type FeatureGroup = {
  id: GroupId | string;
  title: string;
  description: string;
  items: FeatureViewModel[];
};

const DISPLAY_TIERS = getDisplayTiers();
const ALL_TIERS = getAllTiers();
const REMOVED_FEATURE_KEYS = new Set(["ai_insights"]);
const SYSTEM_PROTECTED_KEYS = new Set(["ai_ocr"]);
const SYSTEM_AI_MODULES: FeatureSeed[] = [
  {
    key: "ai_ocr",
    name: "Povolit OCR",
    description: "OCR zpracování dokumentů a extrakce dat ze smluv.",
    category: "AI moduly",
    sortOrder: 52,
  },
];
const GROUP_META: Record<
  GroupId,
  { title: string; description: string; accent: string; icon: string; order: number }
> = {
  AI: {
    title: "AI",
    description: "Asistenti, OCR a další inteligentní funkce.",
    accent:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    icon: "auto_awesome",
    order: 0,
  },
  Export: {
    title: "Export",
    description: "Výstupy do PDF, Excelu a dalších formátů.",
    accent:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: "download",
    order: 1,
  },
  Kontakty: {
    title: "Kontakty",
    description: "Kontaktní agenda, importy a práce se subdodavateli.",
    accent:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    icon: "groups",
    order: 2,
  },
  Moduly: {
    title: "Moduly",
    description: "Hlavní části aplikace a funkční moduly.",
    accent:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    icon: "deployed_code",
    order: 3,
  },
  Tools: {
    title: "Tools",
    description: "Nástroje, utility a pomocné workflow moduly.",
    accent:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: "construction",
    order: 4,
  },
  Ostatní: {
    title: "Ostatní",
    description: "Doplňkové nebo nezařazené funkce.",
    accent:
      "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    icon: "category",
    order: 5,
  },
};

const getGroupId = (feature: SubscriptionFeature): GroupId | string => {
  const key = feature.key.toLowerCase();
  const category = (feature.category || "").trim().toLowerCase();

  if (
    key.startsWith("ai_") ||
    key.includes("ocr") ||
    category.includes("ai")
  ) {
    return "AI";
  }

  if (key.startsWith("export_") || category.includes("export")) {
    return "Export";
  }

  if (
    key.includes("contact") ||
    key.includes("subcontract") ||
    category.includes("kontakt")
  ) {
    return "Kontakty";
  }

  if (
    key.startsWith("module_") ||
    category.includes("modul") ||
    category === "základ"
  ) {
    return "Moduly";
  }

  if (
    key.includes("excel") ||
    key.includes("unlocker") ||
    key.includes("merger") ||
    key.includes("indexer") ||
    category.includes("excel") ||
    category.includes("tool") ||
    category.includes("nástroj") ||
    category.includes("nastroj")
  ) {
    return "Tools";
  }

  return feature.category?.trim() || "Ostatní";
};

const getGroupMeta = (groupId: GroupId | string) => {
  if (groupId in GROUP_META) {
    return GROUP_META[groupId as GroupId];
  }

  return {
    title: groupId,
    description: "Vlastní skupina funkcí.",
    accent:
      "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    icon: "category",
    order: 10,
  };
};

const ToggleSwitch = ({
  checked,
  busy,
  onClick,
  label,
}: {
  checked: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    disabled={busy}
    aria-label={label}
    aria-pressed={checked}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
    } ${busy ? "cursor-not-allowed opacity-60" : ""}`}
    title={checked ? "Zapnuto" : "Vypnuto"}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

export const SubscriptionFeaturesManagement: React.FC = () => {
  const { showAlert, showConfirm } = useUI();

  const [isLoading, setIsLoading] = useState(true);
  const [features, setFeatures] = useState<SubscriptionFeature[]>([]);
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({});
  const [savingFlag, setSavingFlag] = useState<FlagKey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [isSavingFeature, setIsSavingFeature] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const ensureFeatureExists = async (seed: FeatureSeed) => {
    const existing = features.find((feature) => feature.key === seed.key);
    if (existing) return existing;

    await subscriptionFeaturesService.createFeature(seed);
    for (const tier of ALL_TIERS) {
      await subscriptionFeaturesService.setTierFlag(
        tier.id,
        seed.key,
        tier.id === "admin"
      );
    }

    const created: SubscriptionFeature = { ...seed };
    setFeatures((current) => [...current, created]);
    setFlags((current) => {
      const next = { ...current };
      for (const tier of ALL_TIERS) {
        next[`${tier.id}:${seed.key}`] = tier.id === "admin";
      }
      return next;
    });

    return created;
  };

  const loadAll = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [loadedFeatures, loadedFlags] = await Promise.all([
        subscriptionFeaturesService.listFeatures(),
        subscriptionFeaturesService.listTierFlags(),
      ]);

      const nextFlags: Record<FlagKey, boolean> = {};
      for (const row of loadedFlags) {
        nextFlags[`${row.tier}:${row.featureKey}`] = row.enabled;
      }

      setFeatures(loadedFeatures);
      setFlags(nextFlags);
    } catch (e) {
      console.error("Failed to load subscription features:", e);
      const code = (e as { code?: string; error?: { code?: string } })?.code ||
        (e as { error?: { code?: string } })?.error?.code;
      const message = String(
        (e as { message?: string; error?: { message?: string } })?.message ||
          (e as { error?: { message?: string } })?.error?.message ||
          ""
      );
      const lower = message.toLowerCase();
      const mentionsTables =
        lower.includes("subscription_features") ||
        lower.includes("subscription_tier_features");
      const looksLikePostgrestSchemaCache =
        lower.includes("schema cache") &&
        (lower.includes("could not find") || lower.includes("not find"));
      const looksMissingTable =
        code === "42P01" ||
        (lower.includes("relation") && mentionsTables) ||
        (lower.includes("does not exist") && mentionsTables) ||
        (looksLikePostgrestSchemaCache && mentionsTables);

      if (looksMissingTable) {
        setLoadError(
          "Backend tabulky pro přehled funkcí předplatného nejsou nasazené. Nahraj migraci `supabase/migrations/20260102000100_subscription_features.sql` do Supabase a pak klikni na „Obnovit“."
        );
      } else {
        setLoadError(message || "Chyba při načítání funkcí předplatného");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const featureCategories = useMemo(() => {
    const set = new Set<string>();
    for (const feature of features) {
      const category = (feature.category || "").trim();
      if (category) set.add(category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [features]);

  const normalizedFeatures = useMemo<FeatureViewModel[]>(() => {
    const merged = new Map<string, SubscriptionFeature>();

    for (const seed of SYSTEM_AI_MODULES) {
      merged.set(seed.key, seed);
    }

    for (const feature of features) {
      const current = merged.get(feature.key);
      merged.set(feature.key, current ? { ...current, ...feature } : feature);
    }

    return Array.from(merged.values())
      .filter((feature) => !REMOVED_FEATURE_KEYS.has(feature.key))
      .map((feature) => ({
        ...feature,
        group: getGroupId(feature),
        isSystem: SYSTEM_PROTECTED_KEYS.has(feature.key),
      }))
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          (a.name || a.key).localeCompare(b.name || b.key, "cs")
      );
  }, [features]);

  const featureGroups = useMemo<FeatureGroup[]>(() => {
    const groups = new Map<string, FeatureViewModel[]>();

    for (const feature of normalizedFeatures) {
      const items = groups.get(feature.group) || [];
      items.push(feature);
      groups.set(feature.group, items);
    }

    return Array.from(groups.entries())
      .map(([groupId, items]) => ({
        id: groupId,
        title: getGroupMeta(groupId).title,
        description: getGroupMeta(groupId).description,
        items,
      }))
      .sort((a, b) => {
        const aMeta = getGroupMeta(a.id);
        const bMeta = getGroupMeta(b.id);
        if (aMeta.order !== bMeta.order) return aMeta.order - bMeta.order;
        return a.title.localeCompare(b.title, "cs");
      });
  }, [normalizedFeatures]);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };
      let changed = false;

      for (const group of featureGroups) {
        if (!(group.id in next)) {
          next[group.id] = false;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [featureGroups]);

  const editingFeature = useMemo(
    () =>
      normalizedFeatures.find((feature) => feature.key === editingKey) || null,
    [editingKey, normalizedFeatures]
  );

  const openEditPanel = (feature: SubscriptionFeature) => {
    setEditingKey(feature.key);
    setEditName(feature.name || "");
    setEditDescription(feature.description || "");
    setEditCategory(feature.category || "");
    setEditSortOrder(String(feature.sortOrder ?? 0));
  };

  const closeEditPanel = () => {
    setEditingKey(null);
    setEditName("");
    setEditDescription("");
    setEditCategory("");
    setEditSortOrder("0");
  };

  const setFlag = async (
    tier: SubscriptionTierId,
    featureKey: string,
    enabled: boolean
  ) => {
    const systemSeed = SYSTEM_AI_MODULES.find((feature) => feature.key === featureKey);
    const flagKey: FlagKey = `${tier}:${featureKey}`;
    const previous = flags[flagKey];

    setSavingFlag(flagKey);
    setFlags((current) => ({ ...current, [flagKey]: enabled }));

    try {
      if (systemSeed) {
        await ensureFeatureExists(systemSeed);
      }
      await subscriptionFeaturesService.setTierFlag(tier, featureKey, enabled);
    } catch (e) {
      console.error("Failed to save flag:", e);
      setFlags((current) => ({ ...current, [flagKey]: !!previous }));
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se uložit změnu.",
        variant: "danger",
      });
    } finally {
      setSavingFlag(null);
    }
  };

  const saveEdit = async () => {
    if (!editingFeature) return;

    if (!editingFeature.isSystem && !editName.trim()) {
      showAlert({
        title: "Chybí název",
        message: "Zadejte název funkce.",
        variant: "danger",
      });
      return;
    }

    setIsSavingFeature(true);
    try {
      await subscriptionFeaturesService.updateFeature(editingFeature.key, {
        name: editingFeature.isSystem ? editingFeature.name : editName.trim(),
        description: editDescription.trim() || null,
        category: editCategory.trim() || null,
        sortOrder: editingFeature.isSystem
          ? editingFeature.sortOrder ?? 0
          : Number(editSortOrder) || 0,
      });
      await loadAll();
      closeEditPanel();
    } catch (e) {
      console.error("Failed to update feature:", e);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se uložit změny.",
        variant: "danger",
      });
    } finally {
      setIsSavingFeature(false);
    }
  };

  const deleteFeature = async (key: string) => {
    if (SYSTEM_PROTECTED_KEYS.has(key)) {
      showAlert({
        title: "Chráněná funkce",
        message: "Systémové AI moduly nelze smazat.",
        variant: "danger",
      });
      return;
    }

    const ok = await showConfirm({
      title: "Smazat funkci?",
      message: `Smazat funkci "${key}"?`,
      variant: "danger",
      confirmLabel: "Smazat",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;

    setDeletingKey(key);
    try {
      await subscriptionFeaturesService.deleteFeature(key);
      await loadAll();
      if (editingKey === key) closeEditPanel();
    } catch (e) {
      console.error("Failed to delete feature:", e);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se smazat funkci.",
        variant: "danger",
      });
    } finally {
      setDeletingKey(null);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop-blur-xl dark:border-slate-700/40 dark:bg-slate-900/80">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <span className="material-symbols-outlined text-amber-400">
            workspace_premium
          </span>
          Předplatné – funkce
          <span className="ml-2 rounded-lg border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-300">
            Admin
          </span>
        </h2>
        <div className="text-sm text-slate-500">Načítám…</div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop-blur-xl dark:border-slate-700/40 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <span className="material-symbols-outlined text-amber-400">
                workspace_premium
              </span>
              Předplatné – funkce
              <span className="ml-2 rounded-lg border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-300">
                Admin
              </span>
            </h2>
            <p className="max-w-3xl text-sm text-slate-500">
              Jednotná správa modulů a funkcí podle tarifů. Přehled je seskupený
              po doménách a systémové AI položky jsou chráněné proti smazání.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/50"
            >
              <span className="material-symbols-outlined text-[18px]">
                refresh
              </span>
              Obnovit
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">
                warning
              </span>
              <div className="flex-1">{loadError}</div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
            {normalizedFeatures.length} zobrazených funkcí
          </span>
          <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-700 dark:text-cyan-300">
            System = chráněné
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {featureGroups.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Zatím nejsou definované žádné funkce. Přidejte je níže.
            </div>
          )}

          {featureGroups.map((group) => {
            const meta = getGroupMeta(group.id);
            const collapsed = !!collapsedGroups[group.id];

            return (
              <section
                key={group.id}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-white shadow-sm dark:border-slate-700/60 dark:from-slate-950/80 dark:to-slate-900/70"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [group.id]: !current[group.id],
                    }))
                  }
                  className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
                  aria-expanded={!collapsed}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${meta.accent}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {meta.icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {group.title}
                        </h3>
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${meta.accent}`}
                        >
                          {group.items.length} položek
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {group.description}
                      </p>
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-slate-400">
                    {collapsed ? "expand_more" : "expand_less"}
                  </span>
                </button>

                {!collapsed && (
                  <div className="border-t border-slate-200/70 dark:border-slate-700/60">
                    <div className="hidden grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(72px,1fr))] gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 md:grid dark:text-slate-400">
                      <span>Funkce</span>
                      {DISPLAY_TIERS.map((tier) => (
                        <span key={tier.id} className="text-center">
                          {tier.label}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-2 px-3 pb-3">
                      {group.items.map((feature) => (
                        <div
                          key={feature.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => openEditPanel(feature)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openEditPanel(feature);
                            }
                          }}
                          className="grid cursor-pointer gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700 dark:hover:bg-slate-950/60 md:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(72px,1fr))]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {feature.name}
                              </span>
                              <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                                {feature.key}
                              </span>
                              {feature.category && (
                                <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                                  {feature.category}
                                </span>
                              )}
                              {feature.isSystem && (
                                <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                                  system
                                </span>
                              )}
                            </div>
                            {feature.description && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {feature.description}
                              </p>
                            )}
                            <div className="mt-3 flex items-center gap-2 md:hidden">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditPanel(feature);
                                }}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/50"
                              >
                                Upravit
                              </button>
                            </div>
                          </div>

                          {DISPLAY_TIERS.map((tier) => {
                            const flagKey: FlagKey = `${tier.id}:${feature.key}`;
                            const checked = !!flags[flagKey];
                            const busy = savingFlag === flagKey;

                            return (
                              <div
                                key={flagKey}
                                className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 md:justify-center md:border-0 md:bg-transparent md:px-0 md:py-0 dark:border-slate-800 dark:bg-slate-900/40"
                              >
                                <span className="text-[11px] font-semibold text-slate-500 md:hidden dark:text-slate-400">
                                  {tier.label}
                                </span>
                                <ToggleSwitch
                                  checked={checked}
                                  busy={busy}
                                  onClick={() =>
                                    setFlag(tier.id, feature.key, !checked)
                                  }
                                  label={`${feature.name} – ${tier.label}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

      </section>

      <datalist id="subscription-feature-categories">
        {featureCategories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {editingFeature && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Zavřít detail funkce"
            className="flex-1 cursor-default"
            onClick={closeEditPanel}
          />

          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Detail funkce
                  </h3>
                  {editingFeature.isSystem && (
                    <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                      system
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Uprav metadata funkce a zkontroluj její zařazení v ceníku
                  předplatného.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditPanel}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Klíč
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="text-sm font-semibold text-slate-900 dark:text-white">
                    {editingFeature.key}
                  </code>
                  {editingFeature.isSystem && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Chráněná systémová položka
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Název
                </label>
                <input
                  value={editingFeature.isSystem ? editingFeature.name : editName}
                  onChange={(event) => setEditName(event.target.value)}
                  disabled={editingFeature.isSystem}
                  aria-label="Název"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-white"
                />
                {editingFeature.isSystem && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Název systémové funkce je uzamčený.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Kategorie
                </label>
                <input
                  value={editCategory}
                  onChange={(event) => setEditCategory(event.target.value)}
                  list="subscription-feature-categories"
                  aria-label="Kategorie"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500/50 focus:outline-none dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Pořadí
                </label>
                <input
                  value={
                    editingFeature.isSystem
                      ? String(editingFeature.sortOrder ?? 0)
                      : editSortOrder
                  }
                  onChange={(event) => setEditSortOrder(event.target.value)}
                  disabled={editingFeature.isSystem}
                  type="number"
                  aria-label="Pořadí"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Popis
                </label>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={4}
                  aria-label="Popis"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500/50 focus:outline-none dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
              <button
                type="button"
                onClick={() => deleteFeature(editingFeature.key)}
                disabled={editingFeature.isSystem || deletingKey === editingFeature.key}
                className="flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    deletingKey === editingFeature.key ? "animate-spin" : ""
                  }`}
                >
                  {deletingKey === editingFeature.key ? "sync" : "delete"}
                </span>
                Smazat
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEditPanel}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/50"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={isSavingFeature}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:from-amber-500 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isSavingFeature ? "animate-spin" : ""
                    }`}
                  >
                    {isSavingFeature ? "sync" : "save"}
                  </span>
                  Uložit
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
