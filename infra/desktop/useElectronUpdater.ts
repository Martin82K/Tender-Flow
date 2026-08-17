import { useSyncExternalStore } from "react";
import { updaterAdapter, type UpdateStatusInfo } from "@infra/platform/platformAdapter";

export type UpdateStatus =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

interface ElectronUpdaterState {
  status: UpdateStatus;
  info?: UpdateInfo;
  progress?: UpdateProgress;
  error?: string;
}

const listeners = new Set<() => void>();
let updateState: ElectronUpdaterState = { status: "not-available" };
let storeStarted = false;
let storeRunId = 0;
let stopAdapterSubscription: (() => void) | undefined;

const mapStatus = (status: UpdateStatusInfo): ElectronUpdaterState => ({
  status: status.status,
  info: status.version ? { version: status.version } : undefined,
  progress:
    typeof status.percent === "number"
      ? {
          percent: status.percent,
          transferred: status.transferred ?? 0,
          total: status.total ?? 0,
        }
      : undefined,
  error: status.error,
});

const publishStatus = (status: UpdateStatusInfo): void => {
  const nextState = mapStatus(status);
  if (
    nextState.status === updateState.status &&
    nextState.info?.version === updateState.info?.version &&
    nextState.progress?.percent === updateState.progress?.percent &&
    nextState.progress?.transferred === updateState.progress?.transferred &&
    nextState.progress?.total === updateState.progress?.total &&
    nextState.error === updateState.error
  ) {
    return;
  }

  updateState = nextState;
  listeners.forEach((listener) => listener());
};

const ensureStoreStarted = (): void => {
  if (storeStarted) return;
  storeStarted = true;
  const runId = ++storeRunId;

  stopAdapterSubscription = updaterAdapter.onStatusChange?.(publishStatus);
  void updaterAdapter.getStatus().then((status) => {
    if (runId === storeRunId) publishStatus(status);
  }).catch(() => {
    if (runId === storeRunId) {
      publishStatus({
        status: "error",
        error: "Nepodařilo se načíst stav aktualizace.",
      });
    }
  });
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  ensureStoreStarted();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;

    queueMicrotask(() => {
      if (listeners.size > 0 || !storeStarted) return;
      storeRunId += 1;
      stopAdapterSubscription?.();
      stopAdapterSubscription = undefined;
      storeStarted = false;
    });
  };
};

const getSnapshot = (): ElectronUpdaterState => updateState;

const checkForUpdates = async (): Promise<void> => {
  await updaterAdapter.checkForUpdates();
};

const downloadUpdate = async (): Promise<void> => {
  await updaterAdapter.downloadUpdate();
};

const installUpdate = (): void => {
  void updaterAdapter.quitAndInstall();
};

export const useElectronUpdater = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
};
