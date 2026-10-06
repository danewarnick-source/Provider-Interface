-- clients.intake_status follows the intake checklist. Nothing ever wrote
-- 'complete', so the directory chip could never turn green.
--
-- Same rule as src/lib/intake-progress.ts: required = provider-confirmed
-- hr_client_intake requirements with no `conditional` flag; satisfied =
-- complete or waived. 100% → 'complete'. Dropping below 100% after being
-- complete, or any progress on a 'pending' client → 'in_progress'. Orgs with
-- no checklist items are left untouched.

CREATE OR REPLACE FUNCTION public.sync_client_intake_status(_client uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_cur text;
  v_required int;
  v_satisfied int;
BEGIN
  SELECT organization_id, intake_status INTO v_org, v_cur
    FROM public.clients WHERE id = _client;
  IF v_org IS NULL THEN RETURN; END IF;

  SELECT count(*), count(*) FILTER (WHERE c.status IN ('complete', 'waived'))
    INTO v_required, v_satisfied
    FROM public.nectar_requirements r
    LEFT JOIN public.client_intake_completion c
      ON c.requirement_id = r.id AND c.client_id = _client
   WHERE r.organization_id = v_org
     AND r.metadata->>'scope' = 'hr_client_intake'
     AND r.approval_state = 'provider_confirmed'
     AND COALESCE(r.metadata->>'conditional', '') = '';

  -- No checklist configured for the org: leave whatever status is on file.
  IF v_required = 0 THEN RETURN; END IF;

  IF v_satisfied >= v_required THEN
    UPDATE public.clients SET intake_status = 'complete'
     WHERE id = _client AND intake_status IS DISTINCT FROM 'complete';
  ELSIF v_cur = 'complete' OR (v_satisfied > 0 AND v_cur IS DISTINCT FROM 'in_progress') THEN
    UPDATE public.clients SET intake_status = 'in_progress'
     WHERE id = _client AND intake_status IS DISTINCT FROM 'in_progress';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_client_intake_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sync_client_intake_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_client_intake_status(COALESCE(NEW.client_id, OLD.client_id));
  IF TG_OP = 'UPDATE' AND NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    PERFORM public.sync_client_intake_status(OLD.client_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_sync_client_intake_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_client_intake_completion_sync_status ON public.client_intake_completion;
CREATE TRIGGER trg_client_intake_completion_sync_status
  AFTER INSERT OR UPDATE OF status, client_id, requirement_id OR DELETE
  ON public.client_intake_completion
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_client_intake_status();

SELECT public.sync_client_intake_status(id) FROM public.clients;
