#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir =
  process.env.NODE_ENV === "test" && process.env.DESKTOP_BUILD_ENV_TEST_ROOT
    ? resolve(process.env.DESKTOP_BUILD_ENV_TEST_ROOT)
    : join(__dirname, "..");

// Only values that are already exposed to the web renderer via Vite belong here.
// Never add service-role keys, client secrets, refresh tokens, passwords, or private keys.
const publicKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP",
  "VITE_MICROSOFT_LOGIN_ENABLED",
];

const forbiddenPublicKeyPattern = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/i;
const unsafePublicKeys = publicKeys.filter(
  (key) => !key.startsWith("VITE_") || forbiddenPublicKeyPattern.test(key),
);

if (unsafePublicKeys.length > 0) {
  throw new Error(`Unsafe desktop public env key(s): ${unsafePublicKeys.join(", ")}`);
}

const requiredKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];

const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) return {};

  const values = {};
  const content = readFileSync(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!publicKeys.includes(key)) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
};

const values = {
  ...parseEnvFile(join(rootDir, ".env")),
  ...parseEnvFile(join(rootDir, ".env.local")),
};

for (const key of publicKeys) {
  if (process.env[key]) {
    values[key] = process.env[key];
  }
}

const missing = requiredKeys.filter((key) => !values[key]);
const isProductionDesktopBuild = process.env.ELECTRON_BUILD === "true";
if (missing.length > 0 && (process.env.CI === "true" || isProductionDesktopBuild)) {
  throw new Error(`Missing required desktop build env: ${missing.join(", ")}`);
}

const supabasePublicKey = values.VITE_SUPABASE_ANON_KEY;
const isLegacyAnonJwt =
  typeof supabasePublicKey === "string" &&
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(supabasePublicKey);
const isPublishableKey =
  typeof supabasePublicKey === "string" &&
  /^sb_publishable_[A-Za-z0-9_-]+$/.test(supabasePublicKey);

if (supabasePublicKey && /\s/.test(supabasePublicKey)) {
  throw new Error(
    "Invalid desktop build env: VITE_SUPABASE_ANON_KEY must be a single-line JWT",
  );
}

if (supabasePublicKey && !isLegacyAnonJwt && !isPublishableKey) {
  throw new Error(
    "Invalid desktop build env: VITE_SUPABASE_ANON_KEY must be an anon JWT or publishable key",
  );
}

if (isLegacyAnonJwt) {
  let anonKeyPayload;
  try {
    const payloadSegment = supabasePublicKey.split(".")[1];
    anonKeyPayload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf-8"));
  } catch {
    throw new Error(
      "Invalid desktop build env: VITE_SUPABASE_ANON_KEY must contain a valid JWT payload",
    );
  }

  if (anonKeyPayload?.role !== "anon") {
    throw new Error(
      "Invalid desktop build env: VITE_SUPABASE_ANON_KEY must have the anon role",
    );
  }
}

if (isProductionDesktopBuild) {
  try {
    const settingsUrl = new URL("/auth/v1/settings", values.VITE_SUPABASE_URL);
    const response = await fetch(settingsUrl, {
      headers: { apikey: supabasePublicKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Supabase key validation failed");
  } catch {
    throw new Error(
      "Invalid desktop build env: Supabase rejected the configured public key",
    );
  }
}

const buildEnv = {};
for (const key of publicKeys) {
  if (values[key]) {
    buildEnv[key] = values[key];
  }
}

const outputDir = join(rootDir, "desktop", "dist");
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "build-env.json"),
  `${JSON.stringify({ schemaVersion: 1, values: buildEnv }, null, 2)}\n`,
  "utf-8",
);

console.log(`Desktop build env written with ${Object.keys(buildEnv).length} public value(s).`);
