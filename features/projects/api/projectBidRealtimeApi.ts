import { dbAdapter } from "@infra/db/dbAdapter";

interface BidUpdateSubscriptionOptions {
  onBidUpdated: (demandCategoryId: string | null) => void;
  onSubscriptionError?: () => void;
}

export const projectBidRealtimeApi = {
  subscribeToBidUpdates({
    onBidUpdated,
    onSubscriptionError,
  }: BidUpdateSubscriptionOptions): () => void {
    const channel = dbAdapter
      .channel("project-bid-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bids",
        },
        (payload) => {
          const demandCategoryId = payload.new?.demand_category_id;
          onBidUpdated(
            typeof demandCategoryId === "string" ? demandCategoryId : null,
          );
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onSubscriptionError?.();
        }
      });

    return () => {
      void dbAdapter.removeChannel(channel);
    };
  },
};
