const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const b64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const bytesToB64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const importAesKey = async (base64Key: string, usage: "encrypt" | "decrypt") => {
  const keyBytes = b64ToBytes(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error("Encryption key must be 32 bytes base64");
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [usage]);
};

export const encryptTextAesGcm = async (
  plaintext: string,
  base64Key: string,
): Promise<string> => {
  const key = await importAesKey(base64Key, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = textEncoder.encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data),
  );
  return `${bytesToB64(iv)}.${bytesToB64(ciphertext)}`;
};

export const decryptTextAesGcm = async (
  ciphertext: string,
  base64Key: string,
): Promise<string> => {
  const [ivB64, dataB64] = ciphertext.split(".", 2);
  if (!ivB64 || !dataB64) throw new Error("Invalid ciphertext format");

  const key = await importAesKey(base64Key, "decrypt");
  const iv = b64ToBytes(ivB64);
  const data = b64ToBytes(dataB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return textDecoder.decode(plaintext);
};

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const encryptJsonAesGcm = async (
  value: unknown,
  base64Key: string
): Promise<string> => {
  return encryptTextAesGcm(JSON.stringify(value), base64Key);
};

export const tryGetEnv = (key: string): string | null => {
  try {
    const val = Deno.env.get(key);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
};
