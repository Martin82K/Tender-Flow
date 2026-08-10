import type { ContactPerson, Subcontractor } from "@/types";

export interface SubcontractorPersistencePayload {
  [key: string]: unknown;
  id?: string;
  organization_id?: string;
  company_name?: string;
  contact_person_name?: string | null;
  email?: string | null;
  phone?: string | null;
  specialization?: string[];
  ico?: string;
  region?: string;
  address?: string;
  city?: string;
  web?: string;
  note?: string;
  regions?: string[];
  status_id?: string;
  contacts?: ContactPerson[];
  latitude?: number;
  longitude?: number;
  geocoded_at?: string;
  ares_checked_at?: string;
  ares_not_found?: boolean;
}

const primaryContactPayload = (
  contacts: readonly ContactPerson[],
): Pick<
  SubcontractorPersistencePayload,
  "contact_person_name" | "email" | "phone"
> => {
  const primaryContact = contacts[0];
  return {
    contact_person_name: primaryContact?.name || null,
    email: primaryContact?.email || null,
    phone: primaryContact?.phone || null,
  };
};

export const withPrimaryContactMirror = (
  contact: Subcontractor,
): Subcontractor => {
  const primaryContact = contact.contacts[0];
  return {
    ...contact,
    name: primaryContact?.name || "-",
    email: primaryContact?.email || "-",
    phone: primaryContact?.phone || "-",
  };
};

export const toSubcontractorPersistencePayload = (
  contact: Subcontractor,
  organizationId?: string,
): SubcontractorPersistencePayload => {
  const payload: SubcontractorPersistencePayload = {
    id: contact.id,
    company_name: contact.company,
    specialization: contact.specialization,
    contacts: contact.contacts,
    ...primaryContactPayload(contact.contacts),
    ico: contact.ico,
    region: contact.region,
    address: contact.address,
    city: contact.city,
    web: contact.web,
    note: contact.note,
    regions: contact.regions,
    status_id: contact.status,
    latitude: contact.latitude,
    longitude: contact.longitude,
    geocoded_at: contact.geocodedAt,
    ares_checked_at: contact.aresCheckedAt,
    ares_not_found: contact.aresNotFound,
  };

  if (organizationId !== undefined) payload.organization_id = organizationId;
  return payload;
};

export const toSubcontractorUpdatePayload = (
  updates: Partial<Subcontractor>,
): SubcontractorPersistencePayload => {
  const payload: SubcontractorPersistencePayload = {};

  if (updates.company !== undefined) payload.company_name = updates.company;
  if (updates.specialization !== undefined) payload.specialization = updates.specialization;
  if (updates.ico !== undefined) payload.ico = updates.ico;
  if (updates.region !== undefined) payload.region = updates.region;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.city !== undefined) payload.city = updates.city;
  if (updates.web !== undefined) payload.web = updates.web;
  if (updates.note !== undefined) payload.note = updates.note;
  if (updates.regions !== undefined) payload.regions = updates.regions;
  if (updates.status !== undefined) payload.status_id = updates.status;
  if (updates.latitude !== undefined) payload.latitude = updates.latitude;
  if (updates.longitude !== undefined) payload.longitude = updates.longitude;
  if (updates.geocodedAt !== undefined) payload.geocoded_at = updates.geocodedAt;
  if (updates.aresCheckedAt !== undefined) payload.ares_checked_at = updates.aresCheckedAt;
  if (updates.aresNotFound !== undefined) payload.ares_not_found = updates.aresNotFound;

  if (updates.contacts !== undefined) {
    payload.contacts = updates.contacts;
    Object.assign(payload, primaryContactPayload(updates.contacts));
  } else {
    if (updates.name !== undefined) payload.contact_person_name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
  }

  return payload;
};
