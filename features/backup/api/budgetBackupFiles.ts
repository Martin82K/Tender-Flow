import { dbAdapter } from '@infra/db/dbAdapter';
import type { BackupManifest } from '../model/backupTypes';

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
interface Source { id: string; storage_path: string; sha256: string; file_present: boolean }
function sources(manifest: BackupManifest): Source[] {
  const result: Source[] = [];
  const seen = new Set<string>();
  for (const envelope of manifest.construction_budgets ?? []) {
    const snapshot = JSON.parse(envelope.payload) as { sources: Source[]; organization_id: string };
    if (snapshot.organization_id !== manifest.organization_id || !Array.isArray(snapshot.sources)) throw new Error('Neplatná záloha rozpočtu.');
    for (const source of snapshot.sources) {
      if (!/^[a-f0-9-]{36}$/.test(source.id) || source.storage_path !== `${manifest.organization_id}/${source.id}/source.xlsx` || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Neplatný zdroj rozpočtu.');
      if (source.file_present && !seen.has(source.id)) { result.push(source); seen.add(source.id); }
    }
  }
  return result;
}
async function digest(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer))].map(b => b.toString(16).padStart(2, '0')).join('');
}
function encode(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) text += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(text);
}
function decode(value: string): Uint8Array {
  if (value.length > MAX_BACKUP_BYTES || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Neplatný soubor v záloze.');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export async function attachBudgetBackupFiles(manifest: BackupManifest): Promise<BackupManifest> {
  if (!manifest.construction_budgets?.length) return manifest;
  const files: Record<string, string> = {};
  let size = new TextEncoder().encode(JSON.stringify(manifest)).length;
  for (const source of sources(manifest)) {
    const { data, error } = await dbAdapter.storage.from('construction-budgets').download(source.storage_path);
    if (error || !data) throw new Error('Zdrojový XLSX se nepodařilo zálohovat. Záloha nebyla dokončena.');
    size += Math.ceil(data.size / 3) * 4;
    if (size > MAX_BACKUP_BYTES) throw new Error('Úplná záloha včetně rozpočtů přesahuje limit 50 MB.');
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (await digest(bytes) !== source.sha256) throw new Error('Kontrolní součet zdrojového XLSX nesouhlasí.');
    files[source.id] = encode(bytes);
  }
  return { ...manifest, construction_budget_files: files };
}
/** Validate every byte before the database restore. The RPC separately authenticates signed metadata. */
export async function validateBudgetBackupFiles(manifest: BackupManifest): Promise<void> {
  if (new TextEncoder().encode(JSON.stringify(manifest)).length > MAX_BACKUP_BYTES) throw new Error('Záloha přesahuje limit 50 MB.');
  for (const source of sources(manifest)) {
    const encoded = manifest.construction_budget_files?.[source.id];
    if (typeof encoded !== 'string' || await digest(decode(encoded)) !== source.sha256) throw new Error('Záloha obsahuje chybějící nebo poškozený XLSX.');
  }
}
/** Never overwrite immutable originals. A failed upload leaves a retryable restore, not success. */
export async function restoreBudgetBackupFiles(manifest: BackupManifest): Promise<void> {
  for (const source of sources(manifest)) {
    const storage = dbAdapter.storage.from('construction-budgets');
    const existing = await storage.download(source.storage_path);
    if (!existing.error && existing.data) {
      if (await digest(new Uint8Array(await existing.data.arrayBuffer())) !== source.sha256) throw new Error('Existující XLSX má jiný kontrolní součet. Obnova byla zastavena.');
      continue;
    }
    const { error } = await storage.upload(source.storage_path, decode(manifest.construction_budget_files![source.id]), { upsert: false, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (error) throw new Error('Data byla obnovena, ale XLSX se nepodařilo nahrát. Opakujte obnovu stejné zálohy.');
  }
}
