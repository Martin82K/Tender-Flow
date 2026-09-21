import type { InvestorFinancials, ProjectClientCard } from "@/types";

export interface ProjectClientCardDraft {
  companyName: string;
  ico: string;
  street: string;
  zip: string;
  city: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  internalNote: string;
}

export const emptyClientCardDraft = (): ProjectClientCardDraft => ({
  companyName: "",
  ico: "",
  street: "",
  zip: "",
  city: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  internalNote: "",
});

const LIMITS = {
  companyName: 200,
  street: 160,
  city: 80,
  contactName: 120,
  contactEmail: 254,
  contactPhone: 32,
  internalNote: 4000,
} as const;

export const clientCardFieldLimits = LIMITS;

const trim = (value: string): string => value.trim();

const digitsOnly = (value: string): string => value.replace(/\s+/g, "");

/** Czech IČO: 8 digits and the weighted checksum used by the business register. */
export const isValidCzechIco = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (!/^\d{8}$/.test(digits)) return false;
  const weights = [8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;
  return Number(digits[7]) === checkDigit;
};

const isValidEmail = (value: string): boolean =>
  value.length <= LIMITS.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidZip = (value: string): boolean => /^\d{5}$/.test(digitsOnly(value));

const isValidPhone = (value: string): boolean => /^\+?[0-9][0-9 ]{7,22}$/.test(value);

export const isClientCardDraftBlank = (draft: ProjectClientCardDraft): boolean =>
  Object.values(draft).every((value) => trim(value) === "");

export interface ClientCardDraftResult {
  card: ProjectClientCard | null;
  errors: Partial<Record<keyof ProjectClientCardDraft, string>>;
}

const optional = (value: string): string | undefined => {
  const next = trim(value);
  return next ? next : undefined;
};

export const draftFromClientCard = (card: ProjectClientCard | null | undefined): ProjectClientCardDraft => ({
  companyName: card?.companyName ?? "",
  ico: card?.ico ?? "",
  street: card?.street ?? "",
  zip: card?.zip ?? "",
  city: card?.city ?? "",
  contactName: card?.contactName ?? "",
  contactEmail: card?.contactEmail ?? "",
  contactPhone: card?.contactPhone ?? "",
  internalNote: card?.internalNote ?? "",
});

/** Blank draft is not an error. A partial draft requires a company name and valid optional fields. */
export const resolveClientCardDraft = (draft: ProjectClientCardDraft): ClientCardDraftResult => {
  if (isClientCardDraftBlank(draft)) return { card: null, errors: {} };

  const errors: ClientCardDraftResult["errors"] = {};
  const companyName = trim(draft.companyName);
  if (!companyName) {
    errors.companyName = "Doplňte firmu nebo jméno objednatele, nebo ponechte celý blok prázdný.";
  } else if (companyName.length > LIMITS.companyName) {
    errors.companyName = "Firma nebo jméno je příliš dlouhé.";
  }

  const ico = digitsOnly(draft.ico);
  if (trim(draft.ico) && !isValidCzechIco(draft.ico)) {
    errors.ico = "IČO nemá platný formát.";
  }

  const street = trim(draft.street);
  if (street.length > LIMITS.street) errors.street = "Ulice je příliš dlouhá.";
  const city = trim(draft.city);
  if (city.length > LIMITS.city) errors.city = "Město je příliš dlouhé.";
  if (trim(draft.zip) && !isValidZip(draft.zip)) errors.zip = "PSČ zadejte jako pět číslic.";

  const contactName = trim(draft.contactName);
  if (contactName.length > LIMITS.contactName) errors.contactName = "Jméno kontaktu je příliš dlouhé.";

  const contactEmail = trim(draft.contactEmail).toLowerCase();
  if (contactEmail && !isValidEmail(contactEmail)) errors.contactEmail = "E-mail nemá platný formát.";

  const contactPhone = trim(draft.contactPhone).replace(/\s+/g, " ");
  if (contactPhone && !isValidPhone(contactPhone)) errors.contactPhone = "Telefon nemá platný formát.";

  if (draft.internalNote.trim().length > LIMITS.internalNote) {
    errors.internalNote = "Interní poznámka je příliš dlouhá.";
  }

  if (Object.keys(errors).length > 0 || !companyName) return { card: null, errors };

  const zipDigits = digitsOnly(draft.zip);
  return {
    card: {
      companyName,
      ico: ico || undefined,
      street: optional(draft.street),
      zip: zipDigits ? `${zipDigits.slice(0, 3)} ${zipDigits.slice(3)}` : undefined,
      city: optional(draft.city),
      contactName: optional(draft.contactName),
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      internalNote: optional(draft.internalNote),
    },
    errors: {},
  };
};

export const financialsWithConfirmedClientName = (
  current: InvestorFinancials | undefined,
  companyName: string,
): InvestorFinancials => ({
  sodPrice: 0,
  amendments: [],
  ...current,
  customerName: companyName.trim(),
});

export const clientNamesMatch = (cardName: string | undefined, financialName: string | undefined): boolean =>
  (cardName ?? "").trim() === (financialName ?? "").trim();
