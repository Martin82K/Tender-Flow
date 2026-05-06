import { useEffect, useState } from "react";
import { updaterAdapter, type UpdateStatusInfo } from "@/services/platformAdapter";

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

export const useElectronUpdater = () => {
  const [updateState, setUpdateState] = useState<{
    status: UpdateStatus;
    info?: UpdateInfo;
    progress?: UpdateProgress;
    error?: string;
  }>({
    status: "not-available",
  });

  const mapStatus = (status: UpdateStatusInfo) => ({
    status: status.status as UpdateStatus,
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

  useEffect(() => {
    if (!updaterAdapter.onStatusChange) {
      return;
    }

    const unsubscribe = updaterAdapter.onStatusChange((status) => {
      setUpdateState(mapStatus(status));
    });

    updaterAdapter.getStatus().then((status) => {
      setUpdateState(mapStatus(status));
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const checkForUpdates = async () => {
    await updaterAdapter.checkForUpdates();
  };

  const downloadUpdate = async () => {
    await updaterAdapter.downloadUpdate();
  };

  const installUpdate = () => {
    void updaterAdapter.quitAndInstall();
  };

  return {
    ...updateState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
};
