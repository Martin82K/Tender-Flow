import { GoogleGenAI } from "@google/genai";

export const getAiSuggestion = async (contextData: string): Promise<string> => {
  try {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      return "AI API Key not configured.";
    }

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are an intelligent assistant for a Construction Management CRM. 
      Analyze the following subcontractor data and suggest the best contact for a "rush job on internal plastering" (Vnitřní omítky). 
      Explain why briefly in Czech.
      
      Data: ${contextData}`,
    });

    return response.text || "Could not generate suggestion.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI service temporarily unavailable.";
  }
};

export const findCompanyRegions = async (contacts: { id: string; company: string; ico?: string }[]): Promise<Record<string, string>> => {
  try {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      console.error("AI API Key not configured.");
      return {};
    }

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    // Construct a list for the prompt
    const listStr = contacts.map(c => `ID: ${c.id}, Company: ${c.company}, ICO: ${c.ico || 'N/A'}`).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // Using standard flash for general logic + search
      contents: `You are a data enrichment assistant. 
      For the following list of Czech companies, search the internet to find their registered headquarters region (Kraj) in the Czech Republic (e.g. "Hlavní město Praha", "Jihomoravský kraj", etc.).
      
      Use the ICO (Identification Number) if provided to be precise.
      
      Return strictly a JSON object where the key is the ID and the value is the Region name. 
      Example output format: { "c1": "Praha", "c2": "Jihomoravský kraj" }
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
      
      List:
      ${listStr}`,
      config: {
        tools: [{ googleSearch: {} }],
        // Note: responseMimeType cannot be used with googleSearch, so we parse text manually.
      }
    });

    const text = response.text || "{}";

    // Clean up potential markdown code blocks if the model ignores the instruction
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const result = JSON.parse(jsonStr);
      return result;
    } catch (e) {
      console.error("Failed to parse AI response as JSON", text);
      return {};
    }

  } catch (error) {
    console.error("Gemini API Error (Region Search):", error);
    return {};
  }
};