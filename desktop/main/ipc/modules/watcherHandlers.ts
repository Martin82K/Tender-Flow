import { BrowserWindow, ipcMain } from "electron";
import { FolderWatcherService } from "../../services/folderWatcher";

interface WatcherHandlerDependencies {
  resolvePortableReadPath: (targetPath: string) => Promise<string>;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

let watcherService: FolderWatcherService | null = null;

export const registerWatcherHandlers = ({
  resolvePortableReadPath,
  requireAuth,
}: WatcherHandlerDependencies): void => {
  ipcMain.handle("watcher:start", async (event, folderPath: string): Promise<void> => {
    requireAuth(event.sender, 'watcher:start');
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

  ipcMain.handle("watcher:stop", async (event): Promise<void> => {
    requireAuth(event.sender, 'watcher:stop');
    if (watcherService) {
      await watcherService.stop();
      watcherService = null;
    }
  });

  ipcMain.handle("watcher:getSnapshot", async (event) => {
    requireAuth(event.sender, 'watcher:getSnapshot');
    return watcherService?.getSnapshot() ?? null;
  });
};
