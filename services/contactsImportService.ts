import { Subcontractor } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ImportResult {
  success: boolean;
  contacts: Subcontractor[];
  error?: string;
}

/**
 * Fetch file from URL and parse contacts
 */
export const syncContactsFromUrl = async (url: string): Promise<ImportResult> => {
  try {
    // Fetch the file
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
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

    const blob = await response.blob();
    const fileType = detectFileType(url, blob.type);

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
  } catch (error: any) {
    console.error('Error syncing contacts:', error);
    return {
      success: false,
      contacts: [],
      error: error.message || 'Failed to sync contacts from URL'
    };
  }
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
  if (urlLower.includes('.xlsx') || urlLower.includes('.xls')) {
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
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      
      // Check for title line (no delimiters) and remove it if present
      const lines = text.split('\n');
      if (lines.length > 1) {
        const firstLine = lines[0];
        // If first line has no semicolons or commas, but second line does, assume it's a title
        if (!firstLine.includes(';') && !firstLine.includes(',') && (lines[1].includes(';') || lines[1].includes(','))) {
           text = lines.slice(1).join('\n');
        }
      }

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(), // Trim whitespace from headers (e.g. "Typ ")
        complete: (results) => {
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
    };
    reader.onerror = () => {
      resolve({
        success: false,
        contacts: [],
        error: 'Failed to read CSV file'
      });
    };
    reader.readAsText(blob);
  });
};

/**
 * Parse XLSX file
 */
const parseXLSX = async (blob: Blob): Promise<ImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        const contacts = parseContactsData(jsonData);
        resolve({
          success: true,
          contacts
        });
      } catch (error: any) {
        resolve({
          success: false,
          contacts: [],
          error: error.message
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        contacts: [],
        error: 'Failed to read XLSX file'
      });
    };
    reader.readAsBinaryString(blob);
  });
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

      const updatedContact = {
        ...existing,
        company: (existing.company && existing.company !== "-" ? existing.company : imported.company) || existing.company,
        specialization: mergedSpecializations,
        contacts: mergedContactsList,
        ico: (imported.ico && imported.ico !== '-' && imported.ico) ? imported.ico : existing.ico,
        region: (imported.region && imported.region !== '-' && imported.region) ? imported.region : existing.region,
        status: (imported.status && imported.status !== '-' && imported.status !== 'available') ? imported.status : existing.status,
        // Update legacy fields from primary contact
        name: mergedContactsList[0]?.name || existing.name,
        phone: mergedContactsList[0]?.phone || existing.phone,
        email: mergedContactsList[0]?.email || existing.email,
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
