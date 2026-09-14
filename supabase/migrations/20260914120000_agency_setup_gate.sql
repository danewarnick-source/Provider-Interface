-- Agency setup gate: server-authoritative completion from saved required facts.
-- Blocks staff/client INSERT until operating questions are recorded.
-- Idempotent. No DROP TABLE / DROP COLUMN. No catalog publish/activation.
-- Soft Core pastes this in Lovable (clear the editor first). See docs/SQL_HANDOFF.md.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fact_operates_ol_site boolean;
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fact_uses_volunteers boolean;
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fact_has_governing_board boolean;
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fact_answers_updated_at timestamptz;
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fact_answers_updated_by uuid;

CREATE OR REPLACE FUNCTION public.org_setup_is_complete(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      COALESCE(cardinality(ARRAY(
        SELECT trim(c)
        FROM unnest(COALESCE(o.services_offered, ARRAY[]::text[])) AS c
        WHERE length(trim(c)) > 0
      )), 0) > 0
      AND o.fact_operates_ol_site IS NOT NULL
      AND o.fact_uses_volunteers IS NOT NULL
      AND o.fact_has_governing_board IS NOT NULL
      AND o.approx_client_count IS NOT NULL
      AND o.specializations IS NOT NULL
      AND o.specializations ~* 'Service area:\s*\S+'
    FROM public.organizations o
    WHERE o.id = p_org_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.org_setup_is_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_setup_is_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_setup_is_complete(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_org_setup_before_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'organization_members' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = NEW.organization_id
        AND om.id IS DISTINCT FROM NEW.id
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT public.org_setup_is_complete(NEW.organization_id) THEN
    RAISE EXCEPTION 'Agency setup is incomplete. Answer the required operating questions before creating staff or clients.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_require_org_setup ON public.clients;
CREATE TRIGGER trg_clients_require_org_setup
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_org_setup_before_create();

DROP TRIGGER IF EXISTS trg_org_members_require_org_setup ON public.organization_members;
CREATE TRIGGER trg_org_members_require_org_setup
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_org_setup_before_create();

DROP TRIGGER IF EXISTS trg_invitations_require_org_setup ON public.invitations;
CREATE TRIGGER trg_invitations_require_org_setup
  BEFORE INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_org_setup_before_create();

DROP POLICY IF EXISTS clients_insert_requires_setup ON public.clients;
CREATE POLICY clients_insert_requires_setup
  ON public.clients
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.org_setup_is_complete(organization_id));

DROP POLICY IF EXISTS org_members_insert_requires_setup ON public.organization_members;
CREATE POLICY org_members_insert_requires_setup
  ON public.organization_members
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.org_setup_is_complete(organization_id)
    OR NOT EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS invitations_insert_requires_setup ON public.invitations;
CREATE POLICY invitations_insert_requires_setup
  ON public.invitations
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.org_setup_is_complete(organization_id));
