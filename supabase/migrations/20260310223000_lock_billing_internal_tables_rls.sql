-- Lock internal billing tables behind RLS and service_role-only access.

BEGIN;

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_webhook_events_service_role_all" ON public.billing_webhook_events;
CREATE POLICY "billing_webhook_events_service_role_all"
  ON public.billing_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "billing_subscription_requests_service_role_all" ON public.billing_subscription_requests;
CREATE POLICY "billing_subscription_requests_service_role_all"
  ON public.billing_subscription_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.billing_subscription_requests FROM anon, authenticated;

GRANT ALL ON public.billing_webhook_events TO service_role;
GRANT ALL ON public.billing_subscription_requests TO service_role;

COMMIT;
