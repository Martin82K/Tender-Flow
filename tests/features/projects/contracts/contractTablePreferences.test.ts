import { describe, expect, it } from 'vitest';
import {
  CONTRACT_COLUMN_IDS,
  DEFAULT_CONTRACT_COLUMN_WIDTHS,
  parseContractTablePreferences,
  resizeContractColumn,
} from '@/features/projects/contracts/list/contractTablePreferences';

describe('contractTablePreferences', () => {
  it('řadí dodavatele, číslo smlouvy a dokument jako první sloupce', () => {
    expect(CONTRACT_COLUMN_IDS.slice(0, 3)).toEqual(['vendor', 'number', 'document']);
  });

  it('načte verzované viditelné sloupce a uložené šířky', () => {
    expect(
      parseContractTablePreferences(
        JSON.stringify({
          version: 2,
          visibleColumns: ['number', 'document', 'vendor'],
          widths: { number: 420, document: 110, vendor: 280 },
        }),
      ),
    ).toMatchObject({
      visibleColumns: ['number', 'document', 'vendor'],
      widths: { number: 420, document: 110, vendor: 280 },
    });
  });

  it('odmítne neznámé sloupce a omezí extrémní šířky', () => {
    const prefs = parseContractTablePreferences(
      JSON.stringify({
        version: 2,
        visibleColumns: ['number', 'attacker'],
        widths: { number: 99999, vendor: -500, attacker: 300 },
      }),
    );

    expect(prefs.visibleColumns).toEqual(['number']);
    expect(prefs.widths.number).toBeLessThanOrEqual(720);
    expect(prefs.widths.vendor).toBeGreaterThanOrEqual(100);
    expect(prefs.widths).not.toHaveProperty('attacker');
  });

  it('podporuje staré uložené pole viditelných sloupců', () => {
    expect(parseContractTablePreferences('["number","vendor"]')).toMatchObject({
      visibleColumns: ['number', 'vendor'],
      widths: DEFAULT_CONTRACT_COLUMN_WIDTHS,
    });
  });

  it('mění šířku v bezpečných mezích', () => {
    expect(resizeContractColumn('number', 120)).toBeGreaterThanOrEqual(140);
    expect(resizeContractColumn('number', 400)).toBe(400);
    expect(resizeContractColumn('number', 5_000)).toBeLessThanOrEqual(720);
  });
});
