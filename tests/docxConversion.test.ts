import path from "path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  execFile: execFileMock,
  default: {
    execFile: execFileMock,
  },
}));

import { convertToDocx, runMacTextutilDocxConversion } from "../desktop/main/ipc/modules/docxConversion";

describe("docxConversion", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("odmitne konverzi mimo macOS", async () => {
    const runConversion = vi.fn();
    const verifyOutput = vi.fn();

    const result = await convertToDocx("/tmp/input.doc", {
      platform: "linux",
      runConversion,
      verifyOutput,
    });

    expect(result).toEqual({
      success: false,
      error: "Conversion is only supported on macOS",
    });
    expect(runConversion).not.toHaveBeenCalled();
    expect(verifyOutput).not.toHaveBeenCalled();
  });

  it("preda vstupni cestu jako jediny argument bez shell evaluace", async () => {
    const runConversion = vi.fn(async () => undefined);
    const verifyOutput = vi.fn(async () => undefined);
    const payloadPath = '/tmp/report";touch /tmp/pwned;".doc';

    const result = await convertToDocx(payloadPath, {
      platform: "darwin",
      tmpDir: "/tmp",
      homeDir: "/Users/tester",
      now: () => 1700000000000,
      runConversion,
      resolveRealPath: vi.fn(async () => payloadPath),
      verifyOutput,
    });

    const expectedOutput = path.join("/tmp", "pwned_1700000000000.docx");
    expect(result).toEqual({
      success: true,
      outputPath: expectedOutput,
    });
    expect(runConversion).toHaveBeenCalledWith(
      payloadPath,
      expectedOutput,
    );
  });

  it("odmitne soubory mimo .doc rozsah", async () => {
    const runConversion = vi.fn(async () => undefined);

    const result = await convertToDocx("/tmp/input.txt", {
      platform: "darwin",
      tmpDir: "/tmp",
      homeDir: "/Users/tester",
      runConversion,
      resolveRealPath: vi.fn(async () => "/tmp/input.txt"),
    });

    expect(result).toEqual({
      success: false,
      error: "Only .doc files are supported for conversion",
    });
    expect(runConversion).not.toHaveBeenCalled();
  });

  it("odmitne vstup mimo povolene rooty", async () => {
    const runConversion = vi.fn(async () => undefined);

    const result = await convertToDocx("/etc/shadow.doc", {
      platform: "darwin",
      tmpDir: "/tmp",
      homeDir: "/Users/tester",
      runConversion,
      resolveRealPath: vi.fn(async () => "/etc/shadow.doc"),
    });

    expect(result).toEqual({
      success: false,
      error: "Input path is outside allowed roots",
    });
    expect(runConversion).not.toHaveBeenCalled();
  });
  it("pouzije textutil pres execFile s argumentovym polem", async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null, stdout?: string, stderr?: string) => void) => {
      cb(null, "", "");
    });

    const payloadPath = '/tmp/input";echo HACK;".doc';
    await runMacTextutilDocxConversion(payloadPath, "/tmp/output.docx");

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      "textutil",
      ["-convert", "docx", payloadPath, "-output", "/tmp/output.docx"],
      expect.any(Function),
    );
  });
});
