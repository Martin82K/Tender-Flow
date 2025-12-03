import { supabase } from './supabase';
import { DemandDocument } from '../types';

const BUCKET_NAME = 'demand-documents';

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

  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading document:', error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  const document: DemandDocument = {
    id: crypto.randomUUID(),
    name: file.name,
    url: urlData.publicUrl,
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
    console.error('Error deleting document:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Get public URL for a document
 * @param filePath - Path to file in storage
 * @returns Public URL
 */
export function getDocumentUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
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
