-- Security hardening: prevent unauthenticated whitelist enumeration
REVOKE EXECUTE ON FUNCTION public.check_email_whitelist(TEXT) FROM anon;
