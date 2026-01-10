// import { GoogleGenAI } from "@google/genai"; // Removed direct import
import { invokeAuthedFunction } from "./functionsClient";

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
    console.error("AI Proxy Error:", error);
    if (error instanceof Error && error.message.includes('Subscription required')) {
      return "Pro tuto funkci je potřeba vyšší tarif (PRO/Enterprise).";
    }
    return "AI service temporarily unavailable.";
  }
};

export const findCompanyRegions = async (contacts: { id: string; company: string; ico?: string }[]): Promise<Record<string, string>> => {
  try {
    // Construct a list for the prompt
    const listStr = contacts.map(c => `ID: ${c.id}, Company: ${c.company}, ICO: ${c.ico || 'N/A'}`).join('\n');

    const prompt = `You are a data enrichment assistant. 
      For the following list of Czech companies, search the internet to find their registered headquarters region (Kraj) in the Czech Republic (e.g. "Hlavní město Praha", "Jihomoravský kraj", etc.).
      
      Use the ICO (Identification Number) if provided to be precise.
      
      Return strictly a JSON object where the key is the ID and the value is the Region name. 
      Example output format: { "c1": "Praha", "c2": "Jihomoravský kraj" }
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
      
      List:
      ${listStr}`;

    // Call backend proxy
    const result = await invokeAuthedFunction<{ text: string }>('ai-proxy', {
      body: { prompt }
    });

    const text = result.text || "{}";

    // Clean up potential markdown code blocks if the model ignores the instruction
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (e) {
      console.error("Failed to parse AI response as JSON", text);
      return {};
    }

  } catch (error) {
    console.error("AI Proxy Error (Region Search):", error);
    return {};
  }
};