import React from "react";
import { formatTrialRemainingCopy, getCalendarDaysRemaining } from "../model/trial";

interface TrialBannerProps {
  currentPlan: string;
  isLoading: boolean;
  planStatus: string | null;
  planExpiresAt: string | null;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  currentPlan,
  isLoading,
  planStatus,
  planExpiresAt,
}) => {
  if (isLoading || planStatus !== "trial" || !planExpiresAt) return null;
  if (!["starter", "pro", "enterprise"].includes(currentPlan)) return null;

  const days = getCalendarDaysRemaining(planExpiresAt);
  if (days === null || days < 0) return null;

  return (
    <div
      role="status"
      className="mx-3 mt-3 mb-1 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <strong className="font-semibold">{formatTrialRemainingCopy(days)}</strong>
      <span className="mt-1 block text-amber-900/80 dark:text-amber-100/80">
        Po skončení se přístup pozastaví, dokud nepřiřadíme Enterprise licenci.
      </span>
    </div>
  );
};
