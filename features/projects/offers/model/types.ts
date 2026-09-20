import type { OfferAssignment, OfferItem } from '@shared/offers/comparison.js';
export interface ComparisonSource {
    id: string;
    name: string;
    sha256: string;
    items: OfferItem[];
    notes: string[];
    origin: 'file' | 'budget' | 'mcp';
    revisionId?: string;
    revisionVersion?: number;
}
export interface ComparisonDocument {
    schemaVersion: 1;
    sources: ComparisonSource[];
    assignments: Record<string, OfferAssignment[]>;
}
export interface SavedComparison {
    id: string;
    project_id: string;
    category_id: string | null;
    title: string;
    version: number;
    request_id: string;
    document: ComparisonDocument;
    updated_at: string;
}
