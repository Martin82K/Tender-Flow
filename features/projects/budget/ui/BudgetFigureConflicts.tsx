import React, { useId, useMemo, useState } from 'react';
import { formatBudgetNumber } from '../model/budgetModel';
import { clearFigureResolution, findFigureUsages, getFigureConflicts, getFigureResolution, resolveFigureConflict } from '../model/figureConflicts';
import type { FigureUsage } from '../model/figureConflicts';
import type { BudgetDocument, FigureConflict, FigureResolution } from '../model/types';

interface Props { document: BudgetDocument; busy: boolean; onChange: (document: BudgetDocument) => void }

function FigureChoice({ figure, resolution, usages, busy, onResolve, onClear }: {
  figure: FigureConflict; resolution?: FigureResolution; usages: FigureUsage[]; busy: boolean;
  onResolve: (input: string, origin: FigureResolution['origin']) => void; onClear: () => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(resolution?.origin === 'custom' ? resolution.value : '');
  const [error, setError] = useState('');
  const resolve = (value: string, origin: FigureResolution['origin']) => {
    try { onResolve(value, origin); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Hodnotu nelze použít.'); }
  };
  return <details className="tf-budget-figure">
    <summary><strong>{figure.code}</strong><span>{resolution ? `Vyřešeno · ${formatBudgetNumber(resolution.value)}` : 'Nevyřešeno'}</span></summary>
    <fieldset disabled={busy}>
      <legend>Hodnota figury {figure.code}</legend>
      <p className="tf-budget-import-muted">Volba platí pro tento kód v celém importovaném rozpočtu.</p>
      {figure.values.map(value => <label className="tf-budget-figure-option" key={value}>
        <input type="radio" name={id} aria-label={`Použít ${formatBudgetNumber(value)} pro ${figure.code}`} checked={resolution?.origin === 'source' && resolution.value === value} onChange={() => resolve(value, 'source')}/>
        <span><strong>{formatBudgetNumber(value)}</strong>{figure.sources?.filter(source => source.value === value).map(source => <small key={`${source.sheet}:${source.cell}`}>{source.sheet}, řádek {source.row} · {source.cell}</small>)}</span>
      </label>)}
      {!figure.sources?.length && <p className="tf-budget-import-muted">Starší rozpoznání neobsahuje zdrojové buňky. Najdete je v původním XLSX.</p>}
      <label className="tf-budget-field" htmlFor={`${id}-custom`}>Vlastní hodnota pro {figure.code}</label>
      <div className="tf-budget-figure-custom">
        <input id={`${id}-custom`} type="text" inputMode="decimal" maxLength={64} value={custom} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => { setCustom(event.target.value); setError(''); }}/>
        <button type="button" aria-label={`Použít vlastní hodnotu pro ${figure.code}`} onClick={() => resolve(custom, 'custom')}>Použít hodnotu</button>
      </div>
      <small id={`${id}-help`} className="tf-budget-import-muted">Vlastní číslo se použije až tlačítkem Použít hodnotu. Lze zadat desetinnou čárku.</small>
      {error && <p id={`${id}-error`} role="alert" className="tf-budget-error">{error}</p>}
      {resolution && <button type="button" aria-label={`Zrušit volbu pro ${figure.code}`} onClick={() => { onClear(); setError(''); }}>Zrušit volbu</button>}
    </fieldset>
    <details className="tf-budget-figure-usages">
      <summary>Použití ve výkazu výměr ({usages.length})</summary>
      {usages.length ? <><ul>{usages.slice(0, 50).map(usage => <li key={`${usage.sheet}:${usage.row}`}>
        <strong>{usage.sheet}, řádek {usage.row}{usage.selected ? '' : ' · nezařazený soupis'}</strong>
        <span>{usage.expression}</span>
      </li>)}</ul>{usages.length > 50 && <p>Zobrazeno prvních 50 z {usages.length} výskytů. Ostatní ověřte v původním XLSX.</p>}</> : <p>V rozpoznaném výkazu výměr nebyl nalezen odkaz na tento kód.</p>}
    </details>
  </details>;
}

export function BudgetFigureConflicts({ document, busy, onChange }: Props) {
  const conflicts = useMemo(() => getFigureConflicts(document), [document.issues]);
  const usages = useMemo(() => findFigureUsages(document), [document.nodes, document.sheets, document.issues]);
  if (!conflicts.length) return null;
  const resolved = conflicts.filter(figure => getFigureResolution(document, figure.code)).length;
  return <section className="tf-budget-figure-conflicts" aria-label="Konflikty figur">
    <div className="tf-budget-figure-heading"><strong>Konflikty figur</strong><span role="status">Vyřešeno {resolved} z {conflicts.length}</span></div>
    <p>Vyberte správnou hodnotu pro budoucí přepočty. Množství a ceny z XLSX se touto volbou nemění.</p>
    {resolved < conflicts.length && <p><strong>Import ani potvrzení to neblokuje.</strong> Nevyřešené figury se však nedají použít při přepočtu výkazu výměr.</p>}
    {conflicts.map(figure => <FigureChoice key={figure.code} figure={figure} resolution={getFigureResolution(document, figure.code)} usages={usages.get(figure.code) ?? []} busy={busy}
      onResolve={(value, origin) => onChange(resolveFigureConflict(document, figure.code, value, origin))}
      onClear={() => onChange(clearFigureResolution(document, figure.code))}/>)}
  </section>;
}
