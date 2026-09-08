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
    const handleChange = (payload: { new: Record<string, unknown> }) => {
      const demandCategoryId = payload.new.demand_category_id;
      onBidUpdated(typeof demandCategoryId === "string" ? demandCategoryId : null);
    };
    // DELETE is not filtered by SELECT RLS in Postgres Changes. Keep deletion
    // refresh on local invalidation/polling, without subscribing across tenants.
    const channel = dbAdapter
      .channel("project-bid-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, handleChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bids" }, handleChange)
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
