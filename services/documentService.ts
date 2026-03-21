import { supabase } from './supabase';
import { DemandDocument } from '../types';
import { isDemoSession } from './demoData';
import { summarizeErrorForLog } from '../shared/security/logSanitizer';

const BUCKET_NAME = 'demand-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 15;

const extractStoragePath = (value: string): string => {
  if (!value.startsWith('http')) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return value;
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return value;
  }
};

/**
 * Upload a document to Supabase Storage
 * @param file - File to upload
 * @param categoryId - ID of the demand category
 * @returns Document metadata
 */
export async function uploadDocument(file: File, categoryId: string): Promise<DemandDocument> {
  // Create unique file path
  const fileExt = file.name.split('.').pop();
  const fileName = `${categoryId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

  if (isDemoSession()) {
    console.log('DocumentService: Mocking upload for demo session');
    return {
      id: crypto.randomUUID(),
      name: file.name,
      url: `https://mock-demo-url.com/${fileName}`, // Just a placeholder
      size: file.size,
      uploadedAt: new Date().toISOString()
    };
  }

  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading document:', summarizeErrorForLog(error));
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  const document: DemandDocument = {
    id: crypto.randomUUID(),
    name: file.name,
    url: fileName,
    size: file.size,
    uploadedAt: new Date().toISOString()
  };

  return document;
}

/**
 * Delete a document from Supabase Storage
 * @param filePath - Path to file in storage (extracted from URL)
 */
export async function deleteDocument(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Error deleting document:', summarizeErrorForLog(error));
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Get temporary signed URL for a document
 * @param filePath - Path to file in storage (or legacy public URL)
 * @returns Signed URL, valid for a limited time
 */
export async function getDocumentUrl(filePath: string): Promise<string> {
  const normalizedPath = extractStoragePath(filePath);
  if (normalizedPath.startsWith('http')) {
    return normalizedPath;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('Error creating signed document URL:', summarizeErrorForLog(error));
    throw new Error(`Failed to create signed document URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Format file size to human readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
