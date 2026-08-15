import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { checkPortAvailable } from "../scripts/assert-port-available.mjs";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("desktop dev port preflight", () => {
  it("spouští preflight a Vite v strict-port režimu", async () => {
    const packageJson = JSON.parse(
      await readFile("package.json", "utf8"),
    ) as { scripts?: Record<string, string> };
    const desktopDevScript = packageJson.scripts?.["desktop:dev"] ?? "";

    expect(desktopDevScript).toContain(
      "node scripts/assert-port-available.mjs 127.0.0.1 3000",
    );
    expect(desktopDevScript).toContain("--port 3000 --strictPort");
  });

  it("odmítne port, na kterém už poslouchá jiný Vite proces", async () => {
    const server = createServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");

    await expect(checkPortAvailable("127.0.0.1", address.port)).resolves.toBe(false);
  });
});
