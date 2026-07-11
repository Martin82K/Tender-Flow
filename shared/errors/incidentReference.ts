export interface IncidentReference {
  errorCode: string;
  incidentId?: string | null;
}

const normalizeErrorCode = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 128) || "UNKNOWN";

const normalizeIncidentId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.trim().replace(/[^A-Z0-9-]/gi, "").slice(0, 64) || null;
};

export const formatIncidentReference = ({
  errorCode,
  incidentId,
}: IncidentReference): string => {
  const lines = [`Kód chyby: ${normalizeErrorCode(errorCode)}`];
  const safeIncidentId = normalizeIncidentId(incidentId);
  if (safeIncidentId) lines.push(`Kód incidentu: ${safeIncidentId}`);
  return lines.join("\n");
};
