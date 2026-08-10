import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MCP_ONLY_PATTERNS = [
  /^docs\/mcp\//,
  /^mcp-service\//,
  /^plugins\/tender-flow-cz\//,
  /^scripts\/(?:check-mcp-production|mcp-stdio|vercel-build-scope)\.mjs$/,
  /^server\/mcp\//,
  /^shared\/mcp\//,
  /^supabase\/migrations\/[^/]*mcp[^/]*\.sql$/i,
  /^tests\/(?:Mcp|mcp)[^/]*\.test\.tsx?$/,
];

const MCP_RUNTIME_PATTERNS = [
  /^package-lock\.json$/,
  /^mcp-service\//,
  /^server\/mcp\//,
  /^shared\/mcp\//,
];

const normalizeFiles = (changedFiles) => changedFiles
  .map((file) => String(file).trim().replace(/^\.\//, ""))
  .filter(Boolean);

export const shouldBuildApplication = (changedFiles) => {
  const files = normalizeFiles(changedFiles);
  if (files.length === 0) return true;
  return files.some((file) => !MCP_ONLY_PATTERNS.some((pattern) => pattern.test(file)));
};

export const shouldBuildMcpService = (changedFiles) => {
  const files = normalizeFiles(changedFiles);
  if (files.length === 0) return true;
  return files.some((file) => MCP_RUNTIME_PATTERNS.some((pattern) => pattern.test(file)));
};

const readChangedFiles = () => {
  const configuredBase = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();
  const base = configuredBase || "HEAD^";
  try {
    return execFileSync("git", ["diff", "--name-only", base, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).split("\n");
  } catch {
    return [];
  }
};

const isDirectInvocation = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectInvocation) {
  const target = process.argv[2];
  const changedFiles = readChangedFiles();
  const shouldBuild = target === "app"
    ? shouldBuildApplication(changedFiles)
    : target === "mcp"
      ? shouldBuildMcpService(changedFiles)
      : true;

  console.log(shouldBuild
    ? `Vercel ${target || "unknown"} build: required.`
    : `Vercel ${target} build: skipped, no relevant runtime changes.`);
  process.exitCode = shouldBuild ? 1 : 0;
}
