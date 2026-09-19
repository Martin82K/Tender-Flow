export const TRIAL_DURATION_DAYS = 14;

export const getCalendarDaysRemaining = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return null;
  const now = Date.now();
  if (end <= now) return Math.min(-1, Math.ceil((end - now) / 86_400_000));
  return Math.ceil((end - now) / 86_400_000);
};

const czechDayWord = (days: number): "den" | "dny" | "dní" => {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return "den";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "dny";
  return "dní";
};

export const formatTrialRemainingCopy = (days: number): string => {
  if (days < 0) return "Zkušební období skončilo";
  if (days === 0) return "Zkušební období končí dnes";
  const word = czechDayWord(days);
  const verb = word === "dny" ? "zbývají" : "zbývá";
  return `Zkušební období: ${verb} ${days} ${word}`;
};

export const isLiveOverride = (
  overrideTier: string | null | undefined,
  overrideExpiresAt: string | null | undefined,
): boolean => {
  if (!overrideTier) return false;
  if (!overrideExpiresAt) return true;
  const end = Date.parse(overrideExpiresAt);
  return Number.isFinite(end) && end > Date.now();
};

export interface OrgPlanPresentation {
  effectiveTier: string | null | undefined;
  isOverridden: boolean;
  isTrial: boolean;
  status: string;
  activeUntil: string | null;
}

export const getOrgPlanPresentation = (input: {
  status: string;
  tier: string | null | undefined;
  overrideTier: string | null | undefined;
  overrideExpiresAt: string | null | undefined;
  billingCustomerId?: string | null;
  billingPeriodEnd: string | null | undefined;
  expiresAt: string | null | undefined;
}): OrgPlanPresentation => {
  const liveOverride = isLiveOverride(input.overrideTier, input.overrideExpiresAt);
  return {
    effectiveTier: liveOverride ? input.overrideTier : input.tier,
    isOverridden: liveOverride,
    isTrial: input.status === "trial" && !liveOverride,
    status: liveOverride ? "active" : input.status,
    activeUntil: liveOverride
      ? input.overrideExpiresAt ?? null
      : input.billingCustomerId?.startsWith("cus_")
        ? input.expiresAt ?? null
        : input.billingPeriodEnd || input.expiresAt || null,
  };
};
