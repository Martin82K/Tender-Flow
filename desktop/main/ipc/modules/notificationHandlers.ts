import { ipcMain, Notification, BrowserWindow } from "electron";

/**
 * IPC handler for desktop native notifications.
 */
export function registerNotificationHandlers(): void {
  ipcMain.handle(
    "notification:show",
    (_event, { title, body }: { title: string; body?: string }) => {
      if (!Notification.isSupported()) return;

      const notification = new Notification({
        title,
        body: body ?? "",
      });

      notification.on("click", () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          if (win.isMinimized()) win.restore();
          win.focus();
        }
      });

      notification.show();
    },
  );
}
