// import { GoogleGenAI } from "@google/genai"; // Removed direct import
import { invokeAuthedFunction } from "./functionsClient";
import { sanitizeLogText, summarizeErrorForLog } from "@/shared/security/logSanitizer";

type RegistrationLookupContact = { id: string; company: string; ico?: string };
type CompanyRegistrationDetail = {
  region?: string;
  address?: string;
};
type AresEconomicSubjectResponse = {
  sidlo?: {
    nazevKraje?: string;
    textovaAdresa?: string;
  };
  dalsiUdaje?: Array<{
    sidlo?: Array<{
      sidlo?: {
        nazevKraje?: string;
        textovaAdresa?: string;
      };
      primarniZaznam?: boolean;
    }>;
  }>;
};

const LOOKUP_PLACEHOLDERS = new Set([
  "",
  "-",
  "–",
  "—",
  "―",
  "n/a",
  "na",
  "null",
  "none",
  "unknown",
]);

const isEmptyLookupValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  return LOOKUP_PLACEHOLDERS.has(value.trim().toLowerCase());
};

const normalizeIco = (ico?: string): string | undefined => {
  if (!ico) return undefined;
  const digitsOnly = ico.replace(/\D+/g, "");
  if (digitsOnly.length === 0 || digitsOnly.length > 8) return undefined;
  return digitsOnly.padStart(8, "0");
};

const ARES_TIMEOUT_MS = 10_000;

const extractRegionFromAresResponse = (payload: AresEconomicSubjectResponse): string | null => {
  const primaryRegion = payload.sidlo?.nazevKraje?.trim();
  if (primaryRegion && !isEmptyLookupValue(primaryRegion)) {
    return primaryRegion;
  }

  for (const block of payload.dalsiUdaje || []) {
    for (const seat of block.sidlo || []) {
      const region = seat.sidlo?.nazevKraje?.trim();
      if (region && !isEmptyLookupValue(region)) {
        return region;
      }
    }
  }

  return null;
};

const extractAddressFromAresResponse = (payload: AresEconomicSubjectResponse): string | null => {
  const primaryAddress = payload.sidlo?.textovaAdresa?.trim();
  if (primaryAddress && !isEmptyLookupValue(primaryAddress)) {
    return primaryAddress;
  }

  for (const block of payload.dalsiUdaje || []) {
    for (const seat of block.sidlo || []) {
      const address = seat.sidlo?.textovaAdresa?.trim();
      if (address && !isEmptyLookupValue(address)) {
        return address;
      }
    }
  }

  return null;
};

const fetchCompanyRegistrationFromAres = async (ico: string): Promise<CompanyRegistrationDetail | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ARES_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`ARES lookup failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as AresEconomicSubjectResponse;
    const region = extractRegionFromAresResponse(payload);
    const address = extractAddressFromAresResponse(payload);

    if (!region && !address) {
      return null;
    }

    return {
      region: region || undefined,
      address: address || undefined,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getAiSuggestion = async (contextData: string): Promise<string> => {
  try {
    // Call backend proxy
    const result = await invokeAuthedFunction<{ text: string }>('ai-proxy', {
      body: {
        prompt: `You are an intelligent assistant for a Construction Management CRM. 
        Analyze the following subcontractor data and suggest the best contact for a "rush job on internal plastering" (Vnitřní omítky). 
        Explain why briefly in Czech.
        
        Data: ${contextData}`,
      }
    });

    return result.text || "Could not generate suggestion.";
  } catch (error) {
    console.error("AI Proxy Error:", summarizeErrorForLog(error));
    if (error instanceof Error && error.message.includes('Subscription required')) {
      return "Pro tuto funkci je potřeba vyšší tarif (PRO/Enterprise).";
    }
    return "AI service temporarily unavailable.";
  }
};

export const findCompanyRegistrationDetails = async (
  contacts: RegistrationLookupContact[],
): Promise<Record<string, CompanyRegistrationDetail>> => {
  try {
    const lookups = await Promise.all(
      contacts.map(async (contact) => {
        const ico = normalizeIco(contact.ico);
        if (!ico) {
          return null;
        }

        try {
          const details = await fetchCompanyRegistrationFromAres(ico);
          if (!details) {
            return null;
          }
          return [contact.id, details] as const;
        } catch (error) {
          console.error("ARES registration lookup failed", {
            ico,
            company: sanitizeLogText(contact.company, 80),
            error: summarizeErrorForLog(error),
          });
          return null;
        }
      }),
    );

    return lookups.reduce<Record<string, CompanyRegistrationDetail>>((acc, entry) => {
      if (!entry) return acc;
      acc[entry[0]] = entry[1];
      return acc;
    }, {});
  } catch (error) {
    console.error("ARES registration lookup error:", summarizeErrorForLog(error));
    return {};
  }
};

export const findCompanyRegions = async (contacts: RegistrationLookupContact[]): Promise<Record<string, string>> => {
  const details = await findCompanyRegistrationDetails(contacts);
  return Object.entries(details).reduce<Record<string, string>>((acc, [id, detail]) => {
    if (detail.region && !isEmptyLookupValue(detail.region)) {
      acc[id] = detail.region;
    }
    return acc;
  }, {});
};
