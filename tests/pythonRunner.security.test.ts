import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  access: vi.fn(),
  realpath: vi.fn(),
  stat: vi.fn(),
}));
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("fs/promises", () => ({
  default: fsMock,
  ...fsMock,
}));

vi.mock("child_process", () => ({
  default: {
    spawn: spawnMock,
  },
  spawn: spawnMock,
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      if (name === "userData") return "/Users/tester/Library/Application Support/TenderFlow";
      if (name === "exe") return "/Applications/TenderFlow.app/Contents/MacOS/TenderFlow";
      return "/tmp";
    }),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}));

const createProcess = () => {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  setTimeout(() => proc.emit("close", 0), 0);
  return proc;
};

describe("PythonRunnerService security", () => {
  beforeEach(() => {
    fsMock.access.mockReset();
    fsMock.realpath.mockReset();
    fsMock.stat.mockReset();
    spawnMock.mockReset();
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    fsMock.stat.mockResolvedValue({ isDirectory: () => true });
    fsMock.access.mockResolvedValue(undefined);
    spawnMock.mockImplementation(() => createProcess());
    vi.resetModules();
  });

  it("odmitne python input mimo allowed rooty pred spustenim tool skriptu", async () => {
    const { PythonRunnerService } = await import("../desktop/main/services/pythonRunner");
    const runner = new PythonRunnerService();
    spawnMock.mockClear();

    const result = await runner.runTool({
      tool: "excel-merge",
      inputFile: "/Users/tester/Documents/tender.xlsx",
    });

    expect(result).toEqual({
      success: false,
      error: "Access denied: path is outside allowed roots (/Users/tester/Documents/tender.xlsx)",
    });
    expect(fsMock.access).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("odmitne python output mimo allowed rooty i kdyz input je povoleny", async () => {
    const { PythonRunnerService } = await import("../desktop/main/services/pythonRunner");
    const runner = new PythonRunnerService();
    spawnMock.mockClear();

    const result = await runner.runTool({
      tool: "excel-merge",
      inputFile: "/Users/tester/Library/Application Support/TenderFlow/tender.xlsx",
      outputFile: "/Users/tester/Documents/out.xlsx",
    });

    expect(result).toEqual({
      success: false,
      error: "Access denied: path is outside allowed roots (/Users/tester/Documents/out.xlsx)",
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
