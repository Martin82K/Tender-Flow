import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());
vi.mock("@features/notifications/api/notificationApi", () => ({
  notificationApi: { insert },
}));

import {
  emitBidStatusNotification,
  emitBidContractedNotification,
  emitCategoryStatusNotification,
  emitTenderClosedNotification,
  emitProjectClonedNotification,
  emitProjectArchivedNotification,
  emitDocumentUploadedNotification,
  emitDeadlineNotification,
  emitAgentCompletedNotification,
  emitSystemUpdateNotification,
} from "@features/notifications/api/notificationEmitter";

const change = {
  userId: "author", actorUserId: "author", bidId: "bid-1", companyName: "Firma",
  newStatus: "sod" as const, contracted: true, projectId: "project-1",
  categoryId: "category-1", categoryTitle: "Kategorie", projectName: "Projekt",
  sourceProjectId: "project-1", sourceProjectName: "Projekt", targetProjectId: "project-2",
  documentName: "Dokument",
};

const emitters = [
  ["bid status", emitBidStatusNotification],
  ["contract signed", emitBidContractedNotification],
  ["category status", emitCategoryStatusNotification],
  ["tender closed", emitTenderClosedNotification],
  ["project cloned", emitProjectClonedNotification],
  ["project archived", emitProjectArchivedNotification],
  ["document uploaded", emitDocumentUploadedNotification],
] as const;

describe("notification author exclusion", () => {
  beforeEach(() => { insert.mockReset(); insert.mockResolvedValue("notification-1"); });

  it.each(emitters)("does not persist %s notifications for the author", async (_name, emit) => {
    await expect(emit(change)).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(emitters)("preserves %s delivery attempts to a different recipient", async (_name, emit) => {
    await expect(emit({ ...change, userId: "recipient" })).resolves.toBe("notification-1");
    expect(insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ targetUserId: "recipient" }));
  });

  it("keeps the author when category closure delegates to tender notification", async () => {
    await expect(emitCategoryStatusNotification({ ...change, newStatus: "closed" })).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("preserves reminders, background task results and system updates", async () => {
    await emitDeadlineNotification({ ...change, daysRemaining: 1 });
    await emitAgentCompletedNotification({ userId: "author", taskDescription: "Hotovo" });
    await emitSystemUpdateNotification({ userId: "author", version: "1.0", title: "Aktualizace", body: "Novinky" });
    expect(insert).toHaveBeenCalledTimes(3);
  });
});
