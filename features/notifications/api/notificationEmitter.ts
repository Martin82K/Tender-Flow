import type { BidStatus } from "@/types";
import type { NotificationCategory, NotificationType, NotificationTier } from "../types";
import { CATEGORY_TO_PREFERENCE, TIER_CONFIG } from "../types";
import { notificationApi } from "./notificationApi";

// ============================================================
// Types
// ============================================================

interface EmitNotificationInput {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  tier: NotificationTier;
  title: string;
  body?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
}

// ============================================================
// Core emitter
// ============================================================

/**
 * Central entry point for creating notifications.
 * Inserts into DB via RPC. Returns the notification ID if inserted, null if skipped.
 */
export async function emitNotification(input: EmitNotificationInput): Promise<string | null> {
  try {
    const id = await notificationApi.insert({
      targetUserId: input.userId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return id;
  } catch (error) {
    console.error("[notificationEmitter] Failed to emit notification:", error);
    return null;
  }
}

// ============================================================
// Bid status notifications
// ============================================================

const BID_STATUS_LABELS: Record<BidStatus, string> = {
  contacted: "Oslovena",
  sent: "Poptávka odeslána",
  offer: "Nabídka přijata",
  shortlist: "V užším výběru",
  sod: "Vítěz soutěže",
  rejected: "Odmítnuta",
};

const BID_STATUS_TYPE: Record<BidStatus, NotificationType> = {
  contacted: "info",
  sent: "info",
  offer: "info",
  shortlist: "info",
  sod: "success",
  rejected: "info",
};

const BID_STATUS_TIER: Record<BidStatus, NotificationTier> = {
  contacted: "informational",
  sent: "important",
  offer: "important",
  shortlist: "informational",
  sod: "critical",
  rejected: "critical",
};

export async function emitBidStatusNotification(params: {
  userId: string;
  bidId: string;
  companyName: string;
  newStatus: BidStatus;
  projectId: string;
  projectName?: string;
  categoryId: string;
  categoryTitle?: string;
}): Promise<string | null> {
  const statusLabel = BID_STATUS_LABELS[params.newStatus];
  const title = `${statusLabel}: ${params.companyName}`;
  const body = params.categoryTitle
    ? `Kategorie: ${params.categoryTitle}${params.projectName ? ` | Projekt: ${params.projectName}` : ""}`
    : params.projectName
      ? `Projekt: ${params.projectName}`
      : undefined;

  return emitNotification({
    userId: params.userId,
    type: BID_STATUS_TYPE[params.newStatus],
    category: "bid",
    tier: BID_STATUS_TIER[params.newStatus],
    title,
    body,
    actionUrl: `/app/project?projectId=${params.projectId}&tab=pipeline&categoryId=${params.categoryId}`,
    entityType: "bid",
    entityId: params.bidId,
  });
}

// ============================================================
// Bid contracted notification
// ============================================================

export async function emitBidContractedNotification(params: {
  userId: string;
  bidId: string;
  companyName: string;
  contracted: boolean;
  projectId: string;
  projectName?: string;
  categoryId: string;
  categoryTitle?: string;
}): Promise<string | null> {
  if (!params.contracted) return null;

  const title = `Smlouva podepsána: ${params.companyName}`;
  const body = params.categoryTitle
    ? `Kategorie: ${params.categoryTitle}${params.projectName ? ` | Projekt: ${params.projectName}` : ""}`
    : undefined;

  return emitNotification({
    userId: params.userId,
    type: "success",
    category: "bid",
    tier: "important",
    title,
    body,
    actionUrl: `/app/project?projectId=${params.projectId}&tab=pipeline&categoryId=${params.categoryId}`,
    entityType: "bid_contracted",
    entityId: params.bidId,
  });
}

// ============================================================
// Category status notifications
// ============================================================

const CATEGORY_STATUS_LABELS: Record<string, string> = {
  open: "Otevřena",
  negotiating: "V jednání",
  closed: "Uzavřena",
  sod: "SOD uzavřen",
};

export async function emitCategoryStatusNotification(params: {
  userId: string;
  categoryId: string;
  categoryTitle: string;
  newStatus: string;
  projectId: string;
  projectName?: string;
}): Promise<string | null> {
  const statusLabel = CATEGORY_STATUS_LABELS[params.newStatus] ?? params.newStatus;
  const isClosed = params.newStatus === "closed";
  const isSod = params.newStatus === "sod";

  // Uzavření výběrového řízení nebo SOD → kritická notifikace
  if (isClosed) {
    return emitTenderClosedNotification(params);
  }

  return emitNotification({
    userId: params.userId,
    type: isSod ? "success" : "info",
    category: "project",
    tier: isSod ? "critical" : "important",
    title: `Kategorie ${statusLabel}: ${params.categoryTitle}`,
    body: params.projectName ? `Projekt: ${params.projectName}` : undefined,
    actionUrl: `/app/project?projectId=${params.projectId}&tab=pipeline&categoryId=${params.categoryId}`,
    entityType: "category_status",
    entityId: params.categoryId,
  });
}

// ============================================================
// Uzavření výběrového řízení
// ============================================================

export async function emitTenderClosedNotification(params: {
  userId: string;
  categoryId: string;
  categoryTitle: string;
  projectId: string;
  projectName?: string;
}): Promise<string | null> {
  return emitNotification({
    userId: params.userId,
    type: "success",
    category: "bid",
    tier: "critical",
    title: `Výběrové řízení uzavřeno: ${params.categoryTitle}`,
    body: params.projectName ? `Projekt: ${params.projectName}` : undefined,
    actionUrl: `/app/project?projectId=${params.projectId}&tab=pipeline&categoryId=${params.categoryId}`,
    entityType: "tender_closed",
    entityId: params.categoryId,
  });
}

// ============================================================
// Project notifications
// ============================================================

export async function emitProjectClonedNotification(params: {
  userId: string;
  sourceProjectId: string;
  sourceProjectName: string;
  targetProjectId: string;
}): Promise<string | null> {
  return emitNotification({
    userId: params.userId,
    type: "success",
    category: "project",
    tier: "critical",
    title: `Projekt přesunut do realizace: ${params.sourceProjectName}`,
    actionUrl: `/app/project?projectId=${params.targetProjectId}&tab=overview`,
    entityType: "project_clone",
    entityId: params.targetProjectId,
  });
}

export async function emitProjectArchivedNotification(params: {
  userId: string;
  projectId: string;
  projectName: string;
}): Promise<string | null> {
  return emitNotification({
    userId: params.userId,
    type: "info",
    category: "project",
    tier: "informational",
    title: `Projekt archivován: ${params.projectName}`,
    entityType: "project_archive",
    entityId: params.projectId,
  });
}

// ============================================================
// Deadline notifications
// ============================================================

export async function emitDeadlineNotification(params: {
  userId: string;
  categoryId: string;
  categoryTitle: string;
  projectId: string;
  projectName?: string;
  daysRemaining: number; // negative = overdue
}): Promise<string | null> {
  let title: string;
  let type: NotificationType;
  let tier: NotificationTier;

  if (params.daysRemaining < 0) {
    title = `Termín prošel: ${params.categoryTitle}`;
    type = "warning";
    tier = "critical";
  } else if (params.daysRemaining <= 1) {
    title = `Termín zítra: ${params.categoryTitle}`;
    type = "warning";
    tier = "critical";
  } else {
    title = `Termín za ${params.daysRemaining} dní: ${params.categoryTitle}`;
    type = "info";
    tier = "important";
  }

  return emitNotification({
    userId: params.userId,
    type,
    category: "deadline",
    tier,
    title,
    body: params.projectName ? `Projekt: ${params.projectName}` : undefined,
    actionUrl: `/app/project?projectId=${params.projectId}&tab=pipeline&categoryId=${params.categoryId}`,
    entityType: "deadline",
    entityId: `${params.categoryId}_${params.daysRemaining}`,
  });
}

// ============================================================
// Document notifications
// ============================================================

export async function emitDocumentUploadedNotification(params: {
  userId: string;
  documentName: string;
  categoryId: string;
  categoryTitle: string;
  projectId: string;
  projectName?: string;
}): Promise<string | null> {
  return emitNotification({
    userId: params.userId,
    type: "info",
    category: "document",
    tier: "informational",
    title: `Dokument nahrán: ${params.documentName}`,
    body: `Kategorie: ${params.categoryTitle}${params.projectName ? ` | Projekt: ${params.projectName}` : ""}`,
    actionUrl: `/app/project?projectId=${params.projectId}&tab=pipeline&categoryId=${params.categoryId}`,
    entityType: "document",
    entityId: params.categoryId,
  });
}

// ============================================================
// Agent notifications
// ============================================================

export async function emitAgentCompletedNotification(params: {
  userId: string;
  taskDescription: string;
  projectId?: string;
}): Promise<string | null> {
  return emitNotification({
    userId: params.userId,
    type: "info",
    category: "agent",
    tier: "informational",
    title: `AI agent dokončil úlohu`,
    body: params.taskDescription,
    actionUrl: params.projectId
      ? `/app/project?projectId=${params.projectId}&tab=overview`
      : undefined,
    entityType: "agent_task",
    entityId: undefined,
  });
}

// ============================================================
// System / update notifications
// ============================================================

export async function emitSystemUpdateNotification(params: {
  userId: string;
  version: string;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<string | null> {
  return emitNotification({
    userId: params.userId,
    type: "info",
    category: "system",
    tier: "important",
    title: params.title,
    body: params.body,
    actionUrl: params.actionUrl,
    entityType: "system_update",
    entityId: params.version,
  });
}
