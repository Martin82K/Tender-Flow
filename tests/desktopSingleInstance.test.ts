import { describe, expect, it, vi } from "vitest";
import { configureSingleInstance } from "../desktop/main/services/singleInstance";

describe("desktop single-instance bootstrap", () => {
  it("ukončí druhý proces a neregistruje jeho lifecycle listener", () => {
    const electronApp = {
      requestSingleInstanceLock: vi.fn(() => false),
      quit: vi.fn(),
      on: vi.fn(),
    };

    const hasLock = configureSingleInstance(electronApp, () => null);

    expect(hasLock).toBe(false);
    expect(electronApp.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(electronApp.quit).toHaveBeenCalledTimes(1);
    expect(electronApp.on).not.toHaveBeenCalled();
  });

  it("při druhém spuštění obnoví a aktivuje okno primární instance", () => {
    let secondInstanceListener: (() => void) | undefined;
    const electronApp = {
      requestSingleInstanceLock: vi.fn(() => true),
      quit: vi.fn(),
      on: vi.fn((_event: "second-instance", listener: () => void) => {
        secondInstanceListener = listener;
      }),
    };
    const mainWindow = {
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      focus: vi.fn(),
    };

    const hasLock = configureSingleInstance(electronApp, () => mainWindow);
    secondInstanceListener?.();

    expect(hasLock).toBe(true);
    expect(electronApp.quit).not.toHaveBeenCalled();
    expect(electronApp.on).toHaveBeenCalledWith("second-instance", expect.any(Function));
    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });
});
