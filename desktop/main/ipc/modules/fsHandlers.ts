import { dialog, ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import type { FileInfo, FolderInfo } from "../../types";

interface FsHandlerDependencies {
  resolvePortableReadPath: (targetPath: string) => Promise<string>;
  resolvePortableWritePath: (targetPath: string) => Promise<string>;
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

export const registerFsHandlers = ({
  resolvePortableReadPath,
  resolvePortableWritePath,
}: FsHandlerDependencies): void => {
  ipcMain.handle("fs:selectFolder", async (): Promise<FolderInfo | null> => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Vybrat složku pro synchronizaci",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    return {
      path: folderPath,
      name: path.basename(folderPath),
    };
  });

  ipcMain.handle("fs:listFiles", async (_, folderPath: string): Promise<FileInfo[]> => {
    const resolvedFolderPath = await resolvePortableReadPath(folderPath);
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

  ipcMain.handle("fs:readFile", async (_, filePath: string): Promise<Buffer> => {
    return fs.readFile(filePath);
  });

  ipcMain.handle("fs:writeFile", async (_, filePath: string, data: Buffer | string): Promise<void> => {
    await fs.writeFile(filePath, data);
  });

  ipcMain.handle("fs:openInExplorer", async (_, targetPath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const resolvedTargetPath = await resolvePortableReadPath(targetPath);
      const result = await shell.openPath(resolvedTargetPath);
      return result ? { success: false, error: result } : { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("fs:openFile", async (_, filePath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const resolvedFilePath = await resolvePortableReadPath(filePath);
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
    async (_, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const resolvedFolderPath = await resolvePortableWritePath(folderPath);
        await fs.mkdir(resolvedFolderPath, { recursive: true });
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle(
    "fs:deleteFolder",
    async (_, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const resolvedFolderPath = await resolvePortableReadPath(folderPath);
        await fs.rm(resolvedFolderPath, { recursive: true, force: true });
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle(
    "fs:renameFolder",
    async (_, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const resolvedOldPath = await resolvePortableReadPath(oldPath);
        const resolvedNewPath = await resolvePortableWritePath(newPath);
        await fs.rename(resolvedOldPath, resolvedNewPath);
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle("fs:folderExists", async (_, folderPath: string): Promise<boolean> => {
    try {
      const resolvedFolderPath = await resolvePortableReadPath(folderPath);
      const stat = await fs.stat(resolvedFolderPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  });
};
