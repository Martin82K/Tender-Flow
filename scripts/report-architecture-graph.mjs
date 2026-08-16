import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { buildArchitectureGraphReport } from "./lib/architecture-graph-report.mjs";

const root = process.cwd();
const MAX_CONFIG_BYTES = 1024 * 1024;
const INITIAL_PLAN_BOOTSTRAP_REF = "fa398a04c2cd09ccc8c5b6d2fc55f92688ffcb47";
const INITIAL_V1_PLAN_DIGEST = "cfa1b32c58c7bcb692f010b9782c2f4131e836ac09ab124fcfb1bb48852d6901";
const INITIAL_V2_PLAN_DIGEST = "47fffd71cdbb68b4b636da30f271fdad7695ec83a0c96956390e00b0a8804de5";
const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const readCurrentPlanDigest = () => sha256(
  fs.readFileSync(path.join(root, "config/architecture-migration-plan.json")),
);

const parseArguments = (args) => {
  const allowed = new Set([
    "--check",
    "--json",
    "--final-integration",
    "--post-merge-integration",
  ]);
  const seen = new Set();
  for (const argument of args) {
    if (!allowed.has(argument)) throw new TypeError(`Neznámý argument ${JSON.stringify(argument)}.`);
    if (seen.has(argument)) throw new TypeError(`Duplicitní argument ${JSON.stringify(argument)}.`);
    seen.add(argument);
  }
  const options = {
    check: seen.has("--check"),
    json: seen.has("--json"),
    finalIntegration: seen.has("--final-integration"),
    postMergeIntegration: seen.has("--post-merge-integration"),
  };
  if ((options.finalIntegration || options.postMergeIntegration) && !options.check) {
    throw new TypeError("Integrační režim lze použít pouze společně s --check.");
  }
  if (options.finalIntegration && options.postMergeIntegration) {
    throw new TypeError("Lze použít pouze jeden integrační režim.");
  }
  return options;
};

const readJsonConfig = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    throw new TypeError(`Nelze načíst ${relativePath}.`);
  }
  if (!stat.isFile()) throw new TypeError(`${relativePath} musí být regulární soubor.`);
  if (stat.size > MAX_CONFIG_BYTES) {
    throw new RangeError(`${relativePath} překračuje limit ${MAX_CONFIG_BYTES} bajtů.`);
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    throw new TypeError(`${relativePath} není validní JSON.`);
  }
};

const assertFinalIntegrationPlan = (plan) => {
  if (
    plan?.version !== 2 ||
    !Array.isArray(plan.loops) ||
    plan.loops.length !== 16 ||
    plan.loops.some((loop) => loop?.status !== "complete")
  ) {
    throw new TypeError("Final integration vyžaduje dokončených všech 16 smyček.");
  }
  const finalMetrics = plan.loops.at(-1)?.completionEvidence?.metrics;
  if (
    !finalMetrics ||
    [
      "legacyNodes",
      "modernToLegacyImports",
      "legacyInternalImports",
      "cyclicComponents",
    ].some((key) => finalMetrics[key] !== 0)
  ) {
    throw new TypeError("Final integration vyžaduje nulovou completionEvidence loop-16.");
  }
};

const assertBaselineIsFirstParent = (baselineRef) => {
  let baselineSha;
  let firstParentSha;
  try {
    baselineSha = execFileSync("git", ["rev-parse", `${baselineRef}^{commit}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    firstParentSha = execFileSync("git", ["rev-parse", "HEAD^1"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new TypeError("Final integration baseline musí být prvním rodičem kontrolovaného HEAD.");
  }
  if (baselineSha !== firstParentSha) {
    throw new TypeError("Final integration baseline musí být prvním rodičem kontrolovaného HEAD.");
  }
};

const assertBaselineIsStrictFirstParentAncestor = (baselineRef) => {
  let baselineSha;
  let headSha;
  try {
    baselineSha = execFileSync("git", ["rev-parse", `${baselineRef}^{commit}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    headSha = execFileSync("git", ["rev-parse", "HEAD^{commit}"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const firstParentHistory = execFileSync(
      "git",
      ["rev-list", "--first-parent", "HEAD"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim().split("\n");
    if (baselineSha === headSha || !firstParentHistory.includes(baselineSha)) throw new Error();
  } catch {
    throw new TypeError(
      "Post-merge integration baseline musí být striktním předkem na first-parent historii HEAD.",
    );
  }
};

const readPreviousPlan = ({ finalIntegration, postMergeIntegration, plan }) => {
  const integrationTransition = finalIntegration || postMergeIntegration;
  const baselineRef = process.env.ARCHITECTURE_GRAPH_BASELINE_REF;
  if (!baselineRef) {
    if (integrationTransition) throw new TypeError("Integrační režim vyžaduje Git baseline ref.");
    return undefined;
  }
  try {
    execFileSync("git", ["cat-file", "-e", `${baselineRef}^{commit}`], {
      cwd: root,
      stdio: "pipe",
    });
  } catch {
    throw new TypeError(`Nelze načíst Git baseline ref ${baselineRef}.`);
  }
  try {
    execFileSync(
      "git",
      ["cat-file", "-e", `${baselineRef}:config/architecture-migration-plan.json`],
      { cwd: root, stdio: "pipe" },
    );
  } catch {
    if (integrationTransition) {
      assertFinalIntegrationPlan(plan);
      if (finalIntegration) assertBaselineIsFirstParent(baselineRef);
      else assertBaselineIsStrictFirstParentAncestor(baselineRef);
      return undefined;
    }
    if (
      baselineRef === INITIAL_PLAN_BOOTSTRAP_REF &&
      readCurrentPlanDigest() === INITIAL_V2_PLAN_DIGEST
    ) {
      return { version: 0, __trustedSourceDigest: INITIAL_V2_PLAN_DIGEST };
    }
    throw new TypeError(
      `Git baseline ref ${baselineRef} neobsahuje config/architecture-migration-plan.json.`,
    );
  }
  try {
    const content = execFileSync(
      "git",
      ["show", `${baselineRef}:config/architecture-migration-plan.json`],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (Buffer.byteLength(content, "utf8") > MAX_CONFIG_BYTES) {
      throw new RangeError(`Git migration plan překračuje limit ${MAX_CONFIG_BYTES} bajtů.`);
    }
    const parsed = JSON.parse(content);
    if (parsed?.version === 1) {
      if (
        sha256(content) !== INITIAL_V1_PLAN_DIGEST ||
        readCurrentPlanDigest() !== INITIAL_V2_PLAN_DIGEST
      ) {
        throw new TypeError("Jednorázová migrace architecture planu nemá očekávané digesty.");
      }
      Object.defineProperty(parsed, "__trustedSourceDigest", {
        value: INITIAL_V1_PLAN_DIGEST,
        enumerable: false,
      });
    }
    return parsed;
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new TypeError(`Nelze načíst migration plan z Git baseline ref ${baselineRef}.`);
  }
};

const printHumanReport = (report) => {
  const expectedUnresolved = report.summary.unresolvedImports
    - report.resolution.unexpectedUnresolved.length;
  console.log(`Architecture graph ${report.status === "ok" ? "OK" : "FAILED"}`);
  console.log(`Source nodes: ${report.summary.sourceNodes}`);
  console.log(`Raw imports: ${report.summary.rawImports}`);
  console.log(`Resolved imports: ${report.summary.resolvedImports}`);
  console.log(
    `Unresolved imports: ${report.summary.unresolvedImports} `
    + `(expected: ${expectedUnresolved}, unexpected: ${report.resolution.unexpectedUnresolved.length})`,
  );
  console.log(`Ambiguous imports: ${report.summary.ambiguousImports}`);
  console.log(
    `Legacy: ${report.summary.legacyNodes} nodes, `
    + `${report.summary.modernToLegacyImports} incoming imports, `
    + `${report.summary.legacyInternalImports} internal imports`,
  );
  console.log(
    `SCC: ${report.summary.stronglyConnectedComponents} `
    + `(cyclic: ${report.summary.cyclicComponents})`,
  );
  console.log(`Dependency-first batches: ${report.summary.dependencyBatches}`);
  const current = report.plan.inProgress === null ? "none" : `${report.plan.inProgress} in progress`;
  console.log(`Migration plan: ${report.plan.complete}/${report.plan.total} complete, ${current}`);
};

const printViolationGroup = (title, violations, formatter) => {
  if (violations.length === 0) return;
  console.error(title);
  for (const item of violations) console.error(`- ${formatter(item)}`);
};

const printViolations = (report) => {
  const byCode = (code) => report.violations.filter((item) => item.code === code);
  printViolationGroup("Graf nelze bezpečně sestavit:", byCode("collection-error"), ({ message }) => message);
  printViolationGroup("Nejednoznačné importy:", byCode("ambiguous-import"), (item) =>
    `${item.file}: ${JSON.stringify(item.specifier)} -> ${item.candidates.join(", ")}`);
  printViolationGroup(
    "Nečekaně nerozřešené zdrojové importy:",
    byCode("unexpected-unresolved-import"),
    (item) => `${item.file}: ${JSON.stringify(item.specifier)} -> ${item.target}`,
  );
  const alreadyPrinted = new Set([
    "collection-error",
    "ambiguous-import",
    "unexpected-unresolved-import",
  ]);
  printViolationGroup(
    "Architecture graph policy není aktuální:",
    report.violations.filter(({ code }) => !alreadyPrinted.has(code)),
    ({ message }) => message,
  );
};

const main = () => {
  const options = parseArguments(process.argv.slice(2));
  const policy = readJsonConfig("config/architecture-graph-policy.json");
  const plan = readJsonConfig("config/architecture-migration-plan.json");
  const previousPlan = readPreviousPlan({
    finalIntegration: options.finalIntegration,
    postMergeIntegration: options.postMergeIntegration,
    plan,
  });
  const report = buildArchitectureGraphReport({ root, policy, plan, previousPlan });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    if (report.status === "ok" || !options.check) printHumanReport(report);
  }

  if (report.status !== "ok") {
    printViolations(report);
    if (options.check) process.exitCode = 1;
  }
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Neznámá chyba architektonického grafu.";
  console.error(`Neplatný kontrakt architektonického grafu: ${message}`);
  process.exitCode = 2;
}
