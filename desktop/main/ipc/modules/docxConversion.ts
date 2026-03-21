import { execFile as execFileCallback } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFileCallback);

export type DocxConversionResult = {
  success: boolean;
  outputPath?: string;
  error?: string;
};

type ConvertToDocxDeps = {
  platform: NodeJS.Platform;
  tmpDir: string;
  homeDir: string;
  now: () => number;
  runConversion: (inputPath: string, outputPath: string) => Promise<void>;
  resolveRealPath: (targetPath: string) => Promise<string>;
  verifyOutput: (outputPath: string) => Promise<void>;
};

const createOutputStem = (inputPath: string): string => {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const cleaned = baseName
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "document";
};

export const runMacTextutilDocxConversion = async (inputPath: string, outputPath: string): Promise<void> => {
  await execFileAsync("textutil", ["-convert", "docx", inputPath, "-output", outputPath]);
};

const isPathInsideRoot = (targetPath: string, rootPath: string): boolean => {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const isAllowedInputPath = (targetPath: string, allowedRoots: string[]): boolean =>
  allowedRoots.some((root) => isPathInsideRoot(targetPath, root));
export const convertToDocx = async (
  inputPath: string,
  partialDeps: Partial<ConvertToDocxDeps> = {},
): Promise<DocxConversionResult> => {
  const deps: ConvertToDocxDeps = {
    platform: process.platform,
    tmpDir: os.tmpdir(),
    homeDir: os.homedir(),
    now: () => Date.now(),
    runConversion: runMacTextutilDocxConversion,
    resolveRealPath: (targetPath: string) => fs.realpath(targetPath),
    verifyOutput: (outputPath: string) => fs.access(outputPath),
    ...partialDeps,
  };

  if (deps.platform !== "darwin") {
    return { success: false, error: "Conversion is only supported on macOS" };
  }

  if (typeof inputPath !== "string" || inputPath.trim().length === 0) {
    return { success: false, error: "Input path is required" };
  }

  try {
    const normalizedInputPath = path.resolve(inputPath);
    if (path.extname(normalizedInputPath).toLowerCase() !== ".doc") {
      return { success: false, error: "Only .doc files are supported for conversion" };
    }

    const realInputPath = await deps.resolveRealPath(normalizedInputPath);
    const allowedRoots = [deps.homeDir, deps.tmpDir].map((root) => path.resolve(root));
    if (!isAllowedInputPath(realInputPath, allowedRoots)) {
      return { success: false, error: "Input path is outside allowed roots" };
    }

    const stem = createOutputStem(realInputPath);
    const outputPath = path.join(deps.tmpDir, `${stem}_${deps.now()}.docx`);

    await deps.runConversion(realInputPath, outputPath);
    await deps.verifyOutput(outputPath);

    return { success: true, outputPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
