import { Subcontractor } from '../types';
import Papa from 'papaparse';

export const CONTACTS_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CONTACTS_IMPORT_MAX_ROWS = 5000;
export const CONTACTS_IMPORT_FETCH_TIMEOUT_MS = 15000;

export interface ImportResult {
  success: boolean;
  contacts: Subcontractor[];
  error?: string;
}

class ContactsImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactsImportError';
  }
}

/**
 * Fetch file from URL and parse contacts
 */
export const syncContactsFromUrl = async (url: string): Promise<ImportResult> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const importUrl = validateImportUrl(url);
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), CONTACTS_IMPORT_FETCH_TIMEOUT_MS);

    // Fetch the file
    const response = await fetch(importUrl.toString(), {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        'Accept': 'text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        contacts: [],
        error: `Failed to fetch file: ${response.statusText}`
      };
    }

    validateContentLength(response.headers);
    const blob = await response.blob();
    validateBlobSize(blob);
    const fileType = detectFileType(importUrl.toString(), blob.type);

    if (fileType === 'csv') {
      return await parseCSV(blob);
    } else if (fileType === 'xlsx') {
      return await parseXLSX(blob);
    } else {
      return {
        success: false,
        contacts: [],
        error: 'Unsupported file type. Please use CSV or XLSX.'
      };
    }
  } catch (error: unknown) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const message = getImportErrorMessage(error);
    if (!(error instanceof ContactsImportError) && !isAbortError(error)) {
      console.error('Error syncing contacts:', error);
    }
    return {
      success: false,
      contacts: [],
      error: message
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getImportErrorMessage = (error: unknown): string => {
  if (isAbortError(error)) {
    return `Import timed out after ${CONTACTS_IMPORT_FETCH_TIMEOUT_MS / 1000} seconds.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to sync contacts from URL';
};

const isAbortError = (error: unknown): boolean => {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError'
  );
};

const validateImportUrl = (url: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ContactsImportError('Invalid URL. Please enter a valid HTTPS URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new ContactsImportError('Only HTTPS URLs are allowed for contact imports.');
  }

  if (parsed.username || parsed.password) {
    throw new ContactsImportError('URLs with embedded credentials are not allowed.');
  }

  return parsed;
};

const validateContentLength = (headers: Headers): void => {
  const contentLength = headers.get('content-length');
  if (!contentLength) return;

  const size = Number(contentLength);
  if (!Number.isFinite(size) || size < 0) {
    throw new ContactsImportError('Invalid Content-Length header.');
  }

  if (size > CONTACTS_IMPORT_MAX_FILE_BYTES) {
    throw new ContactsImportError(
      `Import file is too large. Maximum size is ${formatBytes(CONTACTS_IMPORT_MAX_FILE_BYTES)}.`
    );
  }
};

const validateBlobSize = (blob: Blob): void => {
  if (blob.size > CONTACTS_IMPORT_MAX_FILE_BYTES) {
    throw new ContactsImportError(
      `Import file is too large. Maximum size is ${formatBytes(CONTACTS_IMPORT_MAX_FILE_BYTES)}.`
    );
  }
};

const formatBytes = (value: number): string => {
  return `${Math.floor(value / (1024 * 1024))} MB`;
};

const validateRowCount = (rowCount: number): void => {
  if (rowCount > CONTACTS_IMPORT_MAX_ROWS) {
    throw new ContactsImportError(
      `Import contains too many rows. Maximum is ${CONTACTS_IMPORT_MAX_ROWS} rows.`
    );
  }
};

const readBlobText = async (blob: Blob): Promise<string> => {
  if (typeof blob.text === 'function') {
    return await blob.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new ContactsImportError('Failed to read CSV file'));
    reader.readAsText(blob);
  });
};

const readBlobArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') {
    return await blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new ContactsImportError('Failed to read XLSX file'));
    };
    reader.onerror = () => reject(new ContactsImportError('Failed to read XLSX file'));
    reader.readAsArrayBuffer(blob);
  });
};

/**
 * Detect file type from URL or content type
 */
const detectFileType = (url: string, contentType: string): 'csv' | 'xlsx' | 'unknown' => {
  // Check URL extension
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.csv') || urlLower.includes('format=csv')) {
    return 'csv';
  }
  if (urlLower.includes('.xlsx')) {
    return 'xlsx';
  }

  // Check content type
  if (contentType.includes('csv') || contentType.includes('text/')) {
    return 'csv';
  }
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
    return 'xlsx';
  }

  // Default to CSV for Google Sheets export links
  if (url.includes('docs.google.com/spreadsheets')) {
    return 'csv';
  }

  return 'unknown';
};

/**
 * Parse CSV file
 */
const parseCSV = async (blob: Blob): Promise<ImportResult> => {
  try {
    validateBlobSize(blob);
    let text = await readBlobText(blob);

    // Check for title line (no delimiters) and remove it if present
    const lines = text.split('\n');
    if (lines.length > 1) {
      const firstLine = lines[0];
      // If first line has no semicolons or commas, but second line does, assume it's a title
      if (!firstLine.includes(';') && !firstLine.includes(',') && (lines[1].includes(';') || lines[1].includes(','))) {
        text = lines.slice(1).join('\n');
      }
    }

    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        preview: CONTACTS_IMPORT_MAX_ROWS + 1,
        transformHeader: (h) => h.trim(), // Trim whitespace from headers (e.g. "Typ ")
        complete: (results) => {
          validateRowCount(results.data.length);
          const contacts = parseContactsData(results.data);
          resolve({
            success: true,
            contacts
          });
        },
        error: (error) => {
          resolve({
            success: false,
            contacts: [],
            error: error.message
          });
        }
      });
    });
  } catch (error: unknown) {
    return {
      success: false,
      contacts: [],
      error: getImportErrorMessage(error)
    };
  }
};

/**
 * Parse XLSX file
 */
const parseXLSX = async (blob: Blob): Promise<ImportResult> => {
  try {
    validateBlobSize(blob);
    const data = await readBlobArrayBuffer(blob);
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(data, {
      type: 'array',
      sheetRows: CONTACTS_IMPORT_MAX_ROWS + 2,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new ContactsImportError('XLSX file does not contain any sheets.');
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      blankrows: false,
      defval: '',
      raw: false
    });
    validateRowCount(jsonData.length);
    const contacts = parseContactsData(jsonData);
    return {
      success: true,
      contacts
    };
  } catch (error: unknown) {
    return {
      success: false,
      contacts: [],
      error: getImportErrorMessage(error)
    };
  }
};

/**
 * Parse contacts data from parsed CSV/XLSX
 * Expected columns: Firma, Jméno, Specializace, Telefon, Email, IČO, Region
 */
const parseContactsData = (data: any[]): Subcontractor[] => {
  return data.map((row: any, index: number) => {
    const spec = row['Specializace'] || row['specializace'] || row['Specialization'] || row['Typ'] || 'Ostatní';
    const name = row['Jméno'] || row['jmeno'] || row['Name'] || row['Kontakt'] || '-';
    const email = row['Email'] || row['email'] || '-';
    const phone = row['Telefon'] || row['telefon'] || row['Phone'] || '-';

    return {
      id: `import_${Date.now()}_${index}`,
      company: row['Firma'] || row['firma'] || row['Company'] || row['Dodavatel'] || '-',
      specialization: [spec],
      contacts: [{
        id: crypto.randomUUID(),
        name,
        email,
        phone,
        position: 'Importovaný kontakt'
      }],
      ico: row['IČO'] || row['ICO'] || row['ico'] || row['IČO (bez mezer)'] || '-',
      region: row['Region'] || row['region'] || '-',
      status: 'available',
      // Legacy fields for backward compatibility
      name,
      email,
      phone
    };
  }).filter(contact => contact.company !== '-' && contact.company !== undefined); // Filter out invalid rows
};

export interface MergeResult {
  mergedContacts: Subcontractor[];
  added: Subcontractor[];
  updated: Subcontractor[];
  addedCount: number;
  updatedCount: number;
}

/**
 * Merge imported contacts with existing contacts
 * Matches by Company Name (case-insensitive) or by contact email.
 */
export const mergeContacts = (existingContacts: Subcontractor[], importedContacts: Subcontractor[]): MergeResult => {
  const merged = [...existingContacts];
  const added: Subcontractor[] = [];
  const updated: Subcontractor[] = [];

  const normalizeText = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const companyKey = (c: Subcontractor) => normalizeText(c.company || "");
  const getEmails = (c: Subcontractor) => {
    const emails: string[] = [];
    for (const p of c.contacts || []) {
      const e = normalizeEmail(p.email || "");
      if (e && e !== "-") emails.push(e);
    }
    const legacy = normalizeEmail(c.email || "");
    if (legacy && legacy !== "-") emails.push(legacy);
    return Array.from(new Set(emails));
  };

  const contactKey = (p: { name?: string; email?: string; phone?: string }) => {
    const e = normalizeEmail(p.email || "");
    if (e && e !== "-") return `email:${e}`;
    const phone = (p.phone || "").trim();
    if (phone && phone !== "-") return `phone:${phone}`;
    return `name:${normalizeText(p.name || "")}`;
  };

  const hasValue = (value?: string) => {
    if (!value) return false;
    const t = value.trim();
    return t !== "" && t !== "-";
  };

  const companyIndex = new Map<string, number>();
  const emailIndex = new Map<string, number>();

  const indexMerged = () => {
    companyIndex.clear();
    emailIndex.clear();
    merged.forEach((c, idx) => {
      const ck = companyKey(c);
      if (ck && !companyIndex.has(ck)) companyIndex.set(ck, idx);
      for (const e of getEmails(c)) {
        if (!emailIndex.has(e)) emailIndex.set(e, idx);
      }
    });
  };

  indexMerged();

  importedContacts.forEach(imported => {
    const importCompanyKey = companyKey(imported);
    const importEmails = getEmails(imported);

    let existingIndex = -1;
    if (importCompanyKey && companyIndex.has(importCompanyKey)) {
      existingIndex = companyIndex.get(importCompanyKey)!;
    } else {
      const matchedEmail = importEmails.find((e) => emailIndex.has(e));
      if (matchedEmail) {
        existingIndex = emailIndex.get(matchedEmail)!;
      }
    }

    if (existingIndex >= 0) {
      // Update existing contact
      const existing = merged[existingIndex];
      
      // Merge specializations
      const mergedSpecializations = Array.from(new Set([...existing.specialization, ...imported.specialization]));

      // Merge contacts
      const existingContacts = existing.contacts || [];
      const importedContactsList = imported.contacts || [];
      
      const mergedContactsList = [...existingContacts];
      const existingKeys = new Set(existingContacts.map(contactKey));
      importedContactsList.forEach(imp => {
        const key = contactKey(imp);
        if (!existingKeys.has(key)) {
          mergedContactsList.push(imp);
          existingKeys.add(key);
        }
      });

      const pickPrimary = () => {
        const list = mergedContactsList;
        const firstNonEmpty = list.find(
          (p) =>
            (p.email && p.email !== "-") ||
            (p.phone && p.phone !== "-") ||
            (p.name && p.name !== "-")
        );
        return firstNonEmpty || list[0];
      };

      const primary = pickPrimary();

      const updatedContact = {
        ...existing,
        company: (existing.company && existing.company !== "-" ? existing.company : imported.company) || existing.company,
        specialization: mergedSpecializations,
        contacts: mergedContactsList,
        // Fill missing only (do not overwrite existing values)
        ico: hasValue(existing.ico) ? existing.ico : (hasValue(imported.ico) ? imported.ico : existing.ico),
        region: hasValue(existing.region) ? existing.region : (hasValue(imported.region) ? imported.region : existing.region),
        status: existing.status || imported.status,
        // Update legacy fields from primary contact
        name: (existing.name && existing.name !== "-") ? existing.name : (primary?.name || existing.name),
        phone: (existing.phone && existing.phone !== "-") ? existing.phone : (primary?.phone || existing.phone),
        email: (existing.email && existing.email !== "-") ? existing.email : (primary?.email || existing.email),
        // Preserve ID and Status
      };

      // Check if anything actually changed to avoid unnecessary updates
      if (JSON.stringify(existing) !== JSON.stringify(updatedContact)) {
        merged[existingIndex] = updatedContact;
        updated.push(updatedContact);
        indexMerged(); // keep indexes in sync when we mutate
      }
    } else {
      // Add new contact
      // Ensure ID is unique if not provided (though parse generates one)
      const newContact = { ...imported };
      merged.push(newContact);
      added.push(newContact);
      indexMerged();
    }
  });

  return {
    mergedContacts: merged,
    added,
    updated,
    addedCount: added.length,
    updatedCount: updated.length
  };
};
