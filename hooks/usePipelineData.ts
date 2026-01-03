import { useState, useEffect, useRef } from 'react';
import { Bid, DemandCategory, ProjectDetails } from '../types';

interface UsePipelineDataProps {
    initialBids: Record<string, Bid[]>;
    onBidsChange?: (bids: Record<string, Bid[]>) => void;
    projectDetails: ProjectDetails;
}

export const usePipelineData = ({ initialBids, onBidsChange }: UsePipelineDataProps) => {
    const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);
    const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(null);

    // Track whether the bids change is internal (user action) vs from props
    const isInternalBidsChange = useRef(false);
    // Store pending bids to notify parent after render
    const pendingBidsNotification = useRef<Record<string, Bid[]> | null>(null);

    // Sync with props
    useEffect(() => {
        // Only update from props if not an internal change
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
    const updateBidsInternal = (updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>) => {
        isInternalBidsChange.current = true;
        setBids(prev => {
            const newBids = updater(prev);
            // Store for notification after render (not during render)
            pendingBidsNotification.current = newBids;
            return newBids;
        });
    };

    return {
        bids,
        activeCategory,
        setActiveCategory,
        updateBidsInternal,
        setBids
    };
};
