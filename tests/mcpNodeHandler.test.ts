import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { nodeRequestToWebRequest } from "../server/mcp/nodeHandler.js";

describe("MCP Node request adapter", () => {
  it("použije již naparsované serverless body a nečeká na vyčerpaný Node stream", async () => {
    const parsedBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "ChatGPT", version: "1.0.0" },
      },
    };
    const req = Object.assign(new PassThrough(), {
      method: "POST",
      url: "/api/mcp",
      headers: {
        host: "www.tenderflow.cz",
        "content-type": "application/json",
      },
      body: parsedBody,
      socket: { encrypted: true },
    });

    const webRequest = nodeRequestToWebRequest(req);
    const result = await Promise.race([
      webRequest.json(),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);
    req.destroy();

    expect(result).toEqual(parsedBody);
  });

  it("zachová streamované body pro lokální Node server bez body parseru", async () => {
    const req = Object.assign(new PassThrough(), {
      method: "POST",
      url: "/api/mcp",
      headers: {
        host: "localhost:3000",
        "content-type": "application/json",
      },
      socket: { encrypted: false },
    });
    req.end(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }));

    const webRequest = nodeRequestToWebRequest(req);

    await expect(webRequest.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
  });
});
