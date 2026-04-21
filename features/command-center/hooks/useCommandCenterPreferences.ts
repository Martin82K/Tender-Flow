import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type {
  CommandCenterFilterState,
  CommandCenterPreferences,
} from "@features/command-center/types";
import { DEFAULT_FILTER_STATE } from "@features/command-center/types";
import { MODULES, defaultEnabledModules } from "@features/command-center/registry";

const DEBOUNCE_MS = 300;

const buildDefaultPreferences = (): CommandCenterPreferences => ({
  enabledModules: defaultEnabledModules(),
  moduleSettings: {},
  filterState: DEFAULT_FILTER_STATE,
  autoLayout: true,
  lastUpdated: new Date().toISOString(),
});

const mergePreferences = (
  stored: Partial<CommandCenterPreferences> | undefined
): CommandCenterPreferences => {
  const defaults = buildDefaultPreferences();
  if (!stored) return defaults;
  const enabledModules = { ...defaults.enabledModules };
  // Only apply stored overrides for modules in registry, keep defaults for new modules.
  for (const key of Object.keys(stored.enabledModules ?? {})) {
    if (MODULES.some((m) => m.id === key)) {
      enabledModules[key] = !!stored.enabledModules![key];
    }
  }
  return {
    enabledModules,
    moduleSettings: stored.moduleSettings ?? {},
    filterState: {
      ...defaults.filterState,
      ...(stored.filterState ?? {}),
    } as CommandCenterFilterState,
    autoLayout: typeof stored.autoLayout === "boolean" ? stored.autoLayout : defaults.autoLayout,
    lastUpdated: stored.lastUpdated ?? defaults.lastUpdated,
  };
};

export interface CommandCenterPreferencesApi {
  preferences: CommandCenterPreferences;
  isModuleEnabled: (id: string) => boolean;
  setModuleEnabled: (id: string, enabled: boolean) => void;
  setModuleSettings: (id: string, settings: Record<string, unknown>) => void;
  setFilterState: (next: Partial<CommandCenterFilterState>) => void;
  setAutoLayout: (enabled: boolean) => void;
  resetToDefaults: () => void;
  isSaving: boolean;
}

export const useCommandCenterPreferences = (): CommandCenterPreferencesApi => {
  const { user, updatePreferences } = useAuth();
  const initial = useMemo(
    () => mergePreferences(user?.preferences?.commandCenter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [preferences, setPreferences] = useState<CommandCenterPreferences>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<CommandCenterPreferences | null>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!user?.preferences?.commandCenter) return;
    const merged = mergePreferences(user.preferences.commandCenter);
    setPreferences((prev) => ({ ...prev, ...merged }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const scheduleSave = useCallback(
    (next: CommandCenterPreferences) => {
      pendingRef.current = next;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(async () => {
        const toSave = pendingRef.current;
        if (!toSave) return;
        pendingRef.current = null;
        setIsSaving(true);
        try {
          await updatePreferences({
            ...(user?.preferences ?? {}),
            commandCenter: toSave,
          });
        } catch (err) {
          console.warn("[CommandCenter] Failed to save preferences", err);
        } finally {
          setIsSaving(false);
        }
      }, DEBOUNCE_MS);
    },
    [updatePreferences, user?.preferences]
  );

  const mutate = useCallback(
    (updater: (prev: CommandCenterPreferences) => CommandCenterPreferences) => {
      setPreferences((prev) => {
        const next = {
          ...updater(prev),
          lastUpdated: new Date().toISOString(),
        };
        if (didMountRef.current) {
          scheduleSave(next);
        }
        return next;
      });
    },
    [scheduleSave]
  );

  useEffect(() => {
    didMountRef.current = true;
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const isModuleEnabled = useCallback(
    (id: string) => {
      const explicit = preferences.enabledModules[id];
      if (typeof explicit === "boolean") return explicit;
      const mod = MODULES.find((m) => m.id === id);
      return mod?.enabledByDefault ?? false;
    },
    [preferences.enabledModules]
  );

  const setModuleEnabled = useCallback(
    (id: string, enabled: boolean) =>
      mutate((prev) => ({
        ...prev,
        enabledModules: { ...prev.enabledModules, [id]: enabled },
      })),
    [mutate]
  );

  const setModuleSettings = useCallback(
    (id: string, settings: Record<string, unknown>) =>
      mutate((prev) => ({
        ...prev,
        moduleSettings: { ...prev.moduleSettings, [id]: settings },
      })),
    [mutate]
  );

  const setFilterState = useCallback(
    (next: Partial<CommandCenterFilterState>) =>
      mutate((prev) => ({
        ...prev,
        filterState: {
          ...DEFAULT_FILTER_STATE,
          ...(prev.filterState as CommandCenterFilterState),
          ...next,
        },
      })),
    [mutate]
  );

  const setAutoLayout = useCallback(
    (enabled: boolean) =>
      mutate((prev) => ({
        ...prev,
        autoLayout: enabled,
      })),
    [mutate]
  );

  const resetToDefaults = useCallback(() => {
    mutate(() => buildDefaultPreferences());
  }, [mutate]);

  return {
    preferences,
    isModuleEnabled,
    setModuleEnabled,
    setModuleSettings,
    setFilterState,
    setAutoLayout,
    resetToDefaults,
    isSaving,
  };
};
