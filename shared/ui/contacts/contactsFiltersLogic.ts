import { Subcontractor } from "@/types";
import type { CzRegionCode } from "@/config/constants";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type RatingFilter = "all" | "unrated" | "3" | "4" | "5";
export type ContactSort = "name" | "rating";

export interface ContactsFilterState {
  ratingFilter?: RatingFilter;
  sortBy?: ContactSort;
  searchText: string;
  specialization: string;
  status: string;
  region: string | "all";
  distanceKm: number | null;
}

export const EMPTY_FILTER_STATE: ContactsFilterState = {
  ratingFilter: "all",
  sortBy: "name",
  searchText: "",
  specialization: "all",
  status: "all",
  region: "all",
  distanceKm: null,
};

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function matchesContactFilters(
  contact: Subcontractor,
  state: ContactsFilterState,
  projectPosition?: GeoPoint | null,
): boolean {
  const search = state.searchText.trim().toLowerCase();
  const matchesSearch =
    !search ||
    contact.company.toLowerCase().includes(search) ||
    contact.contacts.some(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.phone.toLowerCase().includes(search),
    ) ||
    contact.specialization.some((s) => s.toLowerCase().includes(search));

  const matchesSpec =
    state.specialization === "all" ||
    contact.specialization.includes(state.specialization);

  const matchesStatus =
    state.status === "all" || contact.status === state.status;

  const matchesRegion =
    state.region === "all" || contactCoversRegion(contact, state.region as CzRegionCode);

  const matchesDistance =
    state.distanceKm == null ||
    !projectPosition ||
    contactWithinDistance(contact, projectPosition, state.distanceKm);

  const ratingFilter = state.ratingFilter ?? "all";
  const rating = contact.vendorRatingAverage;
  const matchesRating = ratingFilter === "all" || (!contact.vendorRatingUnavailable && (
    ratingFilter === "unrated" ? rating == null : rating != null && rating >= Number(ratingFilter)
  ));

  return matchesRating && matchesSearch && matchesSpec && matchesStatus && matchesRegion && matchesDistance;
}

export function contactCoversRegion(
  contact: Subcontractor,
  regionCode: CzRegionCode,
): boolean {
  const regions = contact.regions;
  if (!Array.isArray(regions) || regions.length === 0) return false;
  return regions.includes(regionCode);
}

export function contactWithinDistance(
  contact: Subcontractor,
  projectPosition: GeoPoint,
  maxKm: number,
): boolean {
  if (contact.latitude == null || contact.longitude == null) return false;
  const km = haversineKm(projectPosition, {
    lat: contact.latitude,
    lng: contact.longitude,
  });
  return km <= maxKm;
}

export function filterContacts(
  contacts: Subcontractor[],
  state: ContactsFilterState,
  projectPosition?: GeoPoint | null,
): Subcontractor[] {
  const filtered = contacts.filter((c) => matchesContactFilters(c, state, projectPosition));
  const byName = (a: Subcontractor, b: Subcontractor) =>
    a.company.localeCompare(b.company, "cs") || a.id.localeCompare(b.id);
  if (state.sortBy !== "rating") return state.sortBy === "name" ? filtered.sort(byName) : filtered;
  return filtered.sort((a, b) => {
    const aRating = a.vendorRatingUnavailable ? -1 : a.vendorRatingAverage ?? -1;
    const bRating = b.vendorRatingUnavailable ? -1 : b.vendorRatingAverage ?? -1;
    return bRating - aRating || (b.vendorRatingCount ?? 0) - (a.vendorRatingCount ?? 0)
      || byName(a, b);
  });
}

export function hasActiveFilters(state: ContactsFilterState): boolean {
  return (
    (state.ratingFilter != null && state.ratingFilter !== "all") ||
    state.searchText.trim() !== "" ||
    state.specialization !== "all" ||
    state.status !== "all" ||
    state.region !== "all" ||
    state.distanceKm !== null
  );
}
