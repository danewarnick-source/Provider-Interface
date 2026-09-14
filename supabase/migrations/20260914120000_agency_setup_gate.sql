-- Agency setup gate: server-authoritative completion from saved required facts.
-- Blocks staff/client/invite INSERT until operating questions are recorded,
-- except a one-time grandfather snapshot for orgs that already have people.
--
-- KEEP grandfather: True North Supports LLC is a real first operating tenant
-- (not synthetic-only). See docs/SQL_HANDOFF.md — Tony/Core must probe live
-- inventory before paste. Fail-closed exempt lock: only service_role /
-- postgres / supabase_admin may change setup_create_gate_exempt.
--
-- Idempotent. No DROP TABLE / DROP COLUMN. No catalog publish/activation.
-- INSERT-only RESTRICTIVE policies — SELECT/UPDATE on members, clients, and
-- profiles are not touched. Existing staff/clients stay readable/editable.
--
-- Soft Core pastes this in Lovable (clear the editor first). See docs/SQL_HANDOFF.md.
-- Do NOT apply to Hive-Platform production from CI.

-- Dedicated service-area column. Do not encode service area in specializations.
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
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS service_area text;
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS setup_create_gate_exempt boolean;

-- Choice (b), snapshot not live predicate:
-- Exempt only orgs that already have ≥1 client OR members > 1.
-- A workspace with only the initial owner (1 member, 0 clients) is gated
-- and must complete the six questions. TNS (6 members / 4 clients) qualifies.
-- NULL = not yet decided. Re-applying only fills remaining NULLs.
UPDATE public.organizations o
SET setup_create_gate_exempt = (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.organization_id = o.id
  )
  OR (
    SELECT count(*)
    FROM public.organization_members om
    WHERE om.organization_id = o.id
  ) > 1
)
WHERE o.setup_create_gate_exempt IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN setup_create_gate_exempt SET DEFAULT false;

-- Canonical completion (must match src/lib/agency-setup-completion.ts):
-- 1. services_offered has ≥1 trimmed nonempty code
-- 2. fact_operates_ol_site IS NOT NULL
-- 3. fact_uses_volunteers IS NOT NULL
-- 4. fact_has_governing_board IS NOT NULL
-- 5. approx_client_count IS NOT NULL
-- 6. service_area IS NOT NULL AND length(trim(service_area)) > 0
-- Never read specializations.
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
      AND o.service_area IS NOT NULL
      AND length(trim(o.service_area)) > 0
    FROM public.organizations o
    WHERE o.id = p_org_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.org_setup_allows_create(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      public.org_setup_is_complete(p_org_id)
      OR COALESCE(o.setup_create_gate_exempt, false)
    FROM public.organizations o
    WHERE o.id = p_org_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.org_setup_is_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_setup_is_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_setup_is_complete(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.org_setup_allows_create(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_setup_allows_create(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_setup_allows_create(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_org_setup_before_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First organization_members row for THIS org (NEW.organization_id) is
  -- workspace bootstrap. Correlate existing members to the inserted org —
  -- never a bare EXISTS that could match another org.
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

  IF public.org_setup_allows_create(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Agency setup is incomplete. Answer the required operating questions before creating staff or clients.'
    USING ERRCODE = '42501';
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

-- INSERT only. Do not add SELECT/UPDATE restrictions on members/clients/profiles.
DROP POLICY IF EXISTS clients_insert_requires_setup ON public.clients;
CREATE POLICY clients_insert_requires_setup
  ON public.clients
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.org_setup_allows_create(clients.organization_id));

DROP POLICY IF EXISTS org_members_insert_requires_setup ON public.organization_members;
CREATE POLICY org_members_insert_requires_setup
  ON public.organization_members
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.org_setup_allows_create(organization_members.organization_id)
    OR NOT EXISTS (
      SELECT 1
      FROM public.organization_members existing_member
      WHERE existing_member.organization_id = organization_members.organization_id
        AND existing_member.id IS DISTINCT FROM organization_members.id
    )
  );

DROP POLICY IF EXISTS invitations_insert_requires_setup ON public.invitations;
CREATE POLICY invitations_insert_requires_setup
  ON public.invitations
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.org_setup_allows_create(invitations.organization_id));

-- Lock the grandfather flag. App omitting the field is not enough:
-- authenticated org admins have table-level UPDATE on organizations.
-- Column REVOKE is defense-in-depth; the trigger is authoritative because
-- table-level UPDATE still includes this column.
REVOKE UPDATE (setup_create_gate_exempt) ON public.organizations FROM authenticated;
GRANT SELECT (setup_create_gate_exempt) ON public.organizations TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_setup_create_gate_exempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.setup_create_gate_exempt IS NOT DISTINCT FROM OLD.setup_create_gate_exempt THEN
    RETURN NEW;
  END IF;
  -- Fail-closed: only these roles may change the snapshot. anon / authenticated /
  -- unknown roles ERROR. No fall-through RETURN NEW.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'setup_create_gate_exempt is locked. Only service_role, postgres, or supabase_admin may change the grandfather flag.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_setup_create_gate_exempt ON public.organizations;
CREATE TRIGGER trg_protect_setup_create_gate_exempt
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_setup_create_gate_exempt();

-- EXECUTE is public so any role that can UPDATE the row still reaches the
-- fail-closed EXCEPTION instead of a missing-execute miss.
REVOKE ALL ON FUNCTION public.protect_setup_create_gate_exempt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_setup_create_gate_exempt() TO PUBLIC;
