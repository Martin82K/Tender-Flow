import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: any[]) => Promise<unknown>>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
  },
}));

describe("fsHandlers", () => {
  beforeEach(() => {
    handlers.clear();
    vi.resetModules();
  });

  it("vrati chybu kdyz shell.openPath vrati text chyby", async () => {
    const { shell } = await import("electron");
    vi.mocked(shell.openPath).mockResolvedValue("The file does not exist");

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
    });

    const handler = handlers.get("fs:openInExplorer");
    expect(handler).toBeTypeOf("function");

    const result = await handler?.({}, "/tmp/chybi");
    expect(result).toEqual({ success: false, error: "The file does not exist" });
  });
});
