import type { KrosMapping } from '../model/krosImport';
import { readKrosFile } from '../model/krosImport';
self.onmessage = (event: MessageEvent<{buffer:ArrayBuffer;mapping:KrosMapping}>) => {
  try {
    const document = readKrosFile(new Uint8Array(event.data.buffer), (done, total) => self.postMessage({ type: 'progress', done, total }), event.data.mapping);
    self.postMessage({ type: 'complete', document });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Import selhal.' }); }
};
