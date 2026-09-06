import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFileExport } from "@shared/hooks/useFileExport";

describe("useFileExport", () => {
  it("waits for a lazy export and ignores repeated clicks until completion", async () => {
    let resolve!: () => void;
    const action = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const { result } = renderHook(useFileExport);
    let pending!: Promise<void>;
    act(() => { pending = result.current.runExport(action); void result.current.runExport(action); });
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isExporting).toBe(true);
    await act(async () => { resolve(); await pending; });
    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportError).toBeNull();
  });

  it("shows a safe error and allows retry when loading or writing fails", async () => {
    const { result } = renderHook(useFileExport);
    await act(async () => { await result.current.runExport(() => Promise.reject(new Error("sensitive diagnostic"))); });
    expect(result.current.exportError).toBe("Soubor se nepodařilo exportovat. Zkuste to znovu nebo obnovte aplikaci.");
    expect(result.current.isExporting).toBe(false);
    await act(async () => { await result.current.runExport(() => Promise.resolve()); });
    expect(result.current.exportError).toBeNull();
  });
});
