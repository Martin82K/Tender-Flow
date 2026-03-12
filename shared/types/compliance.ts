export type ComplianceStatus = "implemented" | "partial" | "missing";

export interface ComplianceChecklistItem {
  id: string;
  area: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  priority: "P0" | "P1" | "P2";
}

export interface RetentionPolicy {
  id: string;
  category: string;
  purpose: string;
  retentionDays: number;
  status: ComplianceStatus;
}

export interface DataSubjectRequest {
  id: string;
  requestType: "access" | "export" | "rectification" | "erasure";
  subjectLabel: string;
  status: "new" | "in_progress" | "completed";
  dueAt: string;
}

export interface BreachCase {
  id: string;
  title: string;
  status: "triage" | "assessment" | "reported" | "closed";
  riskLevel: "low" | "medium" | "high";
  linkedIncidentId: string | null;
}

export interface SubprocessorRecord {
  id: string;
  name: string;
  region: string;
  purpose: string;
  transferMechanism: string;
}
