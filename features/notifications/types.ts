/** Notification category - groups notifications for filtering */
export type NotificationCategory =
  | "general"
  | "bid"
  | "deadline"
  | "project"
  | "document"
  | "team"
  | "agent"
  | "system";

/** Notification type - determines visual styling */
export type NotificationType = "info" | "success" | "warning" | "error";

/** Notification tier - determines delivery channels */
export type NotificationTier = "critical" | "important" | "informational";

/** A single notification from the database */
export interface AppNotification {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  category: NotificationCategory;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  dismissed_at: string | null;
}

/** User notification preferences */
export interface NotificationPreferences {
  bid_status_changes: boolean;
  tender_closed: boolean;
  deadline_reminders: boolean;
  project_status_changes: boolean;
  document_events: boolean;
  team_events: boolean;
  agent_events: boolean;
  system_updates: boolean;
  desktop_notifications: boolean;
  quiet_hours_start: string | null; // HH:MM format
  quiet_hours_end: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  bid_status_changes: true,
  tender_closed: true,
  deadline_reminders: true,
  project_status_changes: true,
  document_events: true,
  team_events: true,
  agent_events: true,
  system_updates: true,
  desktop_notifications: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

/** Category filter labels (Czech) */
export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory | "all", string> = {
  all: "Vše",
  general: "Obecné",
  bid: "Nabídky",
  deadline: "Termíny",
  project: "Projekty",
  document: "Dokumenty",
  team: "Tým",
  agent: "AI Agent",
  system: "Systém",
};

/** Maps notification category to preference key */
export const CATEGORY_TO_PREFERENCE: Record<NotificationCategory, keyof NotificationPreferences | null> = {
  general: null,
  bid: "bid_status_changes",
  deadline: "deadline_reminders",
  project: "project_status_changes",
  document: "document_events",
  team: "team_events",
  agent: "agent_events",
  system: "system_updates",
};

/** Toast notification for transient display */
export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  action_url?: string;
  duration?: number; // ms, defaults based on type
}

/** Tier config for notification delivery */
export const TIER_CONFIG: Record<NotificationTier, { toast: boolean; bell: boolean; desktop: boolean; defaultDuration: number }> = {
  critical: { toast: true, bell: true, desktop: true, defaultDuration: 8000 },
  important: { toast: true, bell: true, desktop: false, defaultDuration: 5000 },
  informational: { toast: false, bell: true, desktop: false, defaultDuration: 5000 },
};
