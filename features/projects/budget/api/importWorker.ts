import type { KrosMapping } from '../model/krosImport';
import type { BudgetDocument } from '../model/types';
export function importInWorker(file: Blob, signal: AbortSignal, onProgress: (done: number, total: number) => void, mapping:KrosMapping = {}, identityOnly = false): Promise<BudgetDocument> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Import zrušen.', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => { cleanup(); reject(new Error('Importní worker selhal.')); };
    worker.onmessage = (event: MessageEvent<{ type: string; done: number; total: number; document: BudgetDocument; message: string }>) => {
      if (event.data.type === 'progress') onProgress(event.data.done, event.data.total);
      else { cleanup(); if (event.data.type === 'complete') resolve(event.data.document); else reject(new Error(event.data.message)); }
    };
    file.arrayBuffer().then(buffer => { if (!signal.aborted) worker.postMessage({buffer,mapping,identityOnly}, [buffer]); }).catch(error => { cleanup(); reject(error); });
  });
}
