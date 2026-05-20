import { describe, expect, it } from "vitest";

import { getNotificationPanelPosition } from "@/features/notifications/ui/notificationCenterPosition";

describe("notification center position", () => {
  it("drží panel ve viewportu, i když je zvoneček na mobilu před account menu", () => {
    const position = getNotificationPanelPosition(
      { bottom: 156, right: 270 },
      390,
    );

    expect(position).toEqual({ top: 164, left: 8 });
  });

  it("zarovná panel ke zvonečku na širokém viewportu", () => {
    const position = getNotificationPanelPosition(
      { bottom: 64, right: 1200 },
      1440,
    );

    expect(position).toEqual({ top: 72, left: 784 });
  });

  it("respektuje minimální okraj i na velmi úzkém viewportu", () => {
    const position = getNotificationPanelPosition(
      { bottom: 48, right: 220 },
      320,
    );

    expect(position).toEqual({ top: 56, left: 8 });
  });
});
