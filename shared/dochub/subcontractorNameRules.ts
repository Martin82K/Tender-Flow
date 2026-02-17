export type SubcontractorCompanyValidationCode =
  | "EMPTY"
  | "FORBIDDEN_CHARACTER"
  | "CONTROL_CHARACTER"
  | "LEADING_OR_TRAILING_SPACE"
  | "LEADING_OR_TRAILING_DOT"
  | "LEADING_DOUBLE_DOT"
  | "RESERVED_NAME";

export interface SubcontractorCompanyValidationResult {
  isValid: boolean;
  reason?: string;
  code?: SubcontractorCompanyValidationCode;
}

export interface SubcontractorCompanySanitizeResult {
  sanitized: string;
  changed: boolean;
  reasons: string[];
}

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

const RESERVED_HELP_TEXT =
  "CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9";

const getReservedNameBase = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const dotIndex = trimmed.indexOf(".");
  const base = dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
  return base.toUpperCase();
};

const isReservedName = (value: string): boolean => {
  const base = getReservedNameBase(value);
  return base.length > 0 && RESERVED_NAMES.has(base);
};

const addReservedSuffix = (value: string): string => {
  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) {
    return `${value}_`;
  }

  const base = value.slice(0, dotIndex);
  const ext = value.slice(dotIndex + 1);
  return ext ? `${base}_.${ext}` : `${base}_`;
};

export const validateSubcontractorCompanyName = (
  name: string,
): SubcontractorCompanyValidationResult => {
  if (typeof name !== "string") {
    return {
      isValid: false,
      code: "EMPTY",
      reason: "Nazev firmy nesmi byt prazdny.",
    };
  }

  if (name.length === 0 || name.trim().length === 0) {
    return {
      isValid: false,
      code: "EMPTY",
      reason: "Nazev firmy nesmi byt prazdny.",
    };
  }

  if (CONTROL_CHARS_REGEX.test(name)) {
    return {
      isValid: false,
      code: "CONTROL_CHARACTER",
      reason: "Nazev firmy obsahuje nepovoleny ridici znak.",
    };
  }

  if (FORBIDDEN_CHARS_REGEX.test(name)) {
    return {
      isValid: false,
      code: "FORBIDDEN_CHARACTER",
      reason:
        "Nazev firmy obsahuje nepovolene znaky. Nepovolene znaky: \\ / : * ? \" < > |",
    };
  }

  if (name.startsWith(" ") || name.endsWith(" ")) {
    return {
      isValid: false,
      code: "LEADING_OR_TRAILING_SPACE",
      reason: "Nazev firmy nesmi zacinat ani koncit mezerou.",
    };
  }

  if (name.startsWith("..")) {
    return {
      isValid: false,
      code: "LEADING_DOUBLE_DOT",
      reason: "Nazev firmy nesmi zacinat na '..'.",
    };
  }

  if (name.startsWith(".") || name.endsWith(".")) {
    return {
      isValid: false,
      code: "LEADING_OR_TRAILING_DOT",
      reason: "Nazev firmy nesmi zacinat ani koncit teckou.",
    };
  }

  if (isReservedName(name)) {
    return {
      isValid: false,
      code: "RESERVED_NAME",
      reason: `Nazev firmy pouziva rezervovany nazev Windows (${RESERVED_HELP_TEXT}).`,
    };
  }

  return { isValid: true };
};

export const sanitizeSubcontractorCompanyName = (
  name: string,
): SubcontractorCompanySanitizeResult => {
  const original = typeof name === "string" ? name : "";
  const reasons: string[] = [];
  let sanitized = original;

  const replacedForbiddenAndControl = sanitized.replace(
    /[\\/:*?"<>|\u0000-\u001F]/g,
    "_",
  );
  if (replacedForbiddenAndControl !== sanitized) {
    reasons.push("Zakazane znaky byly nahrazeny podtrzitkem.");
    sanitized = replacedForbiddenAndControl;
  }

  const trimmedEdges = sanitized.replace(/^[ .]+|[ .]+$/g, "");
  if (trimmedEdges !== sanitized) {
    reasons.push("Byly odstraneny mezery a tecky na zacatku/konci.");
    sanitized = trimmedEdges;
  }

  if (sanitized.startsWith("..")) {
    sanitized = sanitized.replace(/^\.\.+/, "");
    reasons.push("Byla odstranena uvodni sekvence '..'.");
  }

  if (isReservedName(sanitized)) {
    sanitized = addReservedSuffix(sanitized);
    reasons.push("Byl upraven rezervovany nazev Windows.");
  }

  sanitized = sanitized.replace(/^[ .]+|[ .]+$/g, "");
  if (!sanitized) {
    sanitized = "Neznamy_dodavatel";
    reasons.push("Byla pouzita vychozi hodnota.");
  }

  return {
    sanitized,
    changed: sanitized !== original,
    reasons,
  };
};
