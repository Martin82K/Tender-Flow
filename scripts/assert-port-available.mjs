import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const checkPortAvailable = (host, port) =>
  new Promise((resolveAvailability, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => {
      if (error?.code === "EADDRINUSE" || error?.code === "EACCES") {
        resolveAvailability(false);
        return;
      }
      reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolveAvailability(true));
    });
  });

const run = async () => {
  const host = process.argv[2] || "127.0.0.1";
  const port = Number(process.argv[3] || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Neplatný port pro desktop dev: ${process.argv[3] || "3000"}`);
  }

  const available = await checkPortAvailable(host, port);
  if (available) return;

  console.error(
    `[Desktop Dev] Port ${host}:${port} už používá jiný proces. Ukončete starý Vite/Electron běh a spusťte příkaz znovu.`,
  );
  process.exitCode = 1;
};

const isDirectExecution =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  run().catch((error) => {
    console.error(`[Desktop Dev] Kontrola portu selhala: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
