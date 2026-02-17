#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();

const FORBIDDEN_CHARS_REGEX = /[\\/:*?"<>|]/;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F]/;
const RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

const readDotEnv = () => {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, "utf8");
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    parsed[key] = value;
  }
  return parsed;
};

const getReservedNameBase = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const dotIndex = trimmed.indexOf(".");
  const base = dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
  return base.toUpperCase();
};

const isReservedName = (value) => {
  const base = getReservedNameBase(value);
  return base.length > 0 && RESERVED_NAMES.has(base);
};

const addReservedSuffix = (value) => {
  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) return `${value}_`;
  const base = value.slice(0, dotIndex);
  const ext = value.slice(dotIndex + 1);
  return ext ? `${base}_.${ext}` : `${base}_`;
};

const validateName = (name) => {
  if (typeof name !== "string" || name.length === 0 || name.trim().length === 0) {
    return { isValid: false, reason: "Nazev firmy nesmi byt prazdny." };
  }
  if (CONTROL_CHARS_REGEX.test(name)) {
    return { isValid: false, reason: "Nazev firmy obsahuje nepovoleny ridici znak." };
  }
  if (FORBIDDEN_CHARS_REGEX.test(name)) {
    return {
      isValid: false,
      reason: "Nazev firmy obsahuje nepovolene znaky. Nepovolene znaky: \\ / : * ? \" < > |",
    };
  }
  if (name.startsWith(" ") || name.endsWith(" ")) {
    return { isValid: false, reason: "Nazev firmy nesmi zacinat ani koncit mezerou." };
  }
  if (name.startsWith(".") || name.endsWith(".")) {
    return { isValid: false, reason: "Nazev firmy nesmi zacinat ani koncit teckou." };
  }
  if (name.startsWith("..")) {
    return { isValid: false, reason: "Nazev firmy nesmi zacinat na '..'." };
  }
  if (isReservedName(name)) {
    return {
      isValid: false,
      reason: "Nazev firmy pouziva rezervovany nazev Windows (CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9).",
    };
  }
  return { isValid: true };
};

const sanitizeName = (name) => {
  let sanitized = typeof name === "string" ? name : "";
  sanitized = sanitized.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_");
  sanitized = sanitized.replace(/^[ .]+|[ .]+$/g, "");
  sanitized = sanitized.replace(/^\.\.+/, "");
  if (isReservedName(sanitized)) {
    sanitized = addReservedSuffix(sanitized);
  }
  sanitized = sanitized.replace(/^[ .]+|[ .]+$/g, "");
  if (!sanitized) sanitized = "Neznamy_dodavatel";
  return sanitized;
};

const run = async () => {
  const envFromFile = readDotEnv();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || envFromFile.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || envFromFile.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from("subcontractors")
    .select("id, company_name")
    .order("company_name", { ascending: true });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const invalid = [];
  for (const row of data || []) {
    const companyName = row.company_name || "";
    const validation = validateName(companyName);
    if (validation.isValid) continue;

    invalid.push({
      id: row.id,
      company_name: companyName,
      reason: validation.reason,
      suggested_name: sanitizeName(companyName),
    });
  }

  const auditDir = path.join(rootDir, "audit");
  fs.mkdirSync(auditDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(
    auditDir,
    `invalid-subcontractor-names-${today}.json`,
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    totalRows: (data || []).length,
    invalidRows: invalid.length,
    items: invalid,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Audit complete. Invalid rows: ${invalid.length}.`);
  console.log(`Output: ${path.relative(rootDir, outputPath)}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
