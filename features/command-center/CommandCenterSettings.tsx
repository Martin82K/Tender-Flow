import React, { useMemo } from "react";
import { useFeatures } from "@/context/FeatureContext";
import { MODULES, ZONE_ORDER } from "@features/command-center/registry";
import type { CommandCenterModule, Zone } from "@features/command-center/types";
import type { CommandCenterPreferencesApi } from "@features/command-center/hooks/useCommandCenterPreferences";

interface CommandCenterSettingsProps {
  open: boolean;
  onClose: () => void;
  preferences: CommandCenterPreferencesApi;
}

const ZONE_LABEL: Record<Zone, string> = {
  alert: "Kritické akce",
  kpi: "KPI přehled",
  filter: "Filtr",
  "main-primary": "Hlavní panel",
  "main-secondary": "Postranní panel",
  tactical: "Analýza",
  "temporal-primary": "Časová osa",
  "temporal-secondary": "Aktivita",
};

export const CommandCenterSettings: React.FC<CommandCenterSettingsProps> = ({
  open,
  onClose,
  preferences,
}) => {
  const { hasFeature } = useFeatures();
  const grouped = useMemo(() => {
    const result: Array<{ zone: Zone; modules: CommandCenterModule[] }> = [];
    for (const zone of ZONE_ORDER) {
      const zoneModules = MODULES.filter((m) => m.zone === zone).sort(
        (a, b) => a.priority - b.priority
      );
      if (zoneModules.length > 0) result.push({ zone, modules: zoneModules });
    }
    return result;
  }, []);

  if (!open) return null;

  return (
    <div className="cc-settings-overlay" role="dialog" aria-modal="true">
      <div className="cc-settings-panel">
        <div className="cc-settings-panel__head">
          <div>
            <div className="cc-settings-panel__title">Rozložení Command Centeru</div>
            <div className="cc-settings-panel__subtitle">
              Zapněte nebo vypněte moduly. Layout se automaticky přizpůsobí.
            </div>
          </div>
          <button
            type="button"
            className="cc-btn cc-btn--ghost"
            onClick={onClose}
            aria-label="Zavřít"
          >
            Zavřít
          </button>
        </div>
        <div className="cc-settings-panel__body">
          {grouped.map(({ zone, modules }) => (
            <section key={zone} className="cc-settings-zone">
              <h3 className="cc-settings-zone__title">{ZONE_LABEL[zone]}</h3>
              <ul className="cc-settings-list">
                {modules.map((mod) => {
                  const enabled = preferences.isModuleEnabled(mod.id);
                  const locked =
                    !!mod.requiredFeature && !hasFeature(mod.requiredFeature);
                  return (
                    <li
                      key={mod.id}
                      className={`cc-settings-item ${locked ? "cc-settings-item--locked" : ""}`}
                    >
                      <div className="cc-settings-item__body">
                        <div className="cc-settings-item__title">
                          {mod.title}
                          {locked && (
                            <span className="cc-settings-badge">Vyžaduje upgrade</span>
                          )}
                        </div>
                        <div className="cc-settings-item__desc">{mod.description}</div>
                      </div>
                      <label className="cc-switch">
                        <input
                          type="checkbox"
                          checked={enabled && !locked}
                          disabled={locked}
                          onChange={(e) =>
                            preferences.setModuleEnabled(mod.id, e.target.checked)
                          }
                        />
                        <span className="cc-switch__track" />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <div className="cc-settings-panel__foot">
          <button
            type="button"
            className="cc-btn cc-btn--ghost"
            onClick={preferences.resetToDefaults}
          >
            Obnovit výchozí rozložení
          </button>
          <span className="cc-settings-panel__status">
            {preferences.isSaving ? "Ukládám…" : "Uloženo"}
          </span>
        </div>
      </div>
    </div>
  );
};
