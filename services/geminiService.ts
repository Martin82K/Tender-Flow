// import { GoogleGenAI } from "@google/genai"; // Removed direct import
import { invokeAuthedFunction } from "./functionsClient";
import { sanitizeLogText, summarizeErrorForLog } from "@/shared/security/logSanitizer";

type RegistrationLookupContact = { id: string; company: string; ico?: string };
type CompanyRegistrationDetail = {
  region?: string;
  address?: string;
  city?: string;
};
type WebsiteLookupContact = { id: string; company: string; ico?: string };
type AresEconomicSubjectResponse = {
  sidlo?: {
    nazevKraje?: string;
    nazevObce?: string;
    textovaAdresa?: string;
  };
  dalsiUdaje?: Array<{
    sidlo?: Array<{
      sidlo?: {
        nazevKraje?: string;
        nazevObce?: string;
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

const extractCityFromAresResponse = (payload: AresEconomicSubjectResponse): string | null => {
  const primaryCity = payload.sidlo?.nazevObce?.trim();
  if (primaryCity && !isEmptyLookupValue(primaryCity)) {
    return primaryCity;
  }

  for (const block of payload.dalsiUdaje || []) {
    for (const seat of block.sidlo || []) {
      const city = seat.sidlo?.nazevObce?.trim();
      if (city && !isEmptyLookupValue(city)) {
        return city;
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
    const city = extractCityFromAresResponse(payload);
    const address = extractAddressFromAresResponse(payload);

    if (!region && !address && !city) {
      return null;
    }

    return {
      region: region || undefined,
      city: city || undefined,
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

const WEBSITE_LOOKUP_BATCH_SIZE = 10;

export const findCompanyWebsites = async (
  contacts: WebsiteLookupContact[],
): Promise<Record<string, string>> => {
  if (contacts.length === 0) return {};

  const results: Record<string, string> = {};

  for (let i = 0; i < contacts.length; i += WEBSITE_LOOKUP_BATCH_SIZE) {
    const batch = contacts.slice(i, i + WEBSITE_LOOKUP_BATCH_SIZE);

    const companiesList = batch
      .map((c, idx) => {
        const ico = normalizeIco(c.ico);
        return `${idx + 1}. "${sanitizeLogText(c.company, 100)}"${ico ? ` (IČO: ${ico})` : ""}`;
      })
      .join("\n");

    try {
      const result = await invokeAuthedFunction<{ text: string }>("ai-proxy", {
        body: {
          prompt: `Jsi asistent, který dohledává oficiální webové stránky českých stavebních firem.

Pro každou firmu v seznamu najdi její oficiální webovou stránku (hlavní doménu).
Odpověz POUZE ve formátu JSON pole, kde každý prvek je objekt s klíči "index" (pořadové číslo) a "web" (URL nebo null pokud nenalezeno).
Žádný další text, pouze validní JSON.

Příklad odpovědi: [{"index":1,"web":"https://www.firma.cz"},{"index":2,"web":null}]

Seznam firem:
${companiesList}`,
        },
      });

      const text = (result.text || "").trim();
      // Extract JSON from response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; web: string | null }>;
        for (const entry of parsed) {
          const contact = batch[entry.index - 1];
          if (contact && entry.web && typeof entry.web === "string") {
            const url = entry.web.trim();
            if (url.startsWith("http://") || url.startsWith("https://")) {
              results[contact.id] = url;
            }
          }
        }
      }
    } catch (error) {
      console.error("AI website lookup failed for batch:", summarizeErrorForLog(error));
    }
  }

  return results;
};
