import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ContactPerson, StatusConfig, Subcontractor } from "../types";

export type ContactsImportSource =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string };

export type TFFieldKey =
  | "company"
  | "ico"
  | "region"
  | "specialization"
  | "status"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
  | "contactPosition";

export type FieldMapping = Record<TFFieldKey, string | null>;

export interface ParsedTable {
  sourceLabel: string;
  headers: string[];
  rows: Array<Record<string, any>>;
}

export interface AnalyzeOptions {
  defaultStatusId: string;
  statuses: StatusConfig[];
  existingContacts: Subcontractor[];
}

export type RowOutcome = "imported" | "imported_with_warning" | "not_imported";

export interface AnalyzedRow {
  rowIndex: number; // 1-based (excluding header)
  source: Record<string, any>;
  mapped: {
    company: string;
    ico: string;
    region: string;
    specializationRaw: string;
    statusRaw: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    contactPosition: string;
  };
  outcome: RowOutcome;
  warnings: string[];
  errors: string[];
}

export interface AnalyzeResult {
  rows: AnalyzedRow[];
  aggregatedContacts: Subcontractor[];
  counts: {
    imported: number;
    importedWithWarning: number;
    notImported: number;
  };
}

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "" || value.trim() === "-";
  return false;
};

const valueAsString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
};

const splitSpecializations = (value: string): string[] => {
  const normalized = value.trim();
  if (!normalized) return [];
  return normalized
    .split(/[;,|/]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
};

const deriveCompanyFromEmail = (email: string): string | null => {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  const domain = normalized.slice(at + 1);
  if (!domain) return null;
  return domain;
};

const buildExistingEmailIndex = (existingContacts: Subcontractor[]) => {
  const emailToCompanyKey = new Map<string, string>();
  for (const c of existingContacts) {
    const companyKey = normalizeText(c.company || "");
    for (const person of c.contacts || []) {
      const email = normalizeEmail(person.email || "");
      if (!email || email === "-") continue;
      if (!emailToCompanyKey.has(email)) {
        emailToCompanyKey.set(email, companyKey);
      }
    }
    const legacyEmail = normalizeEmail(c.email || "");
    if (legacyEmail && legacyEmail !== "-" && !emailToCompanyKey.has(legacyEmail)) {
      emailToCompanyKey.set(legacyEmail, companyKey);
    }
  }
  return emailToCompanyKey;
};

export const getTenderFlowImportFields = () => {
  const fields: Array<{ key: TFFieldKey; label: string; hint: string }> = [
    { key: "company", label: "Firma", hint: "Název firmy / společnosti" },
    { key: "ico", label: "IČO", hint: "IČO firmy" },
    { key: "region", label: "Region", hint: "Kraj / město / lokalita" },
    { key: "specialization", label: "Specializace", hint: "Obor, typ prací (lze víc hodnot)" },
    { key: "status", label: "Stav", hint: "Např. Dostupný / Dovolená (podle vašich stavů)" },
    { key: "contactName", label: "Jméno", hint: "Kontaktní osoba" },
    { key: "contactEmail", label: "Email", hint: "Email kontaktu" },
    { key: "contactPhone", label: "Telefon", hint: "Telefon kontaktu" },
    { key: "contactPosition", label: "Pozice", hint: "Pozice / role kontaktu" },
  ];
  return fields;
};

const FIELD_SYNONYMS: Record<TFFieldKey, string[]> = {
  company: [
    "firma",
    "nazev firmy",
    "spolecnost",
    "společnost",
    "company",
    "dodavatel",
    "subdodavatel",
    "supplier",
    "partner",
    "organizace",
  ],
  ico: ["ico", "ičo", "iČo", "ic", "dic", "dič", "ič", "ičo (bez mezer)"],
  region: ["region", "kraj", "mesto", "město", "lokalita", "city", "area", "kraj/region"],
  specialization: ["specializace", "typ", "obor", "trade", "category", "kategorie"],
  status: ["stav", "status"],
  contactName: ["jmeno", "jméno", "name", "kontakt", "osoba", "kontaktni osoba", "contact"],
  contactEmail: ["email", "e-mail", "mail"],
  contactPhone: ["telefon", "phone", "tel", "mobil", "mobile"],
  contactPosition: ["pozice", "funkce", "role", "position", "job title", "pracovni pozice"],
};

const findBestHeaderForField = (headers: string[], field: TFFieldKey): string | null => {
  const normalizedHeaders = headers.map((h) => ({
    raw: h,
    norm: normalizeText(h),
  }));

  const synonyms = FIELD_SYNONYMS[field].map((s) => normalizeText(s));

  for (const syn of synonyms) {
    const exact = normalizedHeaders.find((h) => h.norm === syn);
    if (exact) return exact.raw;
  }
  for (const syn of synonyms) {
    const partial = normalizedHeaders.find((h) => h.norm.includes(syn) || syn.includes(h.norm));
    if (partial) return partial.raw;
  }
  return null;
};

export const suggestFieldMapping = (headers: string[]): FieldMapping => {
  return {
    company: findBestHeaderForField(headers, "company"),
    ico: findBestHeaderForField(headers, "ico"),
    region: findBestHeaderForField(headers, "region"),
    specialization: findBestHeaderForField(headers, "specialization"),
    status: findBestHeaderForField(headers, "status"),
    contactName: findBestHeaderForField(headers, "contactName"),
    contactEmail: findBestHeaderForField(headers, "contactEmail"),
    contactPhone: findBestHeaderForField(headers, "contactPhone"),
    contactPosition: findBestHeaderForField(headers, "contactPosition"),
  };
};

const guessFileTypeFromNameOrContentType = (
  nameOrUrl: string,
  contentType?: string
): "csv" | "xlsx" | "unknown" => {
  const lower = nameOrUrl.toLowerCase();
  if (lower.includes(".csv") || lower.includes("format=csv")) return "csv";
  if (lower.includes(".xlsx")) return "xlsx";
  if (contentType) {
    if (contentType.includes("csv") || contentType.includes("text/")) return "csv";
    if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "xlsx";
  }
  if (lower.includes("docs.google.com/spreadsheets")) return "csv";
  return "unknown";
};

const stripTitleLineIfPresent = (text: string) => {
  const lines = text.split("\n");
  if (lines.length < 2) return text;
  const first = lines[0];
  const second = lines[1];
  const firstHasDelim = first.includes(";") || first.includes(",");
  const secondHasDelim = second.includes(";") || second.includes(",");
  if (!firstHasDelim && secondHasDelim) return lines.slice(1).join("\n");
  return text;
};

export const parseContactsImportSource = async (source: ContactsImportSource): Promise<ParsedTable> => {
  if (source.kind === "file") {
    const fileType = guessFileTypeFromNameOrContentType(source.file.name, source.file.type);
    if (fileType === "unknown") {
      throw new Error("Nepodporovaný typ souboru. Použijte CSV nebo XLSX.");
    }
    if (fileType === "csv") {
      const text = stripTitleLineIfPresent(await source.file.text());
      const result = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      const rows = (result.data || []).filter((r) => r && Object.keys(r).length > 0);
      const headers = (result.meta?.fields || Object.keys(rows[0] || {})).filter(Boolean);
      return { sourceLabel: source.file.name, headers, rows };
    }

    const data = await source.file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
    const headerRow = (aoa[0] || []).map((h) => valueAsString(h));
    const headers = headerRow.map((h) => h.trim()).filter(Boolean);

    const rows: Array<Record<string, any>> = [];
    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      const obj: Record<string, any> = {};
      let hasAny = false;
      for (let col = 0; col < headers.length; col++) {
        const header = headers[col];
        const cell = row[col];
        const cellValue = valueAsString(cell);
        if (!isEmptyValue(cellValue)) hasAny = true;
        obj[header] = cellValue;
      }
      if (hasAny) rows.push(obj);
    }

    return { sourceLabel: source.file.name, headers, rows };
  }

  const response = await fetch(source.url, {
    method: "GET",
    mode: "cors",
    headers: {
      Accept:
        "text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel",
    },
  });

  if (!response.ok) {
    throw new Error(`Nepodařilo se stáhnout soubor: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const fileType = guessFileTypeFromNameOrContentType(source.url, blob.type);
  if (fileType === "unknown") {
    throw new Error("Nepodporovaný typ souboru na URL. Použijte CSV nebo XLSX.");
  }

  if (fileType === "csv") {
    const text = stripTitleLineIfPresent(await blob.text());
    const result = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    const rows = (result.data || []).filter((r) => r && Object.keys(r).length > 0);
    const headers = (result.meta?.fields || Object.keys(rows[0] || {})).filter(Boolean);
    return { sourceLabel: source.url, headers, rows };
  }

  const data = await blob.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
  const headerRow = (aoa[0] || []).map((h) => valueAsString(h));
  const headers = headerRow.map((h) => h.trim()).filter(Boolean);

  const rows: Array<Record<string, any>> = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const obj: Record<string, any> = {};
    let hasAny = false;
    for (let col = 0; col < headers.length; col++) {
      const header = headers[col];
      const cell = row[col];
      const cellValue = valueAsString(cell);
      if (!isEmptyValue(cellValue)) hasAny = true;
      obj[header] = cellValue;
    }
    if (hasAny) rows.push(obj);
  }

  return { sourceLabel: source.url, headers, rows };
};

export const analyzeContactsImport = (
  table: ParsedTable,
  mapping: FieldMapping,
  options: AnalyzeOptions
): AnalyzeResult => {
  const existingCompanyByKey = new Map(
    options.existingContacts
      .map((c) => [normalizeText(c.company || ""), c] as const)
      .filter(([k]) => Boolean(k))
  );
  const existingCompanyKeys = new Set(existingCompanyByKey.keys());
  const existingEmailIndex = buildExistingEmailIndex(options.existingContacts); // email -> companyKey
  const statusByLabel = new Map(options.statuses.map((s) => [normalizeText(s.label), s.id] as const));

  const emailOccurrences = new Map<string, number>();
  for (const row of table.rows) {
    const emailHeader = mapping.contactEmail;
    if (!emailHeader) continue;
    const email = normalizeEmail(valueAsString(row[emailHeader]));
    if (!email) continue;
    emailOccurrences.set(email, (emailOccurrences.get(email) || 0) + 1);
  }

  const analyzedRows: AnalyzedRow[] = table.rows.map((sourceRow, idx) => {
    const getMapped = (key: TFFieldKey) => {
      const header = mapping[key];
      if (!header) return "";
      return valueAsString(sourceRow[header]);
    };

    const companyRaw = getMapped("company");
    const emailRaw = getMapped("contactEmail");
    const company = companyRaw;
    const contactEmail = normalizeEmail(emailRaw);

    const mapped = {
      company: companyRaw,
      ico: getMapped("ico"),
      region: getMapped("region"),
      specializationRaw: getMapped("specialization"),
      statusRaw: getMapped("status"),
      contactName: getMapped("contactName"),
      contactEmail,
      contactPhone: getMapped("contactPhone"),
      contactPosition: getMapped("contactPosition"),
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    const hasCompany = !isEmptyValue(companyRaw);
    const hasEmail = !isEmptyValue(contactEmail);

    if (!hasCompany && !hasEmail) {
      errors.push("Chybí firma i email (minimální požadavek).");
    }

    if (!hasCompany && hasEmail) {
      const derived = deriveCompanyFromEmail(contactEmail);
      if (derived) {
        mapped.company = derived;
        warnings.push("Firma doplněna z domény emailu.");
      } else {
        mapped.company = "Neznámá firma";
        warnings.push("Firma nevyplněna – použita výchozí hodnota.");
      }
    }

    if (hasCompany && normalizeText(mapped.company) !== normalizeText(companyRaw)) {
      // derived/normalized override happened; keep warning already
    }

    if (isEmptyValue(mapped.contactName) && isEmptyValue(mapped.contactPhone) && isEmptyValue(mapped.contactEmail)) {
      warnings.push("Řádek nemá vyplněné kontaktní údaje (jméno/telefon/email).");
    }

    if (mapped.contactEmail && (emailOccurrences.get(mapped.contactEmail) || 0) > 1) {
      warnings.push("Duplicitní email v importu.");
    }

    const companyKey = normalizeText(mapped.company || "");
    if (companyKey && existingCompanyKeys.has(companyKey)) {
      warnings.push("Duplicitní firma – dojde k aktualizaci existujícího záznamu.");
    }
    if (mapped.contactEmail && existingEmailIndex.has(mapped.contactEmail)) {
      warnings.push("Duplicitní email – firma už existuje v databázi.");
    }

    if (!isEmptyValue(mapped.statusRaw)) {
      const statusId = statusByLabel.get(normalizeText(mapped.statusRaw));
      if (!statusId) {
        warnings.push("Neznámý stav – použije se výchozí.");
      }
    }

    // Decide whether the row would actually change anything in DB.
    const matchedCompanyKey = (() => {
      const ck = normalizeText(mapped.company || "");
      if (ck && existingCompanyKeys.has(ck)) return ck;
      if (mapped.contactEmail && existingEmailIndex.has(mapped.contactEmail)) {
        return existingEmailIndex.get(mapped.contactEmail)!;
      }
      return null;
    })();

    const existing = matchedCompanyKey ? existingCompanyByKey.get(matchedCompanyKey) : undefined;

    const wouldAddAnything = (() => {
      if (!existing) return true;

      const existingSpecKeys = new Set((existing.specialization || []).map((s) => normalizeText(s)));
      const incomingSpecKeys = splitSpecializations(mapped.specializationRaw).map((s) => normalizeText(s));
      const addsSpec = incomingSpecKeys.some((s) => s && !existingSpecKeys.has(s));

      const existingContactKeys = new Set(
        (existing.contacts || []).map((p) => {
          const e = normalizeEmail(p.email || "");
          if (e && e !== "-") return `email:${e}`;
          const phone = valueAsString(p.phone || "");
          if (phone && phone !== "-") return `phone:${phone}`;
          return `name:${normalizeText(p.name || "")}`;
        })
      );

      const hasAnyContactData =
        !isEmptyValue(mapped.contactName) || !isEmptyValue(mapped.contactEmail) || !isEmptyValue(mapped.contactPhone);

      const incomingContactKey = (() => {
        if (!hasAnyContactData) return null;
        const e = normalizeEmail(mapped.contactEmail || "");
        if (e && e !== "-") return `email:${e}`;
        const phone = valueAsString(mapped.contactPhone || "");
        if (phone && phone !== "-") return `phone:${phone}`;
        const n = normalizeText(mapped.contactName || "");
        if (n) return `name:${n}`;
        return null;
      })();

      const addsContact = incomingContactKey ? !existingContactKeys.has(incomingContactKey) : false;

      const addsIco = !isEmptyValue(mapped.ico) && isEmptyValue(existing.ico);
      const addsRegion = !isEmptyValue(mapped.region) && isEmptyValue(existing.region);

      return addsSpec || addsContact || addsIco || addsRegion;
    })();

    let outcome: RowOutcome = "imported";
    if (errors.length > 0) {
      outcome = "not_imported";
    } else if (existing && !wouldAddAnything) {
      outcome = "not_imported";
      warnings.push("Duplicitní řádek – v databázi už existuje (bez změn).");
    } else if (existing) {
      outcome = "imported_with_warning";
      warnings.push("Firma/email už existuje – doplním jen chybějící data.");
    } else if (warnings.length > 0) {
      outcome = "imported_with_warning";
    }

    return {
      rowIndex: idx + 1,
      source: sourceRow,
      mapped,
      outcome,
      warnings,
      errors,
    };
  });

  // Aggregate into subcontractors (one company = one record, multiple contacts allowed)
  const byCompanyKey = new Map<
    string,
    {
      displayCompany: string;
      canonicalKey: string;
      ico?: string;
      region?: string;
      specialization: Set<string>;
      statusId: string;
      contacts: ContactPerson[];
      warnings: string[];
    }
  >();

  const dedupePersonKey = (p: ContactPerson) => {
    const email = normalizeEmail(p.email || "");
    if (email && email !== "-") return `email:${email}`;
    const phone = valueAsString(p.phone || "");
    if (phone && phone !== "-") return `phone:${phone}`;
    return `name:${normalizeText(p.name || "")}`;
  };

  const ensureNonEmpty = (v: string, fallback: string) => (isEmptyValue(v) ? fallback : v);

  for (const row of analyzedRows) {
    if (row.outcome === "not_imported") continue;

    const rawCompany = ensureNonEmpty(row.mapped.company, "Neznámá firma");
    const rowCompanyKey = normalizeText(rawCompany);
    const matchedKeyFromEmail =
      row.mapped.contactEmail && existingEmailIndex.has(row.mapped.contactEmail)
        ? existingEmailIndex.get(row.mapped.contactEmail)!
        : null;
    const canonicalKey =
      (rowCompanyKey && existingCompanyKeys.has(rowCompanyKey) ? rowCompanyKey : null) || matchedKeyFromEmail || rowCompanyKey;
    if (!canonicalKey) continue;

    const existing = existingCompanyByKey.get(canonicalKey);
    const company = existing?.company || rawCompany;

    const statusId = (() => {
      // For existing companies, preserve current status (incremental import).
      if (existing?.status) return existing.status;
      if (isEmptyValue(row.mapped.statusRaw)) return options.defaultStatusId;
      const matched = statusByLabel.get(normalizeText(row.mapped.statusRaw));
      return matched || options.defaultStatusId;
    })();

    if (!byCompanyKey.has(canonicalKey)) {
      byCompanyKey.set(canonicalKey, {
        displayCompany: company,
        canonicalKey,
        ico: isEmptyValue(row.mapped.ico) ? undefined : row.mapped.ico,
        region: isEmptyValue(row.mapped.region) ? undefined : row.mapped.region,
        specialization: new Set<string>(),
        statusId,
        contacts: [],
        warnings: [],
      });
    }

    const entry = byCompanyKey.get(canonicalKey)!;
    entry.displayCompany = entry.displayCompany || company;
    // Only fill missing ico/region (do not overwrite existing).
    if (existing) {
      entry.ico = isEmptyValue(existing.ico) ? (entry.ico || (isEmptyValue(row.mapped.ico) ? undefined : row.mapped.ico)) : existing.ico;
      entry.region = isEmptyValue(existing.region)
        ? (entry.region || (isEmptyValue(row.mapped.region) ? undefined : row.mapped.region))
        : existing.region;
    } else {
      entry.ico = entry.ico || (isEmptyValue(row.mapped.ico) ? undefined : row.mapped.ico);
      entry.region = entry.region || (isEmptyValue(row.mapped.region) ? undefined : row.mapped.region);
    }
    entry.statusId = entry.statusId || statusId;

    const specs = splitSpecializations(row.mapped.specializationRaw);
    if (existing) {
      const existingSpecKeys = new Set((existing.specialization || []).map((s) => normalizeText(s)));
      for (const s of specs) {
        const key = normalizeText(s);
        if (key && !existingSpecKeys.has(key)) entry.specialization.add(s);
      }
    } else {
      for (const s of specs) entry.specialization.add(s);
    }

    const hasAnyContactData =
      !isEmptyValue(row.mapped.contactName) || !isEmptyValue(row.mapped.contactEmail) || !isEmptyValue(row.mapped.contactPhone);
    if (hasAnyContactData) {
      const contact: ContactPerson = {
        id: crypto.randomUUID(),
        name: ensureNonEmpty(row.mapped.contactName, "-"),
        email: ensureNonEmpty(row.mapped.contactEmail, "-"),
        phone: ensureNonEmpty(row.mapped.contactPhone, "-"),
        position: isEmptyValue(row.mapped.contactPosition) ? undefined : row.mapped.contactPosition,
      };

      const personKey = dedupePersonKey(contact);
      const existingPersonKeys = new Set(entry.contacts.map(dedupePersonKey));
      if (existing) {
        const existingDbKeys = new Set((existing.contacts || []).map(dedupePersonKey));
        if (!existingDbKeys.has(personKey) && !existingPersonKeys.has(personKey)) {
          entry.contacts.push(contact);
        } else {
          entry.warnings.push("Duplicitní kontakt – už je v databázi.");
        }
      } else if (!existingPersonKeys.has(personKey)) {
        entry.contacts.push(contact);
      } else {
        entry.warnings.push("Duplicitní kontakt v rámci firmy byl ignorován.");
      }
    }
  }

  const aggregatedContacts: Subcontractor[] = Array.from(byCompanyKey.values()).map((entry) => {
    const isExisting = existingCompanyByKey.has(entry.canonicalKey);
    // Keep delta minimal: if no new contacts were detected, keep empty array.
    const contacts = entry.contacts;

    const specialization =
      entry.specialization.size > 0 ? Array.from(entry.specialization) : isExisting ? [] : ["Ostatní"];

    return {
      id: crypto.randomUUID(),
      company: entry.displayCompany || "Neznámá firma",
      specialization,
      contacts,
      ico: entry.ico || "-",
      region: entry.region || "-",
      status: entry.statusId || options.defaultStatusId,
      name: contacts[0]?.name || "-",
      email: contacts[0]?.email || "-",
      phone: contacts[0]?.phone || "-",
    };
  });

  const counts = analyzedRows.reduce(
    (acc, r) => {
      if (r.outcome === "imported") acc.imported++;
      else if (r.outcome === "imported_with_warning") acc.importedWithWarning++;
      else acc.notImported++;
      return acc;
    },
    { imported: 0, importedWithWarning: 0, notImported: 0 }
  );

  return { rows: analyzedRows, aggregatedContacts, counts };
};

export const buildCorrectedWorkbook = (table: ParsedTable, analyzed: AnalyzeResult) => {
  const baseHeaders = table.headers;
  const extraHeaders = ["__tf_outcome", "__tf_warnings", "__tf_errors"];
  const headerRow = [...baseHeaders, ...extraHeaders];

  const aoa: any[][] = [headerRow];
  for (let i = 0; i < analyzed.rows.length; i++) {
    const row = analyzed.rows[i];
    const base = baseHeaders.map((h) => valueAsString(row.source[h]));
    const extra = [
      row.outcome,
      row.warnings.join(" | "),
      row.errors.join(" | "),
    ];
    aoa.push([...base, ...extra]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  return wb;
};

export const downloadWorkbook = (wb: XLSX.WorkBook, filename: string) => {
  XLSX.writeFile(wb, filename);
};

export const buildTemplateWorkbook = () => {
  const headers = ["Firma", "IČO", "Region", "Specializace", "Jméno", "Email", "Telefon", "Pozice", "Stav"];
  const example = [
    ["STŘECHY PROFESIONAL s.r.o.", "12345678", "Praha", "Střechy; Klempíř", "Jan Novák", "jan@strechy.cz", "+420 777 000 000", "Obchod", "Dostupný"],
    ["STŘECHY PROFESIONAL s.r.o.", "12345678", "Praha", "Střechy; Klempíř", "Petr Svoboda", "petr@strechy.cz", "+420 777 111 111", "Technik", "Dostupný"],
  ];
  const aoa = [headers, ...example];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kontakty");

  const notes = [
    ["Tender Flow import – šablona"],
    [""],
    ["Jak to funguje:"],
    ["- Každý řádek = 1 kontaktní osoba (firma se může opakovat)."],
    ["- Minimální požadavek: Firma nebo Email (pokud chybí firma, doplní se z domény emailu)."],
    ["- Neúplná data se tolerují (raději importovat než blokovat)."],
    ["- Specializace lze zadat více hodnot (oddělte ; nebo , nebo |)."],
  ];
  const wsNotes = XLSX.utils.aoa_to_sheet(notes);
  XLSX.utils.book_append_sheet(wb, wsNotes, "README");

  return wb;
};
