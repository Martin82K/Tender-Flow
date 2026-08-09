import { createHash } from 'node:crypto';

export const deriveMcpBackendProof = (secretKey) =>
  createHash('sha256').update(String(secretKey || ''), 'utf8').digest('hex');
