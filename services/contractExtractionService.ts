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
    "siteSetupPercent": 2.0,
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
    "siteSetupPercent": 0.70,
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
   - siteSetupPercent: "zařízení staveniště", "ZS", "ZS (%)", "zařízení staveniště (%)".
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
    const ocrPrompt = 'Extrahuj vsechen text z dokumentu. Vrat pouze cisty text bez formatovani.';
    const provider =
      ocrProvider === 'google'
        ? 'google'
        : ocrProvider === 'openrouter'
          ? 'openrouter'
          : 'mistral-ocr';
    const response = await invokeAuthedFunction<AIProxyResponse>('ai-proxy', {
      body: {
        provider,
        model: ocrModel,
        documentUrl: urlData.signedUrl,
        ...(provider === 'openrouter' ? { prompt: ocrPrompt } : {}),
      },
    });

    if (!response.text) {
      throw new Error('OCR model nevrátil žádný text.');
    }
    let combinedText = response.text;

    if (ocrProvider === 'openrouter') {
      try {
        onProgress?.('Zpřesňuji cenu díla...');
        const priceHintResponse = await invokeAuthedFunction<AIProxyResponse>('ai-proxy', {
          body: {
            provider: 'openrouter',
            model: ocrModel,
            documentUrl: urlData.signedUrl,
            prompt:
              'Najdi v dokumentu cenu dila nebo celkovou cenu. Vrat pouze cislo a menu (napr. 1.407.351,- Kč) bez dalsiho textu. Pokud nenajdes, vrat prazdny retezec.',
          },
        });
        const priceHint = parseAmountFromText(priceHintResponse.text || '');
        if (priceHint) {
          const currencyLabel = priceHint.currency ? ` ${priceHint.currency}` : '';
          combinedText += `\n\nCena dila (OCR fokus): ${priceHint.value}${currencyLabel}`;
        }
      } catch (error) {
        console.warn('Failed to extract OCR price hint:', error);
      }
    }

    return combinedText;

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

type AmountMatch = {
  value: number;
  currency?: string;
};

function normalizeAmount(raw: string): number | null {
  let cleaned = raw.replace(/\s+/g, '');
  cleaned = cleaned.replace(/,(\d{2}),-/g, ',$1');
  cleaned = cleaned.replace(/,-/g, ',00');
  cleaned = cleaned.replace(/\./g, '');
  cleaned = cleaned.replace(/[^0-9,.-]/g, '');
  if (cleaned.endsWith('-')) cleaned = cleaned.slice(0, -1);
  cleaned = cleaned.replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

function parseAmountFromText(text: string): AmountMatch | null {
  const regex = /(-?\d{1,3}(?:[ .]\d{3})*(?:,\d{2}|,-)?|-?\d+)\s*(kč|kc|czk|eur|€)?/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const value = normalizeAmount(match[1]);
    if (value === null) continue;
    const currencyRaw = match[2];
    const currency = currencyRaw
      ? currencyRaw.toLowerCase() === '€'
        ? 'EUR'
        : currencyRaw.toUpperCase().replace('KC', 'CZK')
      : undefined;
    return { value, currency };
  }
  return null;
}

function extractAmountNearKeywords(text: string, keywords: string[]): AmountMatch | null {
  const normalized = text.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  for (const keyword of keywords) {
    let index = lower.indexOf(keyword);
    while (index !== -1) {
      const start = Math.max(0, index - 120);
      const end = Math.min(normalized.length, index + 600);
      const windowText = normalized.slice(start, end);
      const regex = /(-?\d{1,3}(?:[ .]\d{3})*(?:,\d{2}|,-)?|-?\d+)\s*(kč|kc|czk|eur|€)?/gi;
      let match: RegExpExecArray | null;
      let best: AmountMatch | null = null;

      while ((match = regex.exec(windowText)) !== null) {
        const value = normalizeAmount(match[1]);
        if (value === null) continue;
        const currencyRaw = match[2];
        const currency = currencyRaw
          ? currencyRaw.toLowerCase() === '€'
            ? 'EUR'
            : currencyRaw.toUpperCase()
          : undefined;

        if (!best || (currency && !best.currency)) {
          best = { value, currency };
        }
      }

      if (best) return best;
      index = lower.indexOf(keyword, index + keyword.length);
    }
  }

  return null;
}

function extractAmountFromLineWindow(text: string, keywords: string[]): AmountMatch | null {
  const lines = text.split(/\r?\n/);
  const normalizedKeywords = keywords.map((k) => k.toLowerCase());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].toLowerCase();
    if (!normalizedKeywords.some((keyword) => line.includes(keyword))) {
      continue;
    }

    for (let offset = 0; offset <= 4; offset += 1) {
      const targetLine = lines[i + offset];
      if (!targetLine) continue;
      const regex = /(-?\d{1,3}(?:[ .]\d{3})*(?:,\d{2}|,-)?|-?\d+)\s*(kč|kc|czk|eur|€)?/gi;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(targetLine)) !== null) {
        const value = normalizeAmount(match[1]);
        if (value === null) continue;
        const currencyRaw = match[2];
        const currency = currencyRaw
          ? currencyRaw.toLowerCase() === '€'
            ? 'EUR'
            : currencyRaw.toUpperCase().replace('KC', 'CZK')
          : undefined;
        return { value, currency };
      }
    }
  }

  return null;
}

function extractAmountNearSpelled(text: string): AmountMatch | null {
  const keywords = ['slovy', 'korun', 'korun českých', 'kc', 'kč'];
  return extractAmountFromLineWindow(text, keywords);
}

function normalizePercent(raw: string): number | null {
  const cleaned = raw.replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

function extractPercentNearKeywords(text: string, keywords: string[]): number | null {
  const normalized = text.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  for (const keyword of keywords) {
    let index = lower.indexOf(keyword);
    while (index !== -1) {
      const start = Math.max(0, index - 120);
      const end = Math.min(normalized.length, index + 400);
      const windowText = normalized.slice(start, end);
      const regex = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(windowText)) !== null) {
        const value = normalizePercent(match[1]);
        if (value === null) continue;
        return value;
      }

      index = lower.indexOf(keyword, index + keyword.length);
    }
  }

  return null;
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
    const fields = { ...(parsed.fields || {}) } as Partial<Contract>;
    const confidence = { ...(parsed.confidence || {}) } as Record<string, number>;

    if (
      !fields.basePrice ||
      !Number.isFinite(fields.basePrice) ||
      (typeof fields.basePrice === 'number' && fields.basePrice <= 0)
    ) {
      const keywords = [
        'cena dila',
        'cena díla',
        'cena dila a platebni podminky',
        'cena díla a platební podmínky',
        'celkova cena',
        'celková cena',
        'celkova cena dila',
        'celková cena díla',
        'smluvni cena',
        'smluvní cena',
        'cena za dilo',
        'cena za dílo',
        'cini',
        'činí',
      ];
      const fallback =
        extractAmountNearKeywords(text, keywords) ||
        extractAmountFromLineWindow(text, keywords) ||
        extractAmountNearSpelled(text);
      if (fallback) {
        fields.basePrice = fallback.value as never;
        if (!fields.currency && fallback.currency) {
          fields.currency = fallback.currency as never;
        }
        confidence.basePrice = Math.max(confidence.basePrice || 0, 0.45);
      }
    }

    if (
      fields.siteSetupPercent === undefined ||
      !Number.isFinite(fields.siteSetupPercent as number)
    ) {
      const fallbackPercent = extractPercentNearKeywords(text, [
        'zařízení staveniště',
        'zarizeni staveniste',
        'zs (%)',
        'zs',
      ]);
      if (fallbackPercent !== null) {
        fields.siteSetupPercent = fallbackPercent as never;
        confidence.siteSetupPercent = Math.max(
          confidence.siteSetupPercent || 0,
          0.45,
        );
      }
    }

    return {
      fields,
      confidence,
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
