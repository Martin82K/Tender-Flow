const path = require("path");
const fs = require("fs");
const asar = require("@electron/asar");

const REQUIRED_RUNTIME_PAIRS = [
  {
    packageName: "exceljs",
    requiredPackageName: "jszip",
  },
];

const normalizeAsarPath = (entry) => (entry.startsWith("/") ? entry : `/${entry}`);

const hasEntry = (entries, entry) => entries.has(normalizeAsarPath(entry));

const findPackageRoots = (entries, packageName) => {
  const packageJsonSuffix = `/node_modules/${packageName}/package.json`;
  return [...entries]
    .filter((entry) => entry.endsWith(packageJsonSuffix))
    .map((entry) => entry.slice(0, -packageJsonSuffix.length));
};

const verifyAsarEntries = (rawEntries) => {
  const entries = new Set(rawEntries.map(normalizeAsarPath));
  const errors = [];

  for (const pair of REQUIRED_RUNTIME_PAIRS) {
    const packageRoots = findPackageRoots(entries, pair.packageName);

    if (packageRoots.length === 0) {
      errors.push(`Missing runtime package: ${pair.packageName}`);
      continue;
    }

    for (const root of packageRoots) {
      const requiredPackageJson = `${root}/node_modules/${pair.requiredPackageName}/package.json`;
      if (!hasEntry(entries, requiredPackageJson)) {
        const packagePath = `${root}/node_modules/${pair.packageName}`;
        errors.push(
          `Missing ${pair.requiredPackageName} next to ${packagePath}; packaged app will fail at runtime.`,
        );
      }
    }
  }

  return errors;
};

const verifyAsarFile = (asarPath) => {
  const entries = asar.listPackage(asarPath);
  const errors = verifyAsarEntries(entries);
  if (errors.length > 0) {
    throw new Error(`Invalid Electron ASAR runtime dependencies in ${asarPath}:\n${errors.join("\n")}`);
  }
};

const findAsarInAppOutDir = (appOutDir, productFilename = "Tender Flow") => {
  const directAsarPath = path.join(appOutDir, "resources", "app.asar");
  const macAsarPath = path.join(appOutDir, `${productFilename}.app`, "Contents", "Resources", "app.asar");

  return [directAsarPath, macAsarPath];
};

const verifyElectronBuilderOutput = async (context) => {
  const productFilename = context.packager?.appInfo?.productFilename;
  const candidates = findAsarInAppOutDir(context.appOutDir, productFilename);
  const existingCandidates = candidates.filter((candidate) => {
    try {
      fs.accessSync(candidate);
      return true;
    } catch {
      return false;
    }
  });

  if (existingCandidates.length === 0) {
    throw new Error(`Cannot find app.asar in Electron build output: ${context.appOutDir}`);
  }

  for (const asarPath of existingCandidates) {
    verifyAsarFile(asarPath);
  }
};

module.exports = verifyElectronBuilderOutput;
module.exports.verifyAsarEntries = verifyAsarEntries;
module.exports.verifyAsarFile = verifyAsarFile;

if (require.main === module) {
  const asarPaths = process.argv.slice(2);
  if (asarPaths.length === 0) {
    console.error("Usage: node scripts/verify-electron-asar-runtime.cjs <path-to-app.asar> [...]");
    process.exit(1);
  }

  try {
    for (const asarPath of asarPaths) {
      verifyAsarFile(asarPath);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
