interface StripeOrgPeriodInput {
  stripeStatus: string | null;
  newExpiresAt: Date | null;
  existingExpiresAt: string | null;
  keepExistingExpires?: boolean;
}

/** The stored end is the access deadline, not an unpaid invoice's next period. */
export const stripeOrgPeriodUpdate = (input: StripeOrgPeriodInput) => {
  const expiresAt = input.stripeStatus === 'incomplete'
    ? null
    : input.stripeStatus === 'past_due' || input.keepExistingExpires
    ? input.existingExpiresAt
    : input.newExpiresAt?.toISOString() ?? null;
  return { expires_at: expiresAt, billing_period_end: expiresAt };
};
