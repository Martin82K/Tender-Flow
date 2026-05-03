-- Migration: Stripe audit log change types (+ gopay backfill)
-- Purpose: Rozšířit subscription_audit_log.change_type CHECK constraint o:
--          1) stripe-* hodnoty potřebné pro Stripe edge funkce (cancel, sync, org webhook, org cancel)
--          2) gopay-* a manual_sync hodnoty, které GoPay edge funkce v repu už používají,
--             ale nikdy nebyly přidány do constraintu (separátní bug nalezený při auditu).
-- Date: 2026-04-27
--
-- Kontext:
--   Migrace 20260124140000 zavedla základní constraint, 20260124143000 ho rozšířila
--   o 'upgrade'/'downgrade'. Mezitím přibyly GoPay edge funkce, které zapisují hodnoty
--   mimo constraint (`gopay_webhook`, `gopay_cancel_recurrence`, `gopay_org_webhook`,
--   `gopay_org_cancel_recurrence`, `manual_sync`) — bez tohoto fixu by INSERT do
--   subscription_audit_log z webhooku padal. Stripe integrace (docs/stripe-integration-plan.md)
--   přidává paralelní set stripe-* hodnot. Sjednocujeme constraint v jedné migraci,
--   aby existující GoPay logování fungovalo a nová Stripe logika měla bezpečné hodnoty.

-- ============================================================================
-- Drop & re-create CHECK constraint with unified value set
-- ============================================================================

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
        -- GoPay (user-level)
        'gopay_webhook',
        'gopay_cancel_recurrence',
        -- GoPay (org-level)
        'gopay_org_webhook',
        'gopay_org_cancel_recurrence',
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
    'Validní typy změny předplatného. Sjednoceno v migraci 20260427120000: doplněny gopay_* hodnoty (které byly v kódu, ale ne v constraintu) a stripe-* hodnoty pro paralelní Stripe integraci.';
