const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const b64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bytesToB64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const encryptJsonAesGcm = async (
  value: unknown,
  base64Key: string
): Promise<string> => {
  const keyBytes = b64ToBytes(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error("DOCHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes base64");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );

  return `${bytesToB64(iv)}.${bytesToB64(ciphertext)}`;
};

export const tryGetEnv = (key: string): string | null => {
  try {
    const val = Deno.env.get(key);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
};

