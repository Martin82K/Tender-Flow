import React, { useCallback, useMemo, useState } from "react";
import { useFeatures } from "@/context/FeatureContext";
import { MODULES, ZONE_ORDER } from "@features/command-center/registry";
import type { CommandCenterModule, Zone } from "@features/command-center/types";
import { DEFAULT_FILTER_STATE } from "@features/command-center/types";
import { useCommandCenterPreferences } from "@features/command-center/hooks/useCommandCenterPreferences";
import { CommandCenterSettings } from "@features/command-center/CommandCenterSettings";
import { ModuleErrorBoundary } from "@features/command-center/shell/ModuleErrorBoundary";

const GRID_COLS = 12;

const zoneClass = (zone: Zone) => `cc-zone cc-zone--${zone}`;

const allocateCols = (mods: CommandCenterModule[]): number[] => {
  if (mods.length === 0) return [];
  if (mods.length === 1) return [GRID_COLS];
  const totalCols = mods.reduce((sum, m) => sum + (m.defaultSize.cols || 0), 0);
  if (totalCols === 0) {
    const base = Math.floor(GRID_COLS / mods.length);
    return mods.map(() => base);
  }
  const scale = GRID_COLS / totalCols;
  return mods.map((m) =>
    Math.max(m.defaultSize.minCols ?? 3, Math.round((m.defaultSize.cols || 1) * scale))
  );
};

interface CommandCenterShellProps {
  isEmptyPortfolio: boolean;
  emptyState: React.ReactNode;
}

export const CommandCenterShell: React.FC<CommandCenterShellProps> = ({
  isEmptyPortfolio,
  emptyState,
}) => {
  const { hasFeature } = useFeatures();
  const preferences = useCommandCenterPreferences();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [moduleSettingsOpenFor, setModuleSettingsOpenFor] = useState<string | null>(null);

  const filterState = useMemo(
    () => ({
      ...DEFAULT_FILTER_STATE,
      ...(preferences.preferences.filterState ?? {}),
    }),
    [preferences.preferences.filterState]
  );

  const activeModulesByZone = useMemo(() => {
    const map = new Map<Zone, CommandCenterModule[]>();
    for (const zone of ZONE_ORDER) map.set(zone, []);
    for (const mod of MODULES) {
      if (!preferences.isModuleEnabled(mod.id)) continue;
      if (mod.requiredFeature && !hasFeature(mod.requiredFeature)) continue;
      map.get(mod.zone)?.push(mod);
    }
    for (const zone of ZONE_ORDER) {
      const arr = map.get(zone);
      if (arr) arr.sort((a, b) => a.priority - b.priority);
    }
    return map;
  }, [preferences, hasFeature]);

  const handleModuleSettingsChange = useCallback(
    (id: string, next: Record<string, unknown>) => {
      preferences.setModuleSettings(id, next);
    },
    [preferences]
  );

  const renderModule = useCallback(
    (mod: CommandCenterModule, isCompact: boolean) => {
      const Component = mod.component;
      const settings = preferences.preferences.moduleSettings[mod.id] ?? {};
      return (
        <ModuleErrorBoundary moduleTitle={mod.title}>
          <Component
            settings={settings}
            onSettingsChange={(next) => handleModuleSettingsChange(mod.id, next)}
            isCompact={isCompact}
            filterState={filterState}
            onFilterChange={preferences.setFilterState}
          />
        </ModuleErrorBoundary>
      );
    },
    [preferences, filterState, handleModuleSettingsChange]
  );

  const renderZone = (zone: Zone) => {
    const mods = activeModulesByZone.get(zone) ?? [];
    if (mods.length === 0) return null;
    const isFullWidth = zone === "alert" || zone === "kpi" || zone === "filter";
    const isTactical = zone === "tactical";
    const isMainPair = zone === "main-primary" || zone === "main-secondary";
    const isTemporalPair = zone === "temporal-primary" || zone === "temporal-secondary";

    if (isFullWidth) {
      return (
        <div className={zoneClass(zone)} key={zone}>
          {mods.map((mod) => (
            <div key={mod.id} className="cc-zone__slot cc-zone__slot--full">
              {renderModule(mod, false)}
            </div>
          ))}
        </div>
      );
    }

    if (isTactical) {
      const cols = allocateCols(mods);
      return (
        <div
          className={`${zoneClass(zone)} cc-zone--tactical-grid`}
          key={zone}
          style={{
            gridTemplateColumns: cols
              .map((c) => `${Math.max(1, c)}fr`)
              .join(" "),
          }}
        >
          {mods.map((mod) => (
            <div key={mod.id} className="cc-zone__slot">
              {renderModule(mod, cols.length > 2)}
            </div>
          ))}
        </div>
      );
    }

    if (isMainPair || isTemporalPair) return null;

    return null;
  };

  const mainPrimary = activeModulesByZone.get("main-primary") ?? [];
  const mainSecondary = activeModulesByZone.get("main-secondary") ?? [];
  const temporalPrimary = activeModulesByZone.get("temporal-primary") ?? [];
  const temporalSecondary = activeModulesByZone.get("temporal-secondary") ?? [];

  return (
    <div className="cc-root">
      <header className="cc-header">
        <div>
          <div className="cc-header__brand">Command Center</div>
          <div className="cc-header__sub">Velitelský můstek Tender Flow</div>
        </div>
        <div className="cc-header__actions">
          <button
            type="button"
            className="cc-btn cc-btn--ghost"
            onClick={() => setSettingsOpen(true)}
            title="Rozložení modulů"
            aria-label="Nastavení rozložení"
          >
            ⚙ Rozložení
          </button>
        </div>
      </header>

      {isEmptyPortfolio ? (
        <div className="cc-empty-portfolio">{emptyState}</div>
      ) : (
        <div className="cc-stage">
          {renderZone("alert")}
          {renderZone("kpi")}
          {renderZone("filter")}

          {(mainPrimary.length > 0 || mainSecondary.length > 0) && (
            <div
              className={`cc-zone cc-zone--main ${mainPrimary.length > 0 && mainSecondary.length > 0 ? "cc-zone--main-split" : "cc-zone--main-single"}`}
            >
              {mainPrimary.length > 0 && (
                <div className="cc-zone__slot cc-zone__slot--main-primary">
                  {mainPrimary.map((m) => (
                    <div key={m.id}>{renderModule(m, false)}</div>
                  ))}
                </div>
              )}
              {mainSecondary.length > 0 && (
                <div className="cc-zone__slot cc-zone__slot--main-secondary">
                  {mainSecondary.map((m) => (
                    <div key={m.id}>{renderModule(m, false)}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {renderZone("tactical")}

          {(temporalPrimary.length > 0 || temporalSecondary.length > 0) && (
            <div
              className={`cc-zone cc-zone--temporal ${temporalPrimary.length > 0 && temporalSecondary.length > 0 ? "cc-zone--temporal-split" : "cc-zone--temporal-single"}`}
            >
              {temporalPrimary.length > 0 && (
                <div className="cc-zone__slot cc-zone__slot--temporal-primary">
                  {temporalPrimary.map((m) => (
                    <div key={m.id}>{renderModule(m, false)}</div>
                  ))}
                </div>
              )}
              {temporalSecondary.length > 0 && (
                <div className="cc-zone__slot cc-zone__slot--temporal-secondary">
                  {temporalSecondary.map((m) => (
                    <div key={m.id}>{renderModule(m, false)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CommandCenterSettings
        open={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
      />
      {moduleSettingsOpenFor && null /* Per-module settings drawer hook — future */}
    </div>
  );
};
