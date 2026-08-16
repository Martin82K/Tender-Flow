import fs from "node:fs";

const READ_CHUNK_BYTES = 64 * 1024;

export const readRegularFileLimited = (absolutePath, relativePath, maxBytes) => {
  let descriptor;
  try {
    const before = fs.lstatSync(absolutePath);
    if (!before.isFile()) throw new TypeError(`${relativePath} musí být regulární soubor.`);
    const flags = fs.constants.O_RDONLY
      | (fs.constants.O_NOFOLLOW ?? 0)
      | (fs.constants.O_NONBLOCK ?? 0);
    descriptor = fs.openSync(absolutePath, flags);
    const opened = fs.fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino
    ) {
      throw new TypeError(`${relativePath} musí být stabilní regulární soubor.`);
    }
    if (opened.size > maxBytes) {
      throw new RangeError(`${relativePath} překračuje limit ${maxBytes} bajtů.`);
    }

    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, maxBytes + 1 - totalBytes));
      const readBytes = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (readBytes === 0) break;
      totalBytes += readBytes;
      if (totalBytes > maxBytes) {
        throw new RangeError(`${relativePath} překračuje limit ${maxBytes} bajtů.`);
      }
      chunks.push(chunk.subarray(0, readBytes));
    }
    return Buffer.concat(chunks, totalBytes);
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) throw error;
    throw new TypeError(`Nelze bezpečně načíst ${relativePath}.`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
};

export const readRegularTextFileLimited = (absolutePath, relativePath, maxBytes) =>
  readRegularFileLimited(absolutePath, relativePath, maxBytes).toString("utf8");
