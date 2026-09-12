-- Restored/imported bid IDs are text and can exceed the former UUID-sized limit.
-- Widen only the reference; keep every value, RLS policy, grant and relation intact.
SET lock_timeout = '5s';
ALTER TABLE public.contracts ALTER COLUMN source_bid_id TYPE text;
RESET lock_timeout;
