export type Severity = "critical" | "warning" | "info";

export type SignalKind =
  | "deadline_overdue"
  | "deadline_soon"
  | "no_bids_14d"
  | "tender_ending_no_winner";

export interface Signal {
  id: string;
  severity: Severity;
  kind: SignalKind;
  projectId: string;
  projectName: string;
  categoryId?: string;
  title: string;
  description: string;
  dueDate?: string;
  daysUntilDue?: number;
  actionUrl: string;
}

export interface TimelineItem {
  signalId: string;
  kind: SignalKind;
  severity: Severity;
  projectId: string;
  label: string;
}

export interface TimelineDay {
  date: string;
  items: TimelineItem[];
}
