import { decimal } from './budgetModel';
import type { BudgetDocument, BudgetNode, FigureConflict, FigureResolution, ImportIssue } from './types';

/** Merge legacy per-sheet warnings so one code always has one explicit decision. */
export function getFigureConflicts(document: BudgetDocument): FigureConflict[] {
  const conflicts = new Map<string, FigureConflict>();
  for (const issue of document.issues) {
    if (issue.kind !== 'ambiguous-figures') continue;
    for (const figure of issue.figures ?? []) {
      const previous = conflicts.get(figure.code);
      conflicts.set(figure.code, {
        code: figure.code,
        values: [...new Set([...(previous?.values ?? []), ...figure.values])],
        sources: [...(previous?.sources ?? []), ...(figure.sources ?? [])],
      });
    }
  }
  return [...conflicts.values()];
}

export function resolveFigureConflict(document: BudgetDocument, code: string, input: string, origin: FigureResolution['origin']): BudgetDocument {
  const conflict = getFigureConflicts(document).find(figure => figure.code === code);
  if (!conflict) throw new Error('Konflikt již není dostupný. Zkontrolujte nové rozpoznání souboru.');
  const value = decimal(input);
  if (value === null) throw new Error('Zadejte hodnotu figury.');
  if (origin !== 'source' && origin !== 'custom') throw new Error('Neplatný způsob řešení konfliktu.');
  if (origin === 'source' && !conflict.values.includes(value)) throw new Error('Hodnota není mezi nalezenými hodnotami.');
  // Computed own keys keep figure names such as __proto__ inert, including after JSON serialization.
  return {
    ...document,
    figures: { ...document.figures, [code]: value },
    figureResolutions: { ...document.figureResolutions, [code]: { value, origin } },
  };
}

export function clearFigureResolution(document: BudgetDocument, code: string): BudgetDocument {
  if (!getFigureConflicts(document).some(figure => figure.code === code)) return document;
  const figures = { ...document.figures };
  const figureResolutions = { ...document.figureResolutions };
  delete figures[code];
  delete figureResolutions[code];
  return { ...document, figures, figureResolutions };
}

export function getFigureResolution(document: BudgetDocument, code: string): FigureResolution | undefined {
  if (!Object.hasOwn(document.figureResolutions ?? {}, code)) return undefined;
  const resolution = document.figureResolutions![code];
  return Object.hasOwn(document.figures, code) && document.figures[code] === resolution.value ? resolution : undefined;
}

/** A scoped remap must not discard decisions for unchanged conflict values. */
export function preserveUnchangedFigureResolutions(previous: BudgetDocument, parsed: BudgetDocument): BudgetDocument {
  const before = new Map(getFigureConflicts(previous).map(conflict => [conflict.code, conflict]));
  const signature = (values: string[]) => JSON.stringify([...new Set(values)].sort());
  const figures = {...parsed.figures}; const resolutions: Record<string, FigureResolution> = {};
  for (const conflict of getFigureConflicts(parsed)) {
    const old = before.get(conflict.code); const resolution = getFigureResolution(previous, conflict.code);
    if (!old || !resolution || signature(old.values) !== signature(conflict.values)) continue;
    try {
      if (decimal(resolution.value) !== resolution.value || !['source','custom'].includes(resolution.origin)) continue;
      if (resolution.origin === 'source' && !conflict.values.includes(resolution.value)) continue;
      Object.defineProperty(resolutions, conflict.code, {value:{...resolution},enumerable:true,writable:true,configurable:true});
      Object.defineProperty(figures, conflict.code, {value:resolution.value,enumerable:true,writable:true,configurable:true});
    } catch { /* Invalid legacy decisions must be reviewed again. */ }
  }
  return {...parsed,figures,figureResolutions:Object.keys(resolutions).length?resolutions:undefined};
}

/** Keep original warnings as provenance; only unresolved conflicts count in the review. */
export function getPendingImportIssues(document: BudgetDocument): ImportIssue[] {
  return document.issues.flatMap(issue => {
    if (issue.kind !== 'ambiguous-figures' || !issue.figures?.length) return [issue];
    const figures = issue.figures.filter(figure => !getFigureResolution(document, figure.code));
    return figures.length ? [{ ...issue, figures }] : [];
  });
}

export interface FigureUsage {
  sheet: string; row: number; expression: string; selected: boolean;
  object: string; title: string; node: BudgetNode; item?: BudgetNode; lines: BudgetNode[];
}
export function findFigureUsages(document: BudgetDocument): Map<string, FigureUsage[]> {
  const usages = new Map(getFigureConflicts(document).map(figure => [figure.code, [] as FigureUsage[]]));
  const sheets = new Map(document.sheets.map(sheet => [sheet.id, sheet]));
  const nodes = new Map(document.nodes.map(node => [node.id, node]));
  const children = new Map<string, BudgetNode[]>();
  for (const node of document.nodes) {
    if (!node.parentId) continue;
    const parent = nodes.get(node.parentId);
    if (!parent || parent.sheetId !== node.sheetId || (parent.kind !== 'K' && parent.kind !== 'M')) continue;
    const siblings = children.get(parent.id) ?? [];
    siblings.push(node);
    children.set(parent.id, siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.order - b.order);
  for (const node of document.nodes) {
    if (node.kind !== 'VV') continue;
    const sheet = sheets.get(node.sheetId);
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    const item = parent?.sheetId === node.sheetId && (parent.kind === 'K' || parent.kind === 'M') ? parent : undefined;
    for (const code of new Set(node.description.match(/[A-Za-z_][A-Za-z_0-9]*/g) ?? [])) {
      usages.get(code)?.push({
        sheet: node.source.sheet, row: node.source.row, expression: node.description,
        selected: sheet?.selected === true && sheet.role === 'items', object: sheet?.object ?? '', title: sheet?.title ?? '',
        node, item, lines: item ? children.get(item.id) ?? [] : [node],
      });
    }
  }
  return usages;
}
