import type { BudgetAttachment } from "@/types";
import { joinDocHubPath } from "@/shared/dochub/docHub";

const normalizePath = (value: string): string =>
  value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/g, "");

const isWindowsPath = (value: string): boolean => /^[A-Za-z]:[\\/]/.test(value);

const pathsAreCaseInsensitive = (a: string, b: string): boolean =>
  isWindowsPath(a) || isWindowsPath(b);

const pathSegments = (value: string): string[] =>
  normalizePath(value).split("/").filter(Boolean);

const basename = (value: string): string => {
  const segments = pathSegments(value);
  return segments[segments.length - 1] || value.trim();
};

export const isPathInsideDirectory = (
  filePath: string,
  directoryPath: string,
): boolean => {
  const file = normalizePath(filePath);
  const directory = normalizePath(directoryPath);
  const comparableFile = pathsAreCaseInsensitive(file, directory)
    ? file.toLowerCase()
    : file;
  const comparableDirectory = pathsAreCaseInsensitive(file, directory)
    ? directory.toLowerCase()
    : directory;

  return (
    comparableFile === comparableDirectory ||
    comparableFile.startsWith(`${comparableDirectory}/`)
  );
};

export const getRelativePathWithinDirectory = (
  filePath: string,
  directoryPath: string,
): string | null => {
  if (!isPathInsideDirectory(filePath, directoryPath)) {
    return null;
  }

  const fileSegments = pathSegments(filePath);
  const directorySegmentCount = pathSegments(directoryPath).length;
  const relativeSegments = fileSegments.slice(directorySegmentCount);
  if (relativeSegments.length === 0) return null;
  if (relativeSegments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return relativeSegments.join("/");
};

export const resolveBudgetAttachmentPath = (
  tenderFolderPath: string,
  attachment: BudgetAttachment,
): string => {
  const segments = attachment.relativePath
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Neplatná relativní cesta přílohy.");
  }

  return joinDocHubPath(tenderFolderPath, ...segments);
};

export const buildBudgetAttachmentMetadata = (input: {
  filePath: string;
  tenderFolderPath: string;
  size?: number;
}): BudgetAttachment | null => {
  const relativePath = getRelativePathWithinDirectory(
    input.filePath,
    input.tenderFolderPath,
  );

  if (!relativePath) {
    return null;
  }

  return {
    source: "dochub",
    fileName: basename(input.filePath),
    relativePath,
    size: input.size,
    selectedAt: new Date().toISOString(),
    enabled: true,
  };
};
