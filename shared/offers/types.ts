export interface OfferItem {
  id: string; code: string; description: string; unit: string; quantity: string | null;
  unitPrice: string | null; total: string | null; group: string;
  source: { sheet: string; row: number }; note?: string;
}
export interface OfferAssignment {
  baseId: string; offerId: string | null; status: 'matched' | 'manual' | 'review' | 'unmatched'; candidates?: string[]; reasons?: string[];
}
export interface ComparedRow { baseId: string; offerId: string | null; quotedTotal: string | null; comparableTotal: string | null; priceStatus: 'priced' | 'missing-price' | 'unmatched' | 'different-scope' }
export interface OfferComparison { rows: ComparedRow[]; total: string; pricedCount: number; complete: boolean; extraIds: string[] }
