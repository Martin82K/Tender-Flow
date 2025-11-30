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
      const text = e.target?.result as string;
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
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
  return data.map((row: any, index: number) => ({
    id: `import_${Date.now()}_${index}`,
    company: row['Firma'] || row['firma'] || row['Company'] || '-',
    name: row['Jméno'] || row['jmeno'] || row['Name'] || '-',
    specialization: row['Specializace'] || row['specializace'] || row['Specialization'] || row['Typ'] || 'Ostatní',
    phone: row['Telefon'] || row['telefon'] || row['Phone'] || '-',
    email: row['Email'] || row['email'] || '-',
    ico: row['IČO'] || row['ICO'] || row['ico'] || '-',
    region: row['Region'] || row['region'] || '-',
    status: 'available'
  })).filter(contact => contact.company !== '-'); // Filter out invalid rows
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
 * Matches by Company Name (case-insensitive)
 */
export const mergeContacts = (existingContacts: Subcontractor[], importedContacts: Subcontractor[]): MergeResult => {
  const merged = [...existingContacts];
  const added: Subcontractor[] = [];
  const updated: Subcontractor[] = [];

  importedContacts.forEach(imported => {
    const normalizedImportName = imported.company.trim().toLowerCase();
    const existingIndex = merged.findIndex(
      c => c.company.trim().toLowerCase() === normalizedImportName
    );

    if (existingIndex >= 0) {
      // Update existing contact
      const existing = merged[existingIndex];
      const updatedContact = {
        ...existing,
        // Update fields if they are present in import and not placeholder
        name: imported.name !== '-' ? imported.name : existing.name,
        specialization: imported.specialization !== 'Ostatní' ? imported.specialization : existing.specialization,
        phone: imported.phone !== '-' ? imported.phone : existing.phone,
        email: imported.email !== '-' ? imported.email : existing.email,
        ico: imported.ico !== '-' ? imported.ico : existing.ico,
        region: imported.region !== '-' ? imported.region : existing.region,
        // Preserve ID and Status
      };

      // Check if anything actually changed to avoid unnecessary updates
      if (JSON.stringify(existing) !== JSON.stringify(updatedContact)) {
        merged[existingIndex] = updatedContact;
        updated.push(updatedContact);
      }
    } else {
      // Add new contact
      // Ensure ID is unique if not provided (though parse generates one)
      const newContact = { ...imported };
      merged.push(newContact);
      added.push(newContact);
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
