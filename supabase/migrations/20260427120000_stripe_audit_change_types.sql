-- Migration: Stripe audit log change types
-- Purpose: Rozšířit subscription_audit_log.change_type CHECK constraint o
-- hodnoty potřebné pro Stripe edge funkce.
-- Date: 2026-04-27

ALTER TABLE public.subscription_audit_log
    DROP CONSTRAINT IF EXISTS subscription_audit_log_change_type_check;

ALTER TABLE public.subscription_audit_log
    ADD CONSTRAINT subscription_audit_log_change_type_check
    CHECK (change_type IN (
        -- legacy / manuální / lifecycle
        'manual_override',
        'manual_sync',
        'trial_start',
        'trial_end',
        'expiration',
        'reactivation',
        'organization_change',
        'upgrade',
        'downgrade',
        -- Stripe (user-level)
        'stripe_webhook',
        'stripe_cancel_recurrence',
        'stripe_sync',
        -- Stripe (org-level)
        'stripe_org_webhook',
        'stripe_org_cancel_recurrence'
    ));

COMMENT ON CONSTRAINT subscription_audit_log_change_type_check
    ON public.subscription_audit_log IS
    'Validní typy změny předplatného pro Stripe billing.';
