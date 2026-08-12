import type { ContactPerson, Subcontractor } from "@/types";

export type PipelineContactFormState = Partial<Subcontractor> & {
  specializationRaw?: string;
};

export interface RegistrationDetails {
  region?: string;
  address?: string;
  city?: string;
}

type CreateId = () => string;

const BLANK_REGISTRATION_VALUES = new Set(["", "-", "–", "—", "―"]);

const createBlankContact = (createId: CreateId): ContactPerson => ({
  id: createId(),
  name: "",
  phone: "",
  email: "",
  position: "Hlavní kontakt",
});

export const isBlankRegistrationValue = (
  value?: string | null,
): boolean => {
  if (!value) return true;
  return BLANK_REGISTRATION_VALUES.has(value.trim().toLowerCase());
};

export const createPipelineContactFormState = (
  initialData: Subcontractor | undefined,
  initialName: string,
  createId: CreateId,
): PipelineContactFormState => {
  if (initialData) {
    return {
      ...initialData,
      specializationRaw: "",
      contacts:
        initialData.contacts && initialData.contacts.length > 0
          ? initialData.contacts
          : [createBlankContact(createId)],
    };
  }

  return {
    company: initialName,
    specialization: [],
    specializationRaw: "",
    contacts: [createBlankContact(createId)],
    ico: "",
    region: "",
    address: "",
    city: "",
    web: "",
    note: "",
    regions: [],
    status: "available",
  };
};

const mergeRegistrationValue = (
  current: string | undefined,
  incoming: string | undefined,
  overwriteExisting: boolean,
): string | undefined => {
  if (!incoming) return current;
  return overwriteExisting || isBlankRegistrationValue(current)
    ? incoming
    : current;
};

export const mergeRegistrationDetails = (
  current: PipelineContactFormState,
  registration: RegistrationDetails,
  overwriteExisting: boolean,
): PipelineContactFormState => ({
  ...current,
  region: mergeRegistrationValue(
    current.region,
    registration.region,
    overwriteExisting,
  ),
  address: mergeRegistrationValue(
    current.address,
    registration.address,
    overwriteExisting,
  ),
  city: mergeRegistrationValue(
    current.city,
    registration.city,
    overwriteExisting,
  ),
});
