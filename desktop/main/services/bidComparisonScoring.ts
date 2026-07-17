import type {
  BidComparisonEvaluation,
  BidComparisonFileConfig,
  BidComparisonMatrixItem,
  BidComparisonPriceAnomaly,
  BidComparisonSupplierCriteria,
  BidComparisonWeights,
} from '../types';

export const DEFAULT_BID_COMPARISON_WEIGHTS: BidComparisonWeights = {
  price: 45,
  completeness: 20,
  commercialTerms: 15,
  supplierHistory: 10,
  priceRisk: 10,
};

export const createEmptySupplierCriteria = (): BidComparisonSupplierCriteria => ({
  realizationDate: null,
  warrantyMonths: null,
  maturityDays: null,
  scopeConfirmed: null,
  supplierRating: null,
  note: '',
});

export const createDefaultBidComparisonConfig = (): BidComparisonFileConfig => ({
  version: 1,
  weights: { ...DEFAULT_BID_COMPARISON_WEIGHTS },
  suppliers: {},
});

const roundScore = (value: number): number => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;

const median = (values: number[]): number => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
};

const itemKey = (item: BidComparisonMatrixItem): string =>
  item.kod?.trim() || item.pc?.trim() || `row:${item.radek}`;

const detectAnomalies = (matrix: BidComparisonMatrixItem[]): BidComparisonPriceAnomaly[] => {
  const anomalies: BidComparisonPriceAnomaly[] = [];
  matrix.forEach((item) => {
    const pricedOffers = Object.values(item.offers).filter(
      (offer) => offer.jcena != null && Number.isFinite(offer.jcena) && offer.jcena >= 0,
    );
    if (pricedOffers.length < 3) return;
    const reference = median(pricedOffers.map((offer) => offer.jcena as number));
    if (reference <= 0) return;
    pricedOffers.forEach((offer) => {
      const price = offer.jcena as number;
      const deviationPercent = ((price - reference) / reference) * 100;
      if (Math.abs(deviationPercent) <= 30) return;
      anomalies.push({
        itemKey: itemKey(item),
        supplierName: offer.supplierName,
        displayLabel: offer.displayLabel,
        price,
        median: reference,
        deviationPercent: Math.round(deviationPercent * 100) / 100,
        direction: deviationPercent < 0 ? 'low' : 'high',
      });
    });
  });
  return anomalies;
};

const hasCommercialTerms = (criteria: BidComparisonSupplierCriteria): boolean =>
  Boolean(criteria.realizationDate) &&
  criteria.warrantyMonths != null &&
  criteria.maturityDays != null &&
  criteria.scopeConfirmed != null;

const commercialScore = (
  criteria: BidComparisonSupplierCriteria,
  allCriteria: BidComparisonSupplierCriteria[],
): number => {
  const dates = allCriteria.map((item) => Date.parse(item.realizationDate as string));
  const currentDate = Date.parse(criteria.realizationDate as string);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateScore = maxDate === minDate ? 100 : ((maxDate - currentDate) / (maxDate - minDate)) * 100;
  const maxWarranty = Math.max(...allCriteria.map((item) => item.warrantyMonths as number), 1);
  const maxMaturity = Math.max(...allCriteria.map((item) => item.maturityDays as number), 1);
  return roundScore(
    (dateScore + ((criteria.warrantyMonths as number) / maxWarranty) * 100 +
      ((criteria.maturityDays as number) / maxMaturity) * 100 +
      (criteria.scopeConfirmed ? 100 : 0)) / 4,
  );
};

const normalizedWeights = (
  requested: BidComparisonWeights,
  commercialEnabled: boolean,
  historyEnabled: boolean,
): BidComparisonWeights => {
  const included = {
    ...requested,
    commercialTerms: commercialEnabled ? requested.commercialTerms : 0,
    supplierHistory: historyEnabled ? requested.supplierHistory : 0,
  };
  const total = Object.values(included).reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error('Součet použitelných vah musí být větší než nula.');
  return Object.fromEntries(
    Object.entries(included).map(([key, value]) => [key, Math.round((value / total) * 10_000) / 100]),
  ) as unknown as BidComparisonWeights;
};

export const validateBidComparisonConfig = (config: BidComparisonFileConfig): BidComparisonFileConfig => {
  if (!config || config.version !== 1) throw new Error('Nepodporovaná verze konfigurace porovnání.');
  const weights = config.weights;
  if (!weights || Object.values(weights).some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error('Váhy porovnání musí být čísla od 0 do 100.');
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 0.001) throw new Error('Součet vah porovnání musí být 100 %.');
  if (!config.suppliers || typeof config.suppliers !== 'object' || Array.isArray(config.suppliers)) {
    throw new Error('Konfigurace dodavatelů není platná.');
  }
  const suppliers = Object.fromEntries(Object.entries(config.suppliers).map(([name, value]) => {
    const safeName = name.trim().slice(0, 240);
    if (!safeName || !value || typeof value !== 'object') throw new Error('Neplatná konfigurace dodavatele.');
    const criteria: BidComparisonSupplierCriteria = {
      realizationDate: value.realizationDate ? String(value.realizationDate).slice(0, 10) : null,
      warrantyMonths: value.warrantyMonths == null ? null : Number(value.warrantyMonths),
      maturityDays: value.maturityDays == null ? null : Number(value.maturityDays),
      scopeConfirmed: typeof value.scopeConfirmed === 'boolean' ? value.scopeConfirmed : null,
      supplierRating: value.supplierRating == null ? null : Number(value.supplierRating),
      note: String(value.note || '').trim().slice(0, 1_000),
    };
    if (criteria.realizationDate && !/^\d{4}-\d{2}-\d{2}$/.test(criteria.realizationDate)) throw new Error(`Neplatný termín dodavatele ${safeName}.`);
    if (criteria.warrantyMonths != null && (!Number.isFinite(criteria.warrantyMonths) || criteria.warrantyMonths < 0 || criteria.warrantyMonths > 240)) throw new Error(`Neplatná záruka dodavatele ${safeName}.`);
    if (criteria.maturityDays != null && (!Number.isFinite(criteria.maturityDays) || criteria.maturityDays < 0 || criteria.maturityDays > 365)) throw new Error(`Neplatná splatnost dodavatele ${safeName}.`);
    if (criteria.supplierRating != null && (!Number.isFinite(criteria.supplierRating) || criteria.supplierRating < 1 || criteria.supplierRating > 5)) throw new Error(`Neplatné hodnocení dodavatele ${safeName}.`);
    return [safeName, criteria];
  }));
  return { version: 1, weights: { ...weights }, suppliers };
};

export const evaluateBidComparison = (
  matrix: BidComparisonMatrixItem[],
  configInput: BidComparisonFileConfig,
): BidComparisonEvaluation => {
  const config = validateBidComparisonConfig(configInput);
  const displayOffers = new Map<string, { supplierName: string; displayLabel: string }>();
  matrix.forEach((item) => Object.values(item.offers).forEach((offer) => {
    displayOffers.set(offer.displayLabel, { supplierName: offer.supplierName, displayLabel: offer.displayLabel });
  }));
  const offers = [...displayOffers.values()];
  const criteria = offers.map((offer) => config.suppliers[offer.supplierName] || createEmptySupplierCriteria());
  const commercialEnabled = offers.length > 0 && criteria.every(hasCommercialTerms);
  const historyEnabled = offers.length > 0 && criteria.every((item) => item.supplierRating != null);
  const effectiveWeights = normalizedWeights(config.weights, commercialEnabled, historyEnabled);
  const warnings: string[] = [];
  if (!commercialEnabled && config.weights.commercialTerms > 0) warnings.push('Obchodní podmínky nebyly úplné u všech dodavatelů a byly vynechány.');
  if (!historyEnabled && config.weights.supplierHistory > 0) warnings.push('Hodnocení dodavatele nebylo úplné u všech dodavatelů a bylo vynecháno.');

  const anomalies = detectAnomalies(matrix);
  const totals = new Map<string, number | null>();
  offers.forEach((offer) => {
    let total = 0;
    let count = 0;
    matrix.forEach((item) => {
      const value = item.offers[offer.displayLabel]?.celkem;
      if (value != null && Number.isFinite(value)) { total += value; count += 1; }
    });
    totals.set(offer.displayLabel, count > 0 ? total : null);
  });
  const validTotals = [...totals.values()].filter((value): value is number => value != null && value > 0);
  const lowestTotal = validTotals.length ? Math.min(...validTotals) : null;

  const rawScores = offers.map((offer) => {
    const supplierCriteria = config.suppliers[offer.supplierName] || createEmptySupplierCriteria();
    const totalPrice = totals.get(offer.displayLabel) ?? null;
    const matched = matrix.filter((item) => item.offers[offer.displayLabel]?.matched).length;
    const completeness = matrix.length ? roundScore((matched / matrix.length) * 100) : 0;
    const supplierAnomalies = anomalies.filter((item) => item.displayLabel === offer.displayLabel);
    const priceRisk = roundScore(100 - supplierAnomalies.reduce((sum, item) => sum + Math.min(25, Math.abs(item.deviationPercent) / 4), 0));
    const scores = {
      price: lowestTotal && totalPrice && totalPrice > 0 ? roundScore((lowestTotal / totalPrice) * 100) : 0,
      completeness,
      commercialTerms: commercialEnabled ? commercialScore(supplierCriteria, criteria) : null,
      supplierHistory: historyEnabled ? roundScore(((supplierCriteria.supplierRating as number) / 5) * 100) : null,
      priceRisk,
    };
    const totalScore = roundScore(
      scores.price * effectiveWeights.price / 100 +
      scores.completeness * effectiveWeights.completeness / 100 +
      (scores.commercialTerms || 0) * effectiveWeights.commercialTerms / 100 +
      (scores.supplierHistory || 0) * effectiveWeights.supplierHistory / 100 +
      scores.priceRisk * effectiveWeights.priceRisk / 100,
    );
    const missingCriteria: string[] = [];
    if (!hasCommercialTerms(supplierCriteria)) missingCriteria.push('obchodní podmínky');
    if (supplierCriteria.supplierRating == null) missingCriteria.push('hodnocení dodavatele');
    return { ...offer, rank: 0, totalPrice, totalScore, scores, missingCriteria };
  });
  rawScores.sort((a, b) => b.totalScore - a.totalScore || (a.totalPrice ?? Infinity) - (b.totalPrice ?? Infinity) || a.displayLabel.localeCompare(b.displayLabel, 'cs'));
  rawScores.forEach((score, index) => { score.rank = index + 1; });
  return { algorithmVersion: '1.0.0', requestedWeights: config.weights, effectiveWeights, warnings, scores: rawScores, anomalies };
};
