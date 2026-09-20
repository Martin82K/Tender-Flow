/** @typedef {import('./types').OfferItem} OfferItem */
/** @typedef {import('./types').OfferAssignment} OfferAssignment */
/** @typedef {import('./types').OfferComparison} OfferComparison */
// Shared pure engine: browser and MCP use identical matching and totals.
// Source documents and prices are never changed by this module.
const MAX_ITEMS = 10000;
const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('cs');
const unit = value => normalize(value).replace(/²/g, '2').replace(/³/g, '3');
const decimal = value => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^-?\d{1,15}(\.\d{1,12})?$/.test(text)) throw new Error('Neplatná číselná hodnota položky.');
  const [whole, fraction = ''] = text.split('.');
  return { n: BigInt(whole + fraction), scale: fraction.length };
};
const equalDecimal = (a, b) => {
  const x = decimal(a), y = decimal(b);
  return x !== null && y !== null && x.n * 10n ** BigInt(y.scale) === y.n * 10n ** BigInt(x.scale);
};
const cents = value => {
  const d = decimal(value);
  if (!d) return null;
  if (d.scale <= 2) return d.n * 10n ** BigInt(2 - d.scale);
  const divisor = 10n ** BigInt(d.scale - 2);
  const sign = d.n < 0n ? -1n : 1n;
  return sign * ((sign * d.n + divisor / 2n) / divisor);
};
const money = value => `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`;
/** @param {OfferItem[]} items */
export function validateItems(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new Error('Neplatný počet položek.');
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 200 || ids.has(item.id)) throw new Error('Neplatná nebo duplicitní identita položky.');
    ids.add(item.id);
    for (const key of ['code', 'description', 'unit', 'group']) if (typeof item[key] !== 'string' || item[key].length > 4000) throw new Error('Neplatný text položky.');
    for (const key of ['quantity', 'unitPrice', 'total']) decimal(item[key]);
    if (!item.source || typeof item.source.sheet !== 'string' || item.source.sheet.length > 255 || !Number.isInteger(item.source.row) || item.source.row < 1) throw new Error('Chybí odkaz na zdrojový řádek.');
  }
}
/** @param {OfferItem[]} base @param {OfferItem[]} offers @returns {OfferAssignment[]} */
export function matchOfferItems(base, offers) {
  validateItems(base); validateItems(offers);
  const byCode = new Map(), byDescription = new Map();
  for (const row of offers) for (const [index, key] of [[byCode, normalize(row.code)], [byDescription, normalize(row.description)]]) {
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  const results = base.map(row => {
    const codeCandidates = byCode.get(normalize(row.code)) || [];
    const descriptionCandidates = byDescription.get(normalize(row.description)) || [];
    if (codeCandidates.length + descriptionCandidates.length > 200) return { baseId: row.id, offerId: null, status: 'review', candidates: [...new Set([...codeCandidates.slice(0, 15), ...descriptionCandidates.slice(0, 15)].map(r => r.id))], reasons: ['too-many-candidates'] };
    const candidates = new Map();
    for (const candidate of [...(byCode.get(normalize(row.code)) || []), ...(byDescription.get(normalize(row.description)) || [])]) candidates.set(candidate.id, candidate);
    const ranked = [...candidates.values()].map(candidate => {
      const reasons = [];
      if (normalize(row.code) && normalize(candidate.code) && normalize(row.code) !== normalize(candidate.code)) reasons.push('different-code');
      if (!normalize(row.description) || normalize(row.description) !== normalize(candidate.description)) reasons.push('different-description');
      if (!unit(row.unit) || unit(row.unit) !== unit(candidate.unit)) reasons.push('different-unit');
      if (!equalDecimal(row.quantity, candidate.quantity)) reasons.push('different-quantity');
      if (normalize(row.group) && normalize(candidate.group) && normalize(row.group) !== normalize(candidate.group)) reasons.push('different-group');
      return { candidate, reasons };
    });
    const exact = ranked.filter(r => r.reasons.length === 0);
    const selected = exact.length === 1 ? exact[0].candidate.id : null;
    return { baseId: row.id, offerId: selected, status: selected ? 'matched' : ranked.length ? 'review' : 'unmatched', candidates: ranked.slice(0, 30).map(r => r.candidate.id), reasons: selected ? [] : [...new Set(ranked.flatMap(r => r.reasons).concat(exact.length > 1 ? ['ambiguous'] : []))] };
  });
  const counts = new Map();
  for (const result of results) if (result.offerId) counts.set(result.offerId, (counts.get(result.offerId) || 0) + 1);
  return results.map(result => result.offerId && counts.get(result.offerId) > 1 ? { ...result, offerId: null, status: 'review', reasons: ['shared-candidate'] } : result);
}
/** @param {OfferItem[]} base @param {OfferItem[]} offers @param {OfferAssignment[]} assignments */
export function validateAssignments(base, offers, assignments) {
  validateItems(base); validateItems(offers);
  if (!Array.isArray(assignments) || assignments.length > base.length) throw new Error('Neplatné vazby.');
  const baseIds = new Set(base.map(r => r.id)), offerIds = new Set(offers.map(r => r.id)), seenBase = new Set(), seenOffer = new Set();
  for (const link of assignments) {
    if (!baseIds.has(link.baseId) || seenBase.has(link.baseId) || !['matched', 'manual', 'review', 'unmatched'].includes(link.status)) throw new Error('Neplatná vazba na poptávku.');
    seenBase.add(link.baseId);
    if (link.offerId === null && ['matched', 'manual'].includes(link.status)) throw new Error('Potvrzená vazba musí mít položku nabídky.');
    if (link.offerId !== null) {
      if (!offerIds.has(link.offerId) || seenOffer.has(link.offerId) || !['matched', 'manual'].includes(link.status)) throw new Error('Neplatná nebo opakovaná vazba na nabídku.');
      seenOffer.add(link.offerId);
    }
  }
}
/** @param {OfferItem[]} base @param {OfferItem[]} offers @param {OfferAssignment[]} assignments @returns {OfferComparison} */
export function compareOffer(base, offers, assignments) {
  validateAssignments(base, offers, assignments);
  const indexed = new Map(offers.map(r => [r.id, r])), links = new Map(assignments.map(r => [r.baseId, r]));
  let total = 0n, pricedCount = 0;
  const used = new Set();
  const rows = base.map(item => {
    const link = links.get(item.id), offer = link?.offerId ? indexed.get(link.offerId) : null;
    if (offer) used.add(offer.id);
    const quoted = offer ? cents(offer.total) : null;
    const comparable = offer && unit(item.unit) && unit(item.unit) === unit(offer.unit) && equalDecimal(item.quantity, offer.quantity) ? quoted : null;
    if (comparable !== null) { total += comparable; pricedCount++; }
    return { baseId: item.id, offerId: offer?.id || null, quotedTotal: quoted === null ? null : money(quoted), comparableTotal: comparable === null ? null : money(comparable), priceStatus: !offer ? 'unmatched' : quoted === null ? 'missing-price' : comparable === null ? 'different-scope' : 'priced' };
  });
  return { rows, total: money(total), pricedCount, complete: base.length > 0 && pricedCount === base.length, extraIds: offers.filter(r => !used.has(r.id)).map(r => r.id) };
}
