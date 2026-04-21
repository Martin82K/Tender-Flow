import { describe, expect, it } from 'vitest';
import { extractRetentionSplit } from '@/services/contractExtractionService';

describe('extractRetentionSplit — dvojitá pozastávka', () => {
  it('najde krátkodobou „do převzetí“ a dlouhodobou „do konce záruky“', () => {
    const text =
      'Pozastávka činí 7 % do převzetí díla a 3 % do konce záruční doby.';
    const result = extractRetentionSplit(text);
    expect(result.short).toBe(7);
    expect(result.long).toBe(3);
  });

  it('rozpozná „krátkodobá“ a „dlouhodobá“ klíčová slova', () => {
    const text = 'Pozastávka krátkodobá 8 %, pozastávka dlouhodobá 2 %.';
    const result = extractRetentionSplit(text);
    expect(result.short).toBe(8);
    expect(result.long).toBe(2);
  });

  it('pokud je jen jedna hodnota s „do převzetí“, vrátí krátkodobou', () => {
    const text = 'Zhotovitel uvolní zádržné ve výši 5 % po převzetí díla.';
    const result = extractRetentionSplit(text);
    expect(result.short).toBe(5);
    expect(result.long).toBeNull();
  });

  it('pokud se klíčová slova nenajdou, vrátí null', () => {
    const text = 'Celková cena díla činí 1 200 000 Kč bez DPH.';
    const result = extractRetentionSplit(text);
    expect(result.short).toBeNull();
    expect(result.long).toBeNull();
  });
});
