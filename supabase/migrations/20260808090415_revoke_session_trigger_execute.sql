-- Trigger funkce je interní a nesmí být přímo spustitelná přes API role.
-- REVOKE nemění auth.sessions, platnost tokenů ani samotný trigger.
REVOKE ALL ON FUNCTION public.handle_new_session() FROM PUBLIC, anon, authenticated, service_role;
