import React, { useEffect, useMemo, useState } from "react";
import { SubscriptionFeature } from "../types";
import { subscriptionFeaturesService } from "../services/subscriptionFeaturesService";
import { useUI } from "../context/UIContext";
import {
  getDisplayTiers,
  getAllTiers,
  SubscriptionTierId,
} from "../config/subscriptionTiers";

type FlagKey = `${SubscriptionTierId}:${string}`;

const DISPLAY_TIERS = getDisplayTiers();
const ALL_TIERS = getAllTiers();

export const SubscriptionFeaturesManagement: React.FC = () => {
  const { showAlert, showConfirm } = useUI();
  const [isLoading, setIsLoading] = useState(true);
  const [features, setFeatures] = useState<SubscriptionFeature[]>([]);
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({});
  const [savingFlag, setSavingFlag] = useState<FlagKey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [isCreating, setIsCreating] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [isSavingFeature, setIsSavingFeature] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadAll = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [f, fl] = await Promise.all([
        subscriptionFeaturesService.listFeatures(),
        subscriptionFeaturesService.listTierFlags(),
      ]);

      const nextFlags: Record<FlagKey, boolean> = {};
      for (const row of fl) {
        nextFlags[`${row.tier}:${row.featureKey}`] = row.enabled;
      }

      setFeatures(f);
      setFlags(nextFlags);
    } catch (e) {
      console.error("Failed to load subscription features:", e);
      const code = (e as any)?.code || (e as any)?.error?.code;
      const message = String(
        (e as any)?.message || (e as any)?.error?.message || ""
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
    for (const f of features) {
      const cat = (f.category || "").trim();
      if (cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [features]);

  const beginEdit = (feature: SubscriptionFeature) => {
    setEditingKey(feature.key);
    setEditName(feature.name || "");
    setEditDescription(feature.description || "");
    setEditCategory(feature.category || "");
    setEditSortOrder(String(feature.sortOrder ?? 0));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditName("");
    setEditDescription("");
    setEditCategory("");
    setEditSortOrder("0");
  };

  const normalizeKey = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "_");

  const isValidFeatureKey = (value: string) => /^[a-z0-9_]+$/.test(value);

  const setFlag = async (
    tier: SubscriptionTierId,
    featureKey: string,
    enabled: boolean
  ) => {
    const k: FlagKey = `${tier}:${featureKey}`;
    setSavingFlag(k);
    const prev = flags[k];
    setFlags((m) => ({ ...m, [k]: enabled }));
    try {
      await subscriptionFeaturesService.setTierFlag(tier, featureKey, enabled);
    } catch (e) {
      console.error("Failed to save flag:", e);
      setFlags((m) => ({ ...m, [k]: !!prev }));
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se uložit změnu.",
        variant: "danger",
      });
    } finally {
      setSavingFlag(null);
    }
  };

  const createFeature = async () => {
    const key = normalizeKey(newKey);
    if (!key || !isValidFeatureKey(key)) {
      showAlert({
        title: "Neplatný klíč",
        message: "Klíč funkce musí obsahovat jen a-z, 0-9 a _.",
        variant: "danger",
      });
      return;
    }
    if (!newName.trim()) {
      showAlert({
        title: "Chybí název",
        message: "Zadejte název funkce.",
        variant: "danger",
      });
      return;
    }

    setIsCreating(true);
    try {
      await subscriptionFeaturesService.createFeature({
        key,
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        category: newCategory.trim() || undefined,
        sortOrder: Number(newSortOrder) || 0,
      });

      // Default: keep everything disabled; admin gets enabled automatically by seed for existing rows only.
      // Make sure flags exist for all tiers in UI by explicitly creating false entries.
      for (const t of ALL_TIERS) {
        await subscriptionFeaturesService.setTierFlag(
          t.id,
          key,
          t.id === "admin"
        );
      }

      setNewKey("");
      setNewName("");
      setNewDescription("");
      setNewCategory("");
      setNewSortOrder("0");

      await loadAll();
    } catch (e) {
      console.error("Failed to create feature:", e);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se vytvořit funkci.",
        variant: "danger",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    if (!editName.trim()) {
      showAlert({
        title: "Chybí název",
        message: "Zadejte název funkce.",
        variant: "danger",
      });
      return;
    }

    setIsSavingFeature(true);
    try {
      await subscriptionFeaturesService.updateFeature(editingKey, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        category: editCategory.trim() || null,
        sortOrder: Number(editSortOrder) || 0,
      });
      await loadAll();
      cancelEdit();
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
      if (editingKey === key) cancelEdit();
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
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400">
            workspace_premium
          </span>
          Předplatné – funkce
          <span className="ml-2 px-2.5 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-bold rounded-lg border border-amber-500/30">
            Admin
          </span>
        </h2>
        <div className="text-sm text-slate-500">Načítám…</div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">
              workspace_premium
            </span>
            Předplatné – funkce
            <span className="ml-2 px-2.5 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-bold rounded-lg border border-amber-500/30">
              Admin
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Přehled toho, jaké funkce jsou dostupné pro jednotlivé modely
            předplatného, včetně jejich správy.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Obnovit
        </button>
      </div>

      {loadError && (
        <div className="mt-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">
              warning
            </span>
            <div className="flex-1">{loadError}</div>
          </div>
        </div>
      )}

      {/* Matrix */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-300 px-3 py-2 border-b border-slate-200 dark:border-slate-700/60">
                Funkce
              </th>
              {DISPLAY_TIERS.map((t) => (
                <th
                  key={t.id}
                  className="text-center text-xs font-bold text-slate-600 dark:text-slate-300 px-3 py-2 border-b border-slate-200 dark:border-slate-700/60"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] ${t.badgeClass}`}
                  >
                    {t.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.length === 0 && (
              <tr>
                <td
                  colSpan={1 + DISPLAY_TIERS.length}
                  className="px-3 py-4 text-sm text-slate-500 border-b border-slate-200 dark:border-slate-800"
                >
                  Zatím nejsou definované žádné funkce. Přidejte je níže.
                </td>
              </tr>
            )}

            {features.map((feature) => (
              <tr
                key={feature.key}
                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
              >
                <td className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {feature.name}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/30">
                          {feature.key}
                        </span>
                        {!!feature.category && (
                          <span className="text-[11px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/30">
                            {feature.category}
                          </span>
                        )}
                      </div>
                      {!!feature.description && (
                        <div className="text-xs text-slate-500 mt-1">
                          {feature.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => beginEdit(feature)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200"
                    >
                      Upravit
                    </button>
                  </div>
                </td>
                {DISPLAY_TIERS.map((t) => {
                  const k: FlagKey = `${t.id}:${feature.key}`;
                  const checked = !!flags[k];
                  const busy = savingFlag === k;
                  return (
                    <td
                      key={k}
                      className="px-3 py-3 text-center border-b border-slate-200 dark:border-slate-800"
                    >
                      <button
                        onClick={() => setFlag(t.id, feature.key, !checked)}
                        disabled={busy}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          checked
                            ? "bg-emerald-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                        title={checked ? "Zapnuto" : "Vypnuto"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            checked ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feature editor */}
      <div className="mt-8 border-t border-slate-200 dark:border-slate-700/60 pt-6">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Správa funkcí ({features.length})
        </h3>

        {/* Create */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Klíč
            </label>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="např. doc_hub"
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Povolené znaky: a-z, 0-9, _
            </div>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Název
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Název funkce"
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Kategorie
            </label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={featureCategories[0] || "např. Dokumenty"}
              list="subscription-feature-categories"
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
            />
            <datalist id="subscription-feature-categories">
              {featureCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Pořadí
            </label>
            <input
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(e.target.value)}
              type="number"
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div className="lg:col-span-12">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Popis
            </label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Krátký popis (volitelné)"
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div className="lg:col-span-12 flex justify-end">
            <button
              onClick={createFeature}
              disabled={isCreating}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                className={`material-symbols-outlined ${
                  isCreating ? "animate-spin" : ""
                }`}
              >
                {isCreating ? "sync" : "add"}
              </span>
              {isCreating ? "Vytvářím..." : "Přidat funkci"}
            </button>
          </div>
        </div>

        {/* Edit */}
        {editingKey && (
          <div className="mt-8 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Úprava funkce{" "}
                <span className="text-slate-500 font-semibold">
                  {editingKey}
                </span>
              </div>
              <button
                onClick={cancelEdit}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-white/60 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200"
              >
                Zavřít
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Název
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div className="lg:col-span-4">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Kategorie
                </label>
                <input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  list="subscription-feature-categories"
                  className="w-full rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Pořadí
                </label>
                <input
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(e.target.value)}
                  type="number"
                  className="w-full rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div className="lg:col-span-12">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Popis
                </label>
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={() => deleteFeature(editingKey)}
                disabled={deletingKey === editingKey}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    deletingKey === editingKey ? "animate-spin" : ""
                  }`}
                >
                  {deletingKey === editingKey ? "sync" : "delete"}
                </span>
                Smazat
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50"
                >
                  Zrušit
                </button>
                <button
                  onClick={saveEdit}
                  disabled={isSavingFeature}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </div>
        )}
      </div>
    </section>
  );
};
