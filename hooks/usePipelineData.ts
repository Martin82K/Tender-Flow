/**
 * usePipelineData Hook
 * Manages pipeline data state: bids, contacts, and synchronization with props.
 * Extracted from Pipeline.tsx for better modularity.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bid, Subcontractor } from '../types';

interface UsePipelineDataProps {
    initialBids: Record<string, Bid[]>;
    externalContacts: Subcontractor[];
    onBidsChange?: (bids: Record<string, Bid[]>) => void;
}

export const usePipelineData = ({
    initialBids,
    externalContacts,
    onBidsChange,
}: UsePipelineDataProps) => {
    const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);
    const [localContacts, setLocalContacts] = useState<Subcontractor[]>(externalContacts);

    // Track whether the bids change is internal (user action) vs from props
    const isInternalBidsChange = useRef(false);
    // Store pending bids to notify parent after render
    const pendingBidsNotification = useRef<Record<string, Bid[]> | null>(null);

    // Sync contacts from props
    useEffect(() => {
        setLocalContacts(externalContacts);
    }, [externalContacts]);

    // Sync bids from props (only if external change)
    useEffect(() => {
        if (!isInternalBidsChange.current) {
            setBids(initialBids);
        }
        isInternalBidsChange.current = false;
    }, [initialBids]);

    // Notify parent after render when we have pending changes
    useEffect(() => {
        if (pendingBidsNotification.current !== null && onBidsChange) {
            onBidsChange(pendingBidsNotification.current);
            pendingBidsNotification.current = null;
        }
    });

    // Helper to update bids and mark as internal change
    const updateBidsInternal = useCallback((updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>) => {
        isInternalBidsChange.current = true;
        setBids(prev => {
            const newBids = updater(prev);
            pendingBidsNotification.current = newBids;
            return newBids;
        });
    }, []);

    // Get bids for a specific column/status
    const getBidsForColumn = useCallback((categoryId: string, status: string) => {
        return (bids[categoryId] || []).filter((bid) => bid.status === status);
    }, [bids]);

    return {
        bids,
        localContacts,
        setLocalContacts,
        updateBidsInternal,
        getBidsForColumn,
    };
};
