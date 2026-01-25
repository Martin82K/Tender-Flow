import { invokeAuthedFunction } from './functionsClient';
import { supabase } from './supabase';
import { Contract, ContractExtractionResult } from '../types';


interface AIProxyResponse {
  text: string;
  raw?: unknown;
}

const CONTRACT_EXTRACTION_PROMPT = `Analyzuj následující text smlouvy o dílo a extrahuj strukturovaná data.

VÝSTUP MUSÍ BÝT VALIDNÍ JSON v tomto formátu:
{
  "fields": {
    "title": "Název smlouvy",
    "contractNumber": "Číslo smlouvy",
    "vendorName": "Název dodavatele/zhotovitele",
    "signedAt": "YYYY-MM-DD",
    "effectiveFrom": "YYYY-MM-DD",
    "effectiveTo": "YYYY-MM-DD",
    "basePrice": 123456.00,
    "currency": "CZK",
    "retentionPercent": 5.0,
    "warrantyMonths": 60,
    "paymentTerms": "30 dní od doručení faktury",
    "scopeSummary": "Stručný popis předmětu díla (max 200 slov)"
  },
  "confidence": {
    "title": 0.95,
    "contractNumber": 0.90,
    "vendorName": 0.95,
    "signedAt": 0.80,
    "effectiveFrom": 0.85,
    "effectiveTo": 0.70,
    "basePrice": 0.85,
    "currency": 0.99,
    "retentionPercent": 0.75,
    "warrantyMonths": 0.80,
    "paymentTerms": 0.70,
    "scopeSummary": 0.90
  }
}

PRAVIDLA:
1. Confidence je číslo 0.0-1.0 vyjadřující jistotu extrakce daného pole.
2. Pokud pole nelze nalézt v textu, VYNECH ho z "fields" (neuváděj null ani prázdný string).
3. Pro pole, která nelze nalézt, nastav confidence na 0.0.
4. basePrice musí být číslo bez měny (pouze numerická hodnota).
5. Datumy vždy v formátu YYYY-MM-DD.
6. Hledej tyto alternativní názvy:
   - vendorName: "zhotovitel", "dodavatel", "poskytovatel"
   - basePrice: "cena díla", "celková cena", "smluvní cena", "cena za dílo", "činí"
   - Hledej částku v blízkosti slova "činí" nebo "celková cena".
   - Částka může být formátována s tečkami jako oddělovači tisíců (např. 4.530.832,00) nebo mezerami.
   - Ignoruj DPH, pokud je uvedeno "bez DPH".
7. Pokud je cena uvedena i slovně, použij ji pro kontrolu řádu, ale extrahuj číslo.

TEXT SMLOUVY:
`;

const AMENDMENT_EXTRACTION_PROMPT = `Analyzuj následující text dodatku ke smlouvě o dílo a extrahuj strukturovaná data.

VÝSTUP MUSÍ BÝT VALIDNÍ JSON:
{
  "fields": {
    "amendmentNo": 1,
    "signedAt": "YYYY-MM-DD",
    "effectiveFrom": "YYYY-MM-DD",
    "deltaPrice": 50000.00,
    "deltaDeadline": "YYYY-MM-DD",
    "reason": "Důvod dodatku"
  },
  "confidence": {
    "amendmentNo": 0.95,
    "signedAt": 0.90,
    "effectiveFrom": 0.85,
    "deltaPrice": 0.80,
    "deltaDeadline": 0.75,
    "reason": 0.85
  }
}

PRAVIDLA:
1. deltaPrice může být kladné (navýšení) i záporné (snížení).
2. amendmentNo je číslo dodatku (1, 2, 3...).
3. Pokud pole nelze nalézt, vynech ho z "fields".

TEXT DODATKU:
`;

const DRAWDOWN_EXTRACTION_PROMPT = `Analyzuj následující text průvodky/měsíčního zjištění prací a extrahuj strukturovaná data.

VÝSTUP MUSÍ BÝT VALIDNÍ JSON:
{
  "fields": {
    "period": "2024-01",
    "claimedAmount": 500000.00,
    "approvedAmount": 480000.00,
    "note": "Poznámky ke zjištění"
  },
  "confidence": {
    "period": 0.95,
    "claimedAmount": 0.90,
    "approvedAmount": 0.85,
    "note": 0.70
  }
}

PRAVIDLA:
1. period ve formátu YYYY-MM.
2. claimedAmount = požadovaná/fakturovaná částka.
3. approvedAmount = schválená částka (pokud není, použij claimedAmount).
4. Pokud pole nelze nalézt, vynech ho z "fields".

TEXT PRŮVODKY:
`;

/**
 * Convert file to Base64 string
 */
function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

// Helper to get configured AI models from database
async function getAIModels() {
  const { data } = await supabase
    .from('app_settings')
    .select('ai_ocr_model, ai_extraction_model, ai_ocr_provider, ai_extraction_provider')
    .eq('id', 'default')
    .single();
  
  return {
    ocrProvider: data?.ai_ocr_provider || 'mistral',
    ocrModel: data?.ai_ocr_model || 'mistral-ocr-latest',
    extractionProvider: data?.ai_extraction_provider || 'openrouter',
    extractionModel: data?.ai_extraction_model || 'anthropic/claude-3.5-sonnet'
  };
}

/**
 * Extract text from PDF using Configured OCR Model via OpenRouter
 */
/**
 * Extract text from Document (PDF, DOCX) using Mistral OCR via AI Proxy
 */
async function extractTextFromDocument(file: File, onProgress?: (status: string) => void): Promise<string> {
  const { ocrModel, ocrProvider } = await getAIModels();
  
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (!['pdf', 'docx', 'doc'].includes(fileExt || '')) {
     throw new Error('Nepodporovaný formát souboru. Použijte PDF, DOCX nebo DOC.');
  }

  let uploadFile = file;
  let uploadPath = '';

  try {
      // Handle .doc conversion (macOS Desktop App only)
      if (fileExt === 'doc') {
          // @ts-ignore
          if (window.electronAPI && window.electronAPI.shell && window.electronAPI.shell.convertToDocx) {
              onProgress?.('Konvertuji .doc na .docx...');
              // @ts-ignore
              // file.path is available in Electron for File objects from inputs
              const result = await window.electronAPI.shell.convertToDocx((file as any).path);
              
              if (!result.success || !result.outputPath) {
                  throw new Error(`Konverze dokumentu selhala: ${result.error || 'Neznámá chyba'}`);
              }

              // Read the converted file
              // @ts-ignore
              const buffer = await window.electronAPI.fs.readFile(result.outputPath);
              const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
              
              // Create new File object
              uploadFile = new File([blob], file.name.replace(/\.doc$/i, '.docx'), { 
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  lastModified: Date.now() 
              });

              console.log('Converted .doc to .docx:', uploadFile.name, uploadFile.size);
          } else {
              throw new Error('Pro zpracování .doc souborů použijte desktopovou aplikaci na macOS nebo soubor uložte jako .docx.');
          }
      }

    // 1. Upload to Supabase Storage
    const timestamp = Date.now();
    uploadPath = `temp/ocr/${timestamp}_${uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    onProgress?.('Nahrávám dokument...');
    const { error: uploadError } = await supabase.storage
      .from('demand-documents')
      .upload(uploadPath, uploadFile, {
        upsert: true,
      });

    if (uploadError) {
      console.error('OCR Upload Error:', uploadError);
      throw new Error('Nepodařilo se nahrát soubor pro OCR zpracování.');
    }

    // 2. Get Signed URL (valid for 60 seconds)
    onProgress?.('Získávám bezpečný přístup...');
    const { data: urlData, error: signError } = await supabase.storage
      .from('demand-documents')
      .createSignedUrl(uploadPath, 60);
    
    if (signError || !urlData?.signedUrl) {
      throw new Error('Nepodařilo se vygenerovat přístupový odkaz k souboru.');
    }

    console.log('Sending to Mistral OCR:', urlData.signedUrl);

    // 3. Call AI Proxy with correct provider/model
    onProgress?.('Analyzuji obsah dokumentu pomocí AI...');
    const response = await invokeAuthedFunction<AIProxyResponse>('ai-proxy', {
      body: {
        provider: ocrProvider === 'google' ? 'google' : 'mistral-ocr',
        model: ocrModel, 
        documentUrl: urlData.signedUrl
      },
    });

    if (!response.text) {
      throw new Error('OCR model nevrátil žádný text.');
    }

    return response.text;

  } finally {
    // 4. Cleanup
    if (uploadPath) {
        try {
            await supabase.storage.from('demand-documents').remove([uploadPath]);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temp OCR file:', cleanupError);
        }
    }
  }
}

/**
 * Parse JSON from LLM response, handling markdown code blocks
 */
function parseJsonFromResponse(responseText: string): { fields: Partial<Contract>; confidence: Record<string, number> } {
  // Try to extract JSON from markdown code block first
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : responseText;

  // Find the JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Nepodařilo se nalézt JSON v odpovědi AI');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Nepodařilo se parsovat JSON: ${e instanceof Error ? e.message : 'Neznámá chyba'}`);
  }
}

export const contractExtractionService = {
  /**
   * Extract contract data from plain text using AI
   */
  extractFromText: async (text: string): Promise<ContractExtractionResult> => {
    if (!text || text.trim().length < 50) {
      throw new Error('Text je příliš krátký pro extrakci');
    }

    const { extractionModel, extractionProvider } = await getAIModels();

    const response = await invokeAuthedFunction<AIProxyResponse>('ai-proxy', {
      body: {
        prompt: CONTRACT_EXTRACTION_PROMPT + text.substring(0, 15000), // Limit text length
        provider: extractionProvider,
        model: extractionModel,
      },
    });

    const parsed = parseJsonFromResponse(response.text);

    return {
      fields: parsed.fields || {},
      confidence: parsed.confidence || {},
      rawText: text,
    };
  },

  /**
   * Extract contract data from a Document (PDF, DOCX)
   */
  extractFromDocument: async (file: File, onProgress?: (status: string) => void): Promise<ContractExtractionResult> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(fileExt || '')) {
      throw new Error('Soubor musí být ve formátu PDF, DOCX nebo DOC');
    }

    // This calls extractTextFromDocument which now uses configured OCR model
    const text = await extractTextFromDocument(file, onProgress);

    if (text.trim().length < 100) {
      throw new Error('OCR nevrátilo dostatek textu.');
    }

    onProgress?.('Extrahuji strukturovaná data...');
    return contractExtractionService.extractFromText(text);
  },

  /**
   * Extract amendment data from text
   */
  extractAmendmentFromText: async (text: string): Promise<{
    fields: Record<string, unknown>;
    confidence: Record<string, number>;
    rawText?: string;
  }> => {
    if (!text || text.trim().length < 30) {
      throw new Error('Text je příliš krátký pro extrakci');
    }

    const { extractionModel, extractionProvider } = await getAIModels();

    const response = await invokeAuthedFunction<AIProxyResponse>('ai-proxy', {
      body: {
        prompt: AMENDMENT_EXTRACTION_PROMPT + text.substring(0, 10000),
        provider: extractionProvider,
        model: extractionModel,
      },
    });

    const parsed = parseJsonFromResponse(response.text);

    return {
      fields: parsed.fields || {},
      confidence: parsed.confidence || {},
      rawText: text,
    };
  },

  /**
   * Extract amendment data from Document
   */
  extractAmendmentFromDocument: async (file: File): Promise<{
    fields: Record<string, unknown>;
    confidence: Record<string, number>;
    rawText?: string;
  }> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(fileExt || '')) {
      throw new Error('Soubor musí být ve formátu PDF nebo DOCX');
    }

    const text = await extractTextFromDocument(file);

    if (text.trim().length < 50) {
      throw new Error('Dokument neobsahuje dostatek textu.');
    }

    return contractExtractionService.extractAmendmentFromText(text);
  },

  /**
   * Extract drawdown/progress report data from text
   */
  extractDrawdownFromText: async (text: string): Promise<{
    fields: Record<string, unknown>;
    confidence: Record<string, number>;
    rawText?: string;
  }> => {
    if (!text || text.trim().length < 30) {
      throw new Error('Text je příliš krátký pro extrakci');
    }

    const { extractionModel, extractionProvider } = await getAIModels();

    const response = await invokeAuthedFunction<AIProxyResponse>('ai-proxy', {
      body: {
        prompt: DRAWDOWN_EXTRACTION_PROMPT + text.substring(0, 10000),
        provider: extractionProvider,
        model: extractionModel,
      },
    });

    const parsed = parseJsonFromResponse(response.text);

    return {
      fields: parsed.fields || {},
      confidence: parsed.confidence || {},
      rawText: text,
    };
  },

  /**
   * Extract drawdown data from Document
   */
  extractDrawdownFromDocument: async (file: File): Promise<{
    fields: Record<string, unknown>;
    confidence: Record<string, number>;
    rawText?: string;
  }> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(fileExt || '')) {
      throw new Error('Soubor musí být ve formátu PDF nebo DOCX');
    }

    const text = await extractTextFromDocument(file);

    if (text.trim().length < 50) {
      throw new Error('Dokument neobsahuje dostatek textu.');
    }

    return contractExtractionService.extractDrawdownFromText(text);
  },

  /**
   * Helper to get overall confidence score from individual field confidences
   */
  getOverallConfidence: (confidence: Record<string, number>): number => {
    const values = Object.values(confidence).filter(v => v > 0);
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  },

  /**
   * Helper to check if extraction results are reliable enough
   */
  isExtractionReliable: (confidence: Record<string, number>, threshold = 0.7): boolean => {
    const overall = contractExtractionService.getOverallConfidence(confidence);
    return overall >= threshold;
  },
};
