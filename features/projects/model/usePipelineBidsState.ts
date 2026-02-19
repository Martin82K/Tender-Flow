import { useEffect, useRef, useState } from "react";
import type { Bid } from "@/types";

interface UsePipelineBidsStateInput {
  initialBids: Record<string, Bid[]>;
  onBidsChange?: (bids: Record<string, Bid[]>) => void;
}

export const usePipelineBidsState = ({
  initialBids,
  onBidsChange,
}: UsePipelineBidsStateInput) => {
  const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);

  const isInternalBidsChange = useRef(false);
  const pendingBidsNotification = useRef<Record<string, Bid[]> | null>(null);

  useEffect(() => {
    if (!isInternalBidsChange.current) {
      setBids(initialBids);
    }
    isInternalBidsChange.current = false;
  }, [initialBids]);

  useEffect(() => {
    if (pendingBidsNotification.current !== null && onBidsChange) {
      onBidsChange(pendingBidsNotification.current);
      pendingBidsNotification.current = null;
    }
  });

  const updateBidsInternal = (
    updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>,
  ) => {
    isInternalBidsChange.current = true;
    setBids((prev) => {
      const newBids = updater(prev);
      pendingBidsNotification.current = newBids;
      return newBids;
    });
  };

  return {
    bids,
    updateBidsInternal,
  };
};
