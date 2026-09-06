import React, { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDisplayTiers } from "@/config/subscriptionTiers";
import { SubscriptionApi } from "@features/subscription";
import { buildAppUrl } from "@shared/routing/routeUtils";
import { navigate } from "@shared/routing/router";
import { SubscriptionFeaturesManagement } from "./SubscriptionFeaturesManagement";

const DISPLAY_TIERS = getDisplayTiers();
export const SubscriptionOverview: React.FC = () => {
  const id = useId();
  const [advanced, setAdvanced] = useState(false);
  const [advancedBusy, setAdvancedBusy] = useState(false);
  const catalogue = useQuery({
    queryKey: ["admin", "subscription-catalogue"],
    queryFn: async () => {
      const [features, flags] = await Promise.all([
        SubscriptionApi.listSubscriptionFeatures(),
        SubscriptionApi.listSubscriptionTierFlags(),
      ]);
      return { features, flags };
    },
    enabled: !advanced,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700/40 dark:bg-slate-900/80">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Balíčky a funkce</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Začněte výběrem firmy. Její plán, licence a fakturační údaje najdete ve správě firem.
        </p>
        <button
          type="button"
          onClick={() => navigate(buildAppUrl("settings", { settingsTab: "admin", settingsSubTab: "organizations" }))}
          className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Spravovat firmy
        </button>
      </section>

      {!advanced && (
        <section aria-labelledby={`${id}-catalogue`} className="space-y-4">
          <div>
            <h3 id={`${id}-catalogue`} className="font-bold text-slate-900 dark:text-white">Obsah balíčků</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Přehled nastavení tarifů pouze pro čtení. Dostupnost pro konkrétního člověka může ovlivnit individuální výjimka a jeho oprávnění.
            </p>
          </div>
          {catalogue.isFetching && <p role="status" className="text-sm text-slate-500">Načítám přehled balíčků…</p>}
          {catalogue.isError && !catalogue.isFetching && (
            <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-slate-900 dark:text-slate-100">
              <p>Přehled balíčků se nepodařilo načíst. Zkuste načtení zopakovat.</p>
              <button type="button" onClick={() => void catalogue.refetch()} className="mt-2 font-semibold underline">
                Zkusit znovu
              </button>
            </div>
          )}
          {catalogue.isSuccess && !catalogue.isFetching && (
            catalogue.data.features.length === 0 ? (
              <p className="text-sm text-slate-500">Katalog funkcí je prázdný.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {DISPLAY_TIERS.map((tier) => {
                  const enabled = new Set(catalogue.data.flags.filter((flag) => flag.tier === tier.id && flag.enabled).map((flag) => flag.featureKey));
                  const features = catalogue.data.features.filter((feature) => enabled.has(feature.key));
                  return (
                    <section key={tier.id} aria-labelledby={`${id}-${tier.id}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700/40 dark:bg-slate-900/80">
                      <h4 id={`${id}-${tier.id}`} className="font-bold text-slate-900 dark:text-white">{tier.label}</h4>
                      {features.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">Žádné povolené funkce v katalogu.</p>
                      ) : (
                        <details className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          <summary className="cursor-pointer font-medium">Zobrazit funkce ({features.length})</summary>
                          <ul className="mt-3 space-y-2">
                            {features.map((feature) => <li key={feature.key} className="break-words">{feature.name}</li>)}
                          </ul>
                        </details>
                      )}
                    </section>
                  );
                })}
              </div>
            )
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700/40">
        <h3 className="font-bold text-slate-900 dark:text-white">Pokročilá správa</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Společné nastavení funkcí pro celé tarify a úpravy katalogu.
        </p>
        <button
          type="button"
          disabled={advancedBusy}
          aria-expanded={advanced}
          aria-controls={`${id}-advanced`}
          onClick={() => setAdvanced((value) => !value)}
          className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {advanced ? "Zavřít pokročilou správu" : "Otevřít pokročilou správu"}
        </button>
        <div id={`${id}-advanced`} hidden={!advanced}>
          {advanced && (
            <div className="mt-5 space-y-4">
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-slate-900 dark:text-slate-100">
                Změny se ukládají okamžitě a upravují společná pravidla celého tarifu. Pro změnu plánu jedné firmy použijte správu firem.
              </p>
              <SubscriptionFeaturesManagement onBusyChange={setAdvancedBusy} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
