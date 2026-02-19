import { BrowserWindow, ipcMain } from "electron";
import { FolderWatcherService } from "../../services/folderWatcher";

interface WatcherHandlerDependencies {
  resolvePortableReadPath: (targetPath: string) => Promise<string>;
}

let watcherService: FolderWatcherService | null = null;

export const registerWatcherHandlers = ({
  resolvePortableReadPath,
}: WatcherHandlerDependencies): void => {
  ipcMain.handle("watcher:start", async (event, folderPath: string): Promise<void> => {
    const resolvedFolderPath = await resolvePortableReadPath(folderPath);
    if (watcherService) {
      await watcherService.stop();
    }

    const win = BrowserWindow.fromWebContents(event.sender);
    watcherService = new FolderWatcherService(resolvedFolderPath, (eventType, filePath) => {
      win?.webContents.send("watcher:fileChange", eventType, filePath);
    });

    await watcherService.start();
  });

  ipcMain.handle("watcher:stop", async (): Promise<void> => {
    if (watcherService) {
      await watcherService.stop();
      watcherService = null;
    }
  });

  ipcMain.handle("watcher:getSnapshot", async () => {
    return watcherService?.getSnapshot() ?? null;
  });
};
