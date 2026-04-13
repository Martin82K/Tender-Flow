import { app, dialog, ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { FileInfo, FolderInfo } from "../../types";

interface FsHandlerDependencies {
  resolvePortableReadPath: (targetPath: string) => Promise<string>;
  resolvePortableWritePath: (targetPath: string) => Promise<string>;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
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

const shouldIgnore = (filename: string): boolean => {
  return IGNORE_PATTERNS.some((pattern) => {
    if (typeof pattern === "string") return filename === pattern;
    return pattern.test(filename);
  });
};

const toAbsolutePath = (targetPath: string): string => path.resolve(targetPath);

const isPathInsideRoot = (targetPath: string, rootPath: string): boolean => {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

// User-granted roots: paths explicitly selected via native dialog or manually confirmed
const userGrantedRoots = new Set<string>();

export const addUserGrantedRoot = (rootPath: string): void => {
  userGrantedRoots.add(toAbsolutePath(rootPath));
};

const getAllowedRoots = (): string[] => {
  const roots = [
    app.getPath("home"),
    app.getPath("userData"),
    os.tmpdir(),
    ...userGrantedRoots,
  ].map(toAbsolutePath);

  return Array.from(new Set(roots));
};

const ensurePathAllowed = async (
  requestedPath: string,
  mode: "read" | "write",
): Promise<string> => {
  if (typeof requestedPath !== "string" || requestedPath.trim().length === 0) {
    throw new Error("Access denied: invalid path");
  }

  const normalizedPath = toAbsolutePath(requestedPath);
  const allowedRoots = getAllowedRoots();

  const isInsideAllowedRoot = (targetPath: string): boolean =>
    allowedRoots.some((root) => isPathInsideRoot(targetPath, root));

  if (mode === "read") {
    const realPath = await fs.realpath(normalizedPath);
    if (!isInsideAllowedRoot(realPath)) {
      throw new Error(`Access denied: path is outside allowed roots (${realPath})`);
    }
    return realPath;
  }

  // write mode: target may not exist, so verify nearest existing parent realpath
  let parentDir = normalizedPath;
  while (parentDir !== path.dirname(parentDir)) {
    try {
      const realParent = await fs.realpath(parentDir);
      if (!isInsideAllowedRoot(realParent)) {
        throw new Error(`Access denied: path is outside allowed roots (${realParent})`);
      }
      return normalizedPath;
    } catch {
      parentDir = path.dirname(parentDir);
    }
  }

  throw new Error("Access denied: unable to resolve path within allowed roots");
};

export const registerFsHandlers = ({
  resolvePortableReadPath,
  resolvePortableWritePath,
  requireAuth,
}: FsHandlerDependencies): void => {
  // fs:selectFolder is dialog-based (user action) but still requires auth
  ipcMain.handle("fs:selectFolder", async (event): Promise<FolderInfo | null> => {
    requireAuth(event.sender, 'fs:selectFolder');
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Vybrat složku pro synchronizaci",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    addUserGrantedRoot(folderPath);
    return {
      path: folderPath,
      name: path.basename(folderPath),
    };
  });

  ipcMain.handle("fs:listFiles", async (event, folderPath: string): Promise<FileInfo[]> => {
    requireAuth(event.sender, 'fs:listFiles');
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
    const resolvedFilePath = await ensurePathAllowed(await resolvePortableReadPath(filePath), "read");
    return fs.readFile(resolvedFilePath);
  });

  ipcMain.handle("fs:writeFile", async (event, filePath: string, data: Buffer | string): Promise<void> => {
    requireAuth(event.sender, 'fs:writeFile');
    const resolvedFilePath = await ensurePathAllowed(await resolvePortableWritePath(filePath), "write");
    await fs.writeFile(resolvedFilePath, data);
  });

  ipcMain.handle("fs:openInExplorer", async (event, targetPath: string): Promise<{ success: boolean; error?: string }> => {
    requireAuth(event.sender, 'fs:openInExplorer');
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
    if (typeof folderPath !== "string" || folderPath.trim().length === 0) return false;
    const abs = toAbsolutePath(folderPath.trim());
    try {
      const stat = await fs.stat(abs);
      if (!stat.isDirectory()) return false;
      addUserGrantedRoot(abs);
      return true;
    } catch {
      return false;
    }
  });
};
