import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";

const notificationCenterRenders = vi.hoisted(() => [] as Array<{
  isOpen: boolean;
  anchor: { top: number; right: number } | null | undefined;
}>);

vi.mock("@features/notifications/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    isLoading: false,
    unreadCount: 0,
    refresh: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

vi.mock("@features/notifications/ui/NotificationCenter", () => ({
  NotificationCenter: (props: {
    isOpen: boolean;
    anchor?: { top: number; right: number } | null;
  }) => {
    notificationCenterRenders.push({ isOpen: props.isOpen, anchor: props.anchor });
    return props.isOpen ? <div data-testid="notification-center" /> : null;
  },
}));

describe("NotificationBell positioning", () => {
  beforeEach(() => {
    notificationCenterRenders.length = 0;
  });

  it("opens with a measured anchor on the very first visible render", () => {
    render(<NotificationBell />);
    const button = screen.getByRole("button", { name: "Notifikace" });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      x: 880,
      y: 16,
      top: 16,
      right: 920,
      bottom: 56,
      left: 880,
      width: 40,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.click(button);

    expect(screen.getByTestId("notification-center")).toBeInTheDocument();
    const firstOpenRender = notificationCenterRenders.find((rendered) => rendered.isOpen);
    expect(firstOpenRender?.anchor).toEqual({ top: 64, right: window.innerWidth - 920 });
  });
});
