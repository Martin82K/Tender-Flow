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
  now: () => number;
  runConversion: (inputPath: string, outputPath: string) => Promise<void>;
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

export const convertToDocx = async (
  inputPath: string,
  partialDeps: Partial<ConvertToDocxDeps> = {},
): Promise<DocxConversionResult> => {
  const deps: ConvertToDocxDeps = {
    platform: process.platform,
    tmpDir: os.tmpdir(),
    now: () => Date.now(),
    runConversion: runMacTextutilDocxConversion,
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
    const stem = createOutputStem(inputPath);
    const outputPath = path.join(deps.tmpDir, `${stem}_${deps.now()}.docx`);

    await deps.runConversion(inputPath, outputPath);
    await deps.verifyOutput(outputPath);

    return { success: true, outputPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
