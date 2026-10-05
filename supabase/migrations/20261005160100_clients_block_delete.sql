-- Clients are never deleted. Discharge/archive keeps the record read-only for
-- the 7-year Medicaid retention window; this trigger makes that a database
-- guarantee instead of a UI convention. It also blocks the legacy
-- delete_client_hard() RPC (its child deletes roll back with the failed
-- client delete); that function is dropped in the Phase B migration.
--
-- There is deliberately no bypass flag: removing a client row (e.g. a test
-- record) requires a superuser to disable this trigger explicitly.

CREATE OR REPLACE FUNCTION public.prevent_client_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Clients cannot be deleted. Archive the client instead; records are kept for 7 years.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_client_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clients_prevent_delete ON public.clients;
CREATE TRIGGER trg_clients_prevent_delete
  BEFORE DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_delete();
