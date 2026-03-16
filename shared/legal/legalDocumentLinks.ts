const LEGAL_DOCUMENTS_FALLBACK_ORIGIN = "https://www.tenderflow.cz";

type LegalDocumentPath = "/terms" | "/privacy";

type LocationLike = Pick<Location, "origin" | "protocol">;

export const getLegalDocumentUrl = (
  path: LegalDocumentPath,
  locationLike?: LocationLike,
): string => {
  const currentLocation =
    locationLike ?? (typeof window !== "undefined" ? window.location : undefined);

  if (!currentLocation || currentLocation.protocol === "file:") {
    return `${LEGAL_DOCUMENTS_FALLBACK_ORIGIN}${path}`;
  }

  return new URL(path, currentLocation.origin).toString();
};
