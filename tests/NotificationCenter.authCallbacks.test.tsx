import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "@features/notifications/ui/NotificationCenter";
import type { AppNotification } from "@features/notifications/types";

const notification: AppNotification = {
  id: "notification-1",
  type: "info",
  title: "Testovací notifikace",
  body: "Obsah notifikace",
  created_at: "2026-07-11T10:00:00.000Z",
  read_at: null,
  category: "system",
  action_url: null,
  entity_type: null,
  entity_id: null,
  dismissed_at: null,
};

describe("NotificationCenter auth-aware callbacks", () => {
  const onMarkRead = vi.fn();
  const onMarkAllRead = vi.fn();
  const onDismiss = vi.fn();
  const onDismissAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onMarkRead.mockResolvedValue(undefined);
    onMarkAllRead.mockResolvedValue(undefined);
    onDismiss.mockResolvedValue(undefined);
    onDismissAll.mockResolvedValue(undefined);
  });

  it("routes every notification mutation through supplied callbacks", async () => {
    render(
      <NotificationCenter
        isOpen
        onClose={vi.fn()}
        notifications={[notification]}
        isLoading={false}
        onMarkRead={onMarkRead}
        onMarkAllRead={onMarkAllRead}
        onDismiss={onDismiss}
        onDismissAll={onDismissAll}
        unreadCount={1}
      />,
    );

    fireEvent.click(screen.getByText("Testovací notifikace"));
    await waitFor(() => {
      expect(onMarkRead).toHaveBeenCalledWith("notification-1");
    });

    fireEvent.click(screen.getByTitle("Skrýt"));
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith("notification-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Označit vše jako přečtené" }));
    await waitFor(() => {
      expect(onMarkAllRead).toHaveBeenCalledOnce();
    });

    fireEvent.click(screen.getByRole("button", { name: "Odstranit vše" }));
    fireEvent.click(screen.getByRole("button", { name: "Opravdu odstranit?" }));
    await waitFor(() => {
      expect(onDismissAll).toHaveBeenCalledOnce();
    });
  });
});
