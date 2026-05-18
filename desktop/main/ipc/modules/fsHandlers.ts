import { dialog, ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { ipcAuthGuard } from "../../services/ipcAuthGuard";
import type { FileInfo, FolderInfo } from "../../types";

type GrantedRootsStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

interface FsHandlerDependencies {
  resolvePortableReadPath: (targetPath: string) => Promise<string>;
  resolvePortableWritePath: (targetPath: string) => Promise<string>;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
  grantedRootsStorage?: GrantedRootsStorage;
}

const IGNORE_PATTERNS = [
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  ".git",
  "node_modules",
  /^~\$/,
  /\.tmp$/,
  /\.temp$/,
];

const USER_GRANTED_ROOTS_STORAGE_KEY = "desktop_user_granted_roots_v1";
const MAX_PERSISTED_GRANTED_ROOTS = 100;
const MAX_PERSISTED_ROOT_LENGTH = 4096;

const shouldIgnore = (filename: string): boolean => {
  return IGNORE_PATTERNS.some((pattern) => {
    if (typeof pattern === "string") return filename === pattern;
    return pattern.test(filename);
  });
};

// User-granted roots: paths explicitly selected via native dialog or manually confirmed
export const addUserGrantedRoot = (rootPath: string): Promise<string> =>
  ipcAuthGuard.addUserGrantedRoot(rootPath);

const ensurePathAllowed = (requestedPath: string, mode: "read" | "write"): Promise<string> =>
  ipcAuthGuard.ensurePathAllowed(requestedPath, mode);

const isWindowsAbsolutePath = (value: string): boolean => /^[A-Za-z]:[\\/]/.test(value);

const resolveNativeOrPortableAbsolutePath = (value: string): string =>
  path.isAbsolute(value) || isWindowsAbsolutePath(value) ? value : path.resolve(value);

const parsePersistedGrantedRoots = (raw: string | null): string[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.length <= MAX_PERSISTED_ROOT_LENGTH)
      .slice(0, MAX_PERSISTED_GRANTED_ROOTS);
  } catch {
    return [];
  }
};

export const registerFsHandlers = ({
  resolvePortableReadPath,
  resolvePortableWritePath,
  requireAuth,
  grantedRootsStorage,
}: FsHandlerDependencies): void => {
  const persistUserGrantedRoots = async (): Promise<void> => {
    if (!grantedRootsStorage) return;

    try {
      await grantedRootsStorage.set(
        USER_GRANTED_ROOTS_STORAGE_KEY,
        JSON.stringify(ipcAuthGuard.getUserGrantedRoots()),
      );
    } catch (error) {
      console.warn("[fsHandlers] Failed to persist user-granted roots:", error);
    }
  };

  const restorePersistedRoots = async (): Promise<void> => {
    if (!grantedRootsStorage) return;

    try {
      const roots = parsePersistedGrantedRoots(await grantedRootsStorage.get(USER_GRANTED_ROOTS_STORAGE_KEY));
      let changed = false;

      for (const root of roots) {
        try {
          const restoredRoot = await addUserGrantedRoot(root);
          changed = changed || restoredRoot !== root;
        } catch {
          changed = true;
        }
      }

      if (changed) {
        await persistUserGrantedRoots();
      }
    } catch (error) {
      console.warn("[fsHandlers] Failed to restore user-granted roots:", error);
    }
  };

  let restorePersistedRootsPromise: Promise<void> | null = null;
  const ensurePersistedRootsLoaded = async (): Promise<void> => {
    restorePersistedRootsPromise ??= restorePersistedRoots();
    await restorePersistedRootsPromise;
  };

  const addUserGrantedRootAndPersist = async (rootPath: string): Promise<string> => {
    const realRoot = await addUserGrantedRoot(rootPath);
    await persistUserGrantedRoots();
    return realRoot;
  };

  // fs:selectFolder is dialog-based (user action) but still requires auth
  ipcMain.handle("fs:selectFolder", async (event): Promise<FolderInfo | null> => {
    requireAuth(event.sender, 'fs:selectFolder');
    await ensurePersistedRootsLoaded();
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Vybrat složku pro synchronizaci",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    await addUserGrantedRootAndPersist(folderPath);
    return {
      path: folderPath,
      name: path.basename(folderPath),
    };
  });

  ipcMain.handle("fs:listFiles", async (event, folderPath: string): Promise<FileInfo[]> => {
    requireAuth(event.sender, 'fs:listFiles');
    await ensurePersistedRootsLoaded();
    const resolvedFolderPath = await ensurePathAllowed(await resolvePortableReadPath(folderPath), "read");
    const files: FileInfo[] = [];

    const scanDirectory = async (dir: string, relativeTo: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (shouldIgnore(entry.name)) continue;

        const absolutePath = path.join(dir, entry.name);
        const relativePath = path.relative(relativeTo, absolutePath);

        if (entry.isDirectory()) {
          files.push({
            relativePath,
            absolutePath,
            name: entry.name,
            size: 0,
            mtimeMs: 0,
            isDirectory: true,
            extension: "",
          });
          await scanDirectory(absolutePath, relativeTo);
        } else {
          const stats = await fs.stat(absolutePath);
          files.push({
            relativePath,
            absolutePath,
            name: entry.name,
            size: stats.size,
            mtimeMs: stats.mtimeMs,
            isDirectory: false,
            extension: path.extname(entry.name).toLowerCase(),
          });
        }
      }
    };

    await scanDirectory(resolvedFolderPath, resolvedFolderPath);
    return files;
  });

  ipcMain.handle("fs:readFile", async (event, filePath: string): Promise<Buffer> => {
    requireAuth(event.sender, 'fs:readFile');
    await ensurePersistedRootsLoaded();
    const resolvedFilePath = await ensurePathAllowed(await resolvePortableReadPath(filePath), "read");
    return fs.readFile(resolvedFilePath);
  });

  ipcMain.handle("fs:writeFile", async (event, filePath: string, data: Buffer | string): Promise<void> => {
    requireAuth(event.sender, 'fs:writeFile');
    await ensurePersistedRootsLoaded();
    const resolvedFilePath = await ensurePathAllowed(await resolvePortableWritePath(filePath), "write");
    await fs.writeFile(resolvedFilePath, data);
  });

  ipcMain.handle("fs:openInExplorer", async (event, targetPath: string): Promise<{ success: boolean; error?: string }> => {
    requireAuth(event.sender, 'fs:openInExplorer');
    await ensurePersistedRootsLoaded();
    try {
      const resolvedTargetPath = await ensurePathAllowed(await resolvePortableReadPath(targetPath), "read");
      const result = await shell.openPath(resolvedTargetPath);
      return result ? { success: false, error: result } : { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("fs:openFile", async (event, filePath: string): Promise<{ success: boolean; error?: string }> => {
    requireAuth(event.sender, 'fs:openFile');
    await ensurePersistedRootsLoaded();
    try {
      const resolvedFilePath = await ensurePathAllowed(await resolvePortableReadPath(filePath), "read");
      const result = await shell.openPath(resolvedFilePath);
      return result ? { success: false, error: result } : { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle(
    "fs:createFolder",
    async (event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      requireAuth(event.sender, 'fs:createFolder');
      await ensurePersistedRootsLoaded();
      try {
        const resolvedFolderPath = await ensurePathAllowed(await resolvePortableWritePath(folderPath), "write");
        await fs.mkdir(resolvedFolderPath, { recursive: true });
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle(
    "fs:deleteFolder",
    async (event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      requireAuth(event.sender, 'fs:deleteFolder');
      await ensurePersistedRootsLoaded();
      try {
        const resolvedFolderPath = await ensurePathAllowed(await resolvePortableReadPath(folderPath), "read");
        await fs.rm(resolvedFolderPath, { recursive: true, force: true });
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle(
    "fs:renameFolder",
    async (event, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> => {
      requireAuth(event.sender, 'fs:renameFolder');
      await ensurePersistedRootsLoaded();
      try {
        const resolvedOldPath = await ensurePathAllowed(await resolvePortableReadPath(oldPath), "read");
        const resolvedNewPath = await ensurePathAllowed(await resolvePortableWritePath(newPath), "write");
        await fs.rename(resolvedOldPath, resolvedNewPath);
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle("fs:folderExists", async (event, folderPath: string): Promise<boolean> => {
    requireAuth(event.sender, 'fs:folderExists');
    await ensurePersistedRootsLoaded();
    try {
      const resolvedFolderPath = await ensurePathAllowed(await resolvePortableReadPath(folderPath), "read");
      const stat = await fs.stat(resolvedFolderPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  });

  ipcMain.handle("fs:grantAccess", async (event, folderPath: string): Promise<boolean> => {
    requireAuth(event.sender, 'fs:grantAccess');
    await ensurePersistedRootsLoaded();
    if (typeof folderPath !== "string" || folderPath.trim().length === 0) return false;
    const resolvedFolderPath = await resolvePortableReadPath(folderPath.trim());
    const abs = resolveNativeOrPortableAbsolutePath(resolvedFolderPath);

    try {
      const stat = await fs.stat(abs);
      if (!stat.isDirectory()) return false;
    } catch {
      return false;
    }

    const confirmation = await dialog.showOpenDialog({
      title: "Potvrďte přístup ke složce",
      defaultPath: abs,
      properties: ["openDirectory"],
      message: "Pro pokračování vyberte složku, ke které chcete udělit přístup.",
      buttonLabel: "Udělit přístup",
    });

    if (confirmation.canceled || confirmation.filePaths.length === 0) return false;

    const selectedPath = resolveNativeOrPortableAbsolutePath(confirmation.filePaths[0]);
    const [selectedRealPath, requestedRealPath] = await Promise.all([
      fs.realpath(selectedPath),
      fs.realpath(abs),
    ]);
    if (selectedRealPath !== requestedRealPath) return false;

    await addUserGrantedRootAndPersist(selectedRealPath);
    return true;
  });
};
