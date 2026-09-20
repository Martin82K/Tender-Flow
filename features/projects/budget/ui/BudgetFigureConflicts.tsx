import React, { useId, useMemo, useState } from 'react';
import { formatBudgetNumber } from '../model/budgetModel';
import { clearFigureResolution, findFigureUsages, getFigureConflicts, getFigureResolution, resolveFigureConflict } from '../model/figureConflicts';
import type { FigureUsage } from '../model/figureConflicts';
import type { BudgetDocument, FigureConflict, FigureResolution } from '../model/types';

interface Props { document: BudgetDocument; busy: boolean; onChange: (document: BudgetDocument) => void }

function FigureItemPreview({ code, usages }: { code: string; usages: FigureUsage[] }) {
  const [index, setIndex] = useState(0);
  const items = useMemo(() => [...new Map(usages.map(usage => [usage.item?.id ?? usage.node.id, usage])).values()], [usages]);
  const currentIndex = Math.min(index, Math.max(0, items.length - 1));
  const usage = items[currentIndex];
  if (!usage) return <p className="tf-budget-import-muted">V rozpoznaném výkazu výměr nebyl nalezen odkaz na tento kód. Související položku ověřte v původním XLSX.</p>;
  const item = usage.item;
  const highlight = (text: string) => text.split(/([A-Za-z_][A-Za-z_0-9]*)/g).map((part, i) => part === code ? <mark key={i}>{part}</mark> : part);
  return <section className="tf-budget-figure-item" aria-label={`Celá položka pro ${code}`}>
    <div className="tf-budget-figure-item-nav">
      <strong>Položka {currentIndex + 1} z {items.length}</strong>
      {items.length > 1 && <div>
        <button type="button" aria-label={`Předchozí položka pro ${code}`} disabled={currentIndex === 0} onClick={() => setIndex(currentIndex - 1)}>Předchozí</button>
        <button type="button" aria-label={`Další položka pro ${code}`} disabled={currentIndex === items.length - 1} onClick={() => setIndex(currentIndex + 1)}>Další</button>
      </div>}
    </div>
    <dl className="tf-budget-figure-item-location">
      <div><dt>Objekt</dt><dd>{usage.object || 'Neuveden'}</dd></div>
      <div><dt>Soupis</dt><dd>{usage.title || usage.sheet}</dd></div>
    </dl>
    {!usage.selected && <p><strong>Nezařazený soupis</strong> · Tato položka se nyní nebude importovat.</p>}
    {item ? <>
      <div><strong>{item.kind} · <span>{item.code || 'Bez kódu'}</span></strong><small className="tf-budget-import-muted">{item.source.sheet}, řádek {item.source.row}</small></div>
      <p className="tf-budget-figure-item-description">{item.description}</p>
      <dl className="tf-budget-figure-item-values">
        <div><dt>Množství</dt><dd>{formatBudgetNumber(item.quantity) || 'Neuvedeno'}</dd></div>
        <div><dt>MJ</dt><dd>{item.unit || 'Neuvedena'}</dd></div>
        <div><dt>Jednotková cena</dt><dd>{formatBudgetNumber(item.unitPrice) || 'Neuvedena'}</dd></div>
        <div><dt>Cena celkem</dt><dd>{formatBudgetNumber(item.total) || 'Neuvedena'}</dd></div>
      </dl>
    </> : <p><strong>Nadřazená položka nebyla rozpoznána.</strong> Zobrazen je pouze původní řádek výkazu výměr. Celou položku ověřte v XLSX.</p>}
    <p><strong>Výkaz výměr a poznámky</strong> · Původní hodnoty z XLSX</p>
    <ol className="tf-budget-figure-item-lines">
      {usage.lines.map(line => <li key={line.id}>
        <div className="tf-budget-figure-item-line-source"><span>{line.sourceType || line.kind} · řádek {line.source.row}</span><span>{formatBudgetNumber(line.quantity)}{line.unit ? ` ${line.unit}` : ''}</span></div>
        <p className="tf-budget-figure-item-description">{line.kind === 'VV' ? highlight(line.description) : line.description}</p>
      </li>)}
    </ol>
    <small className="tf-budget-import-muted">Zvýrazněny jsou odkazy na {code}. Prohlížení položek hodnotu figury nevybírá ani nic nepřepočítává.</small>
  </section>;
}

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
    <FigureItemPreview code={figure.code} usages={usages}/>
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
