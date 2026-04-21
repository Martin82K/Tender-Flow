import React, { useCallback, useMemo, useState } from "react";
import { useFeatures } from "@/context/FeatureContext";
import { MODULES, ZONE_ORDER } from "@features/command-center/registry";
import type {
  CommandCenterModule,
  ModuleSignal,
  Zone,
} from "@features/command-center/types";
import { DEFAULT_FILTER_STATE } from "@features/command-center/types";
import { useCommandCenterPreferences } from "@features/command-center/hooks/useCommandCenterPreferences";
import {
  useModuleSignals,
  signalWeight,
  type ModuleSignalMap,
} from "@features/command-center/hooks/useModuleSignals";
import { CommandCenterSettings } from "@features/command-center/CommandCenterSettings";
import { ModuleErrorBoundary } from "@features/command-center/shell/ModuleErrorBoundary";

const GRID_COLS = 12;

const zoneClass = (zone: Zone) => `cc-zone cc-zone--${zone}`;

const effectiveWeight = (
  mod: CommandCenterModule,
  signals: ModuleSignalMap,
  autoLayout: boolean
): number => {
  if (!autoLayout || !mod.weightBySignal) return 1.0;
  return signalWeight(signals[mod.id], !!mod.autoHideWhenEmpty);
};

export const allocateCols = (
  mods: CommandCenterModule[],
  signals: ModuleSignalMap,
  autoLayout: boolean
): number[] => {
  if (mods.length === 0) return [];
  if (mods.length === 1) return [GRID_COLS];
  const weighted = mods.map(
    (m) => (m.defaultSize.cols || 1) * effectiveWeight(m, signals, autoLayout)
  );
  const total = weighted.reduce((s, v) => s + v, 0);
  if (total === 0) {
    const base = Math.floor(GRID_COLS / mods.length);
    return mods.map(() => base);
  }
  const scale = GRID_COLS / total;
  const raw = weighted.map((w, i) =>
    Math.max(mods[i].defaultSize.minCols ?? 3, Math.round(w * scale))
  );
  const diff = GRID_COLS - raw.reduce((s, v) => s + v, 0);
  if (diff !== 0) {
    const idx = raw.indexOf(Math.max(...raw));
    raw[idx] = Math.max(mods[idx].defaultSize.minCols ?? 3, raw[idx] + diff);
  }
  return raw;
};

const isModuleHidden = (
  mod: CommandCenterModule,
  signals: ModuleSignalMap,
  autoLayout: boolean
): boolean => {
  if (!autoLayout) return false;
  if (!mod.autoHideWhenEmpty) return false;
  return signals[mod.id]?.level === "empty";
};

const signalDataAttr = (signal: ModuleSignal | undefined): string | undefined =>
  signal && signal.level !== "normal" ? signal.level : undefined;

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

  const autoLayout = preferences.preferences.autoLayout !== false;
  const signals = useModuleSignals(filterState);

  const { activeModulesByZone, hiddenCount } = useMemo(() => {
    const map = new Map<Zone, CommandCenterModule[]>();
    for (const zone of ZONE_ORDER) map.set(zone, []);
    let hidden = 0;
    for (const mod of MODULES) {
      if (!preferences.isModuleEnabled(mod.id)) continue;
      if (mod.requiredFeature && !hasFeature(mod.requiredFeature)) continue;
      if (isModuleHidden(mod, signals, autoLayout)) {
        hidden += 1;
        continue;
      }
      map.get(mod.zone)?.push(mod);
    }
    for (const zone of ZONE_ORDER) {
      const arr = map.get(zone);
      if (arr) arr.sort((a, b) => a.priority - b.priority);
    }
    return { activeModulesByZone: map, hiddenCount: hidden };
  }, [preferences, hasFeature, signals, autoLayout]);

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

  const slotProps = (mod: CommandCenterModule, extraClass?: string) => {
    const signalLevel = signalDataAttr(signals[mod.id]);
    return {
      className: `cc-zone__slot${extraClass ? " " + extraClass : ""}`,
      "data-signal": autoLayout && signalLevel ? signalLevel : undefined,
    } as const;
  };

  const pairTemplate = (
    primary: CommandCenterModule | undefined,
    secondary: CommandCenterModule | undefined,
    defaultRatio: [number, number]
  ): string | undefined => {
    if (!autoLayout || !primary || !secondary) return undefined;
    const pw =
      (primary.defaultSize.cols || defaultRatio[0]) *
      effectiveWeight(primary, signals, autoLayout);
    const sw =
      (secondary.defaultSize.cols || defaultRatio[1]) *
      effectiveWeight(secondary, signals, autoLayout);
    if (pw <= 0 || sw <= 0) return undefined;
    return `${pw.toFixed(2)}fr ${sw.toFixed(2)}fr`;
  };

  const renderZone = (zone: Zone) => {
    const mods = activeModulesByZone.get(zone) ?? [];
    if (mods.length === 0) return null;
    const isFullWidth =
      zone === "alert" || zone === "kpi" || zone === "filter" || zone === "portfolio";
    const isTactical = zone === "tactical";

    if (isFullWidth) {
      return (
        <div className={zoneClass(zone)} key={zone}>
          {mods.map((mod) => (
            <div key={mod.id} {...slotProps(mod, "cc-zone__slot--full")}>
              {renderModule(mod, false)}
            </div>
          ))}
        </div>
      );
    }

    if (isTactical) {
      const cols = allocateCols(mods, signals, autoLayout);
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
            <div key={mod.id} {...slotProps(mod)}>
              {renderModule(mod, cols.length > 2)}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const mainPrimary = activeModulesByZone.get("main-primary") ?? [];
  const mainSecondary = activeModulesByZone.get("main-secondary") ?? [];
  const temporalPrimary = activeModulesByZone.get("temporal-primary") ?? [];
  const temporalSecondary = activeModulesByZone.get("temporal-secondary") ?? [];

  const mainTemplate = pairTemplate(mainPrimary[0], mainSecondary[0], [8, 4]);
  const temporalTemplate = pairTemplate(temporalPrimary[0], temporalSecondary[0], [8, 4]);

  return (
    <div className="cc-root">
      <header className="cc-header">
        <div>
          <div className="cc-header__brand">Command Center</div>
          <div className="cc-header__sub">Velitelský můstek Tender Flow</div>
        </div>
        <div className="cc-header__actions">
          {autoLayout && hiddenCount > 0 && (
            <span
              className="cc-header__chip"
              title="Moduly bez dat jsou automaticky skryty. Vypněte auto-layout pro zobrazení všech."
            >
              {hiddenCount} skryto
            </span>
          )}
          <button
            type="button"
            className={`cc-btn cc-btn--ghost${autoLayout ? " cc-btn--active" : ""}`}
            onClick={() => preferences.setAutoLayout(!autoLayout)}
            title={
              autoLayout
                ? "Auto-layout zapnutý: moduly se skrývají/škálují dle dat"
                : "Auto-layout vypnutý: pevný layout"
            }
            aria-pressed={autoLayout}
          >
            {autoLayout ? "◉ Auto-layout" : "○ Auto-layout"}
          </button>
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
          {renderZone("portfolio")}

          {(mainPrimary.length > 0 || mainSecondary.length > 0) && (
            <div
              className={`cc-zone cc-zone--main ${mainPrimary.length > 0 && mainSecondary.length > 0 ? "cc-zone--main-split" : "cc-zone--main-single"}`}
              style={mainTemplate ? { gridTemplateColumns: mainTemplate } : undefined}
            >
              {mainPrimary.length > 0 && (
                <div {...slotProps(mainPrimary[0], "cc-zone__slot--main-primary")}>
                  {mainPrimary.map((m) => (
                    <div key={m.id}>{renderModule(m, false)}</div>
                  ))}
                </div>
              )}
              {mainSecondary.length > 0 && (
                <div {...slotProps(mainSecondary[0], "cc-zone__slot--main-secondary")}>
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
              style={temporalTemplate ? { gridTemplateColumns: temporalTemplate } : undefined}
            >
              {temporalPrimary.length > 0 && (
                <div {...slotProps(temporalPrimary[0], "cc-zone__slot--temporal-primary")}>
                  {temporalPrimary.map((m) => (
                    <div key={m.id}>{renderModule(m, false)}</div>
                  ))}
                </div>
              )}
              {temporalSecondary.length > 0 && (
                <div {...slotProps(temporalSecondary[0], "cc-zone__slot--temporal-secondary")}>
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
