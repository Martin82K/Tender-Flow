import { GoogleGenAI } from "@google/genai";

export const getAiSuggestion = async (contextData: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
      return "AI API Key not configured.";
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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