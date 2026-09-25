-- Access levels — Phase A, step 1: schema, presets, backfill, sync triggers.
-- Additive and compatible with code that still reads/writes organization_members.role:
-- a trigger keeps role <-> access_level in step until Phase B drops role.

-- ---------------------------------------------------------------- types
CREATE TYPE public.access_level AS ENUM ('owner', 'admin', 'staff');
COMMENT ON TYPE public.access_level IS
  'Access: the 3 fixed levels. owner = everything incl. agency settings; admin = web dashboard, per-category Off/View/Edit; staff = phone app, own work.';

-- ---------------------------------------------------------------- access_presets (only new table)
CREATE TABLE public.access_presets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  access_level    public.access_level NOT NULL CHECK (access_level <> 'owner'),
  access_scope    text NOT NULL CHECK (access_scope IN ('agency', 'assigned', 'self')),
  home_page       text,
  categories      jsonb NOT NULL DEFAULT '{}'::jsonb,
  seed_key        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  UNIQUE (organization_id, seed_key)
);
COMMENT ON TABLE public.access_presets IS
  'Access: agency-named bundles of level + scope + category settings (e.g. "Group Home Manager"). Picked when hiring; per-person tweaks live in organization_members.access_overrides.';
COMMENT ON COLUMN public.access_presets.access_scope IS 'agency = whole agency; assigned = only people/clients/homes in access_assignments; self = own work only.';
COMMENT ON COLUMN public.access_presets.home_page IS 'Landing route after login (null = level default).';
COMMENT ON COLUMN public.access_presets.categories IS 'Category key -> ''view'' | ''edit''. Missing key = off. Keys defined in src/lib/access/categories.ts.';
COMMENT ON COLUMN public.access_presets.seed_key IS 'Built-in preset this row was seeded from (null = created by the agency). Lets renamed defaults still be found.';

CREATE TRIGGER trg_access_presets_updated_at BEFORE UPDATE ON public.access_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.access_presets ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- organization_members columns
ALTER TABLE public.organization_members RENAME COLUMN custom_role_id TO access_preset_id;
ALTER TABLE public.organization_members
  ADD COLUMN access_level     public.access_level,
  ADD COLUMN access_scope     text CHECK (access_scope IN ('agency', 'assigned', 'self')),
  ADD COLUMN access_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT organization_members_access_preset_id_fkey
    FOREIGN KEY (access_preset_id) REFERENCES public.access_presets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organization_members.access_level IS 'Access: owner | admin | staff. Source of truth for what this person can do.';
COMMENT ON COLUMN public.organization_members.access_scope IS 'Access: agency | assigned | self. Owners are always agency.';
COMMENT ON COLUMN public.organization_members.access_preset_id IS 'Access: preset this person was given (access_presets). Null for owners.';
COMMENT ON COLUMN public.organization_members.access_overrides IS 'Access: per-person category tweaks on top of the preset (category key -> off|view|edit).';
COMMENT ON COLUMN public.organization_members.role IS 'LEGACY: kept in sync from access_level by trg_access_sync_legacy_role. Dropped in Phase B.';

-- ---------------------------------------------------------------- invitations columns
ALTER TABLE public.invitations
  ADD COLUMN access_level     public.access_level,
  ADD COLUMN access_preset_id uuid REFERENCES public.access_presets(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.invitations.access_level IS 'Access: level the invitee gets on accept.';
COMMENT ON COLUMN public.invitations.access_preset_id IS 'Access: preset the invitee gets on accept.';
COMMENT ON COLUMN public.invitations.role IS 'LEGACY: used only when access_level is null. Dropped in Phase B.';

-- ---------------------------------------------------------------- access_assignments (was scope_assignments)
ALTER TABLE public.scope_assignments RENAME TO access_assignments;
ALTER TABLE public.access_assignments RENAME COLUMN scope_type TO kind;
ALTER TABLE public.access_assignments RENAME COLUMN scope_ref_id TO target_id;
ALTER TABLE public.access_assignments DROP CONSTRAINT scope_assignments_scope_type_check;
ALTER TABLE public.access_assignments ALTER COLUMN target_id TYPE uuid USING target_id::uuid;
ALTER TABLE public.access_assignments ALTER COLUMN target_id SET NOT NULL;
ALTER TABLE public.access_assignments ALTER COLUMN kind SET NOT NULL;
ALTER TABLE public.access_assignments ADD CONSTRAINT access_assignments_kind_check CHECK (kind IN ('home', 'staff', 'client'));
ALTER TABLE public.access_assignments ADD CONSTRAINT access_assignments_unique UNIQUE (organization_id, user_id, kind, target_id);
ALTER INDEX IF EXISTS scope_assignments_pkey RENAME TO access_assignments_pkey;
ALTER TRIGGER trg_scope_updated_at ON public.access_assignments RENAME TO trg_access_assignments_updated_at;
CREATE INDEX access_assignments_target_idx ON public.access_assignments (organization_id, kind, target_id);

COMMENT ON TABLE public.access_assignments IS
  'Access: who an "assigned"-scope person covers. Many-to-many: a home, staffer or client can have several managers; each sees the full record within their own preset.';
COMMENT ON COLUMN public.access_assignments.user_id IS 'The manager/lead whose view is being scoped.';
COMMENT ON COLUMN public.access_assignments.kind IS 'home (teams.id) | staff (auth user id) | client (clients.id).';
COMMENT ON COLUMN public.access_assignments.target_id IS 'Id of the home, staffer or client, per kind.';

DROP POLICY IF EXISTS "admins manage scopes" ON public.access_assignments;
DROP POLICY IF EXISTS "members read scopes" ON public.access_assignments;

-- Read-only view for code on main until merge. Dropped in Phase B.
CREATE VIEW public.scope_assignments WITH (security_invoker = on) AS
  SELECT id, organization_id, user_id, kind AS scope_type, target_id::text AS scope_ref_id, created_at, updated_at
  FROM public.access_assignments;
COMMENT ON VIEW public.scope_assignments IS 'LEGACY compat view over access_assignments. Dropped in Phase B.';
GRANT SELECT ON public.scope_assignments TO authenticated;

-- ---------------------------------------------------------------- access_change_log (was permission_audit_log)
ALTER TABLE public.permission_audit_log RENAME TO access_change_log;
ALTER INDEX IF EXISTS permission_audit_log_pkey RENAME TO access_change_log_pkey;
ALTER TABLE public.access_change_log ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.access_change_log ALTER COLUMN permission DROP NOT NULL;
COMMENT ON TABLE public.access_change_log IS
  'Access: audit trail of every access change (level, preset, scope, assignments, category tweaks, deactivations). Replaces permission_audit_log + role_change_audit_log.';
COMMENT ON COLUMN public.access_change_log.change_type IS 'level | preset | scope | assignments | overrides | preset_edit | deactivated | role_change (legacy rows).';
COMMENT ON COLUMN public.access_change_log.details IS 'Before/after values for the change.';
COMMENT ON COLUMN public.access_change_log.role IS 'LEGACY: old role name on pre-access rows.';
COMMENT ON COLUMN public.access_change_log.permission IS 'LEGACY: old permission key on pre-access rows.';

INSERT INTO public.access_change_log
  (id, organization_id, changed_by_user_id, changed_by_name, change_type, target_user_id, target_user_name, details, created_at)
SELECT id, organization_id, changed_by_user_id, changed_by_name, 'role_change', target_user_id, target_user_name,
       jsonb_build_object('previous_role', previous_role, 'new_role', new_role, 'change_method', change_method), created_at
FROM public.role_change_audit_log
ON CONFLICT (id) DO NOTHING;

CREATE VIEW public.permission_audit_log WITH (security_invoker = on) AS
  SELECT id, organization_id, changed_by_user_id, changed_by_name, change_type, target_user_id,
         target_user_name, role, permission, previous_value, new_value, reason, created_at
  FROM public.access_change_log;
COMMENT ON VIEW public.permission_audit_log IS 'LEGACY compat view over access_change_log. Dropped in Phase B.';
GRANT SELECT, INSERT ON public.permission_audit_log TO authenticated, service_role;

-- ---------------------------------------------------------------- default presets
CREATE OR REPLACE FUNCTION public.access_seed_presets(_org uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.access_presets (organization_id, seed_key, name, access_level, access_scope, home_page, categories)
  SELECT _org, d.seed_key, d.name, d.lvl::public.access_level, d.scope, d.home, d.cats::jsonb
  FROM (VALUES
    ('program_manager', 'Program Manager', 'admin', 'agency', '/dashboard',
     '{"staff_roster":"edit","staff_hiring":"edit","staff_compliance":"edit","clients":"edit","client_medical":"view","documentation":"edit","incidents":"edit","hrc":"edit","scheduling":"edit","timesheets":"edit","billing":"view","payroll":"view","reports":"view","hosts":"view","phone_app":"edit"}'),
    ('home_manager', 'Group Home Manager', 'admin', 'assigned', '/dashboard',
     '{"staff_roster":"view","staff_compliance":"view","clients":"edit","client_medical":"view","documentation":"edit","incidents":"edit","hrc":"view","scheduling":"edit","timesheets":"edit","billing":"view","reports":"view","phone_app":"edit"}'),
    ('hr_office', 'HR / Office', 'admin', 'agency', '/dashboard',
     '{"staff_roster":"edit","staff_hiring":"edit","staff_compliance":"edit","incidents":"view","scheduling":"view","timesheets":"view","payroll":"edit","reports":"view","hosts":"view","loans":"edit"}'),
    ('billing', 'Billing', 'admin', 'agency', '/dashboard',
     '{"staff_roster":"view","clients":"view","documentation":"view","scheduling":"view","timesheets":"view","billing":"edit","payroll":"view","financial_reports":"view","reports":"view","loans":"view"}'),
    ('dsp', 'DSP', 'staff', 'self', '/employee',
     '{"phone_app":"edit"}'),
    ('lead_dsp', 'Lead DSP', 'staff', 'assigned', '/employee',
     '{"staff_roster":"view","clients":"view","client_medical":"view","documentation":"edit","incidents":"view","scheduling":"view","timesheets":"view","phone_app":"edit"}'),
    ('hrc_committee', 'HRC Committee', 'staff', 'assigned', '/dashboard/hrc',
     '{"clients":"view","client_medical":"view","incidents":"view","hrc":"edit"}')
  ) AS d(seed_key, name, lvl, scope, home, cats)
  ON CONFLICT DO NOTHING;
$$;
COMMENT ON FUNCTION public.access_seed_presets(uuid) IS 'Access: inserts the 7 built-in presets for an org (idempotent).';

CREATE OR REPLACE FUNCTION public.access_trg_seed_presets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.access_seed_presets(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_access_seed_presets AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.access_trg_seed_presets();

SELECT public.access_seed_presets(id) FROM public.organizations;

-- ---------------------------------------------------------------- legacy role <-> access sync
CREATE OR REPLACE FUNCTION public.access_sync_legacy_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from_role boolean;
  v_seed text;
BEGIN
  v_from_role := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.access_level IS NULL
    ELSE NEW.role IS DISTINCT FROM OLD.role
         AND NEW.access_level IS NOT DISTINCT FROM OLD.access_level
         AND NEW.access_scope IS NOT DISTINCT FROM OLD.access_scope
         AND NEW.access_preset_id IS NOT DISTINCT FROM OLD.access_preset_id
  END;

  IF v_from_role THEN
    NEW.access_level := CASE NEW.role::text
      WHEN 'admin' THEN 'owner' WHEN 'super_admin' THEN 'owner'
      WHEN 'program_manager' THEN 'admin' WHEN 'manager' THEN 'admin'
      ELSE 'staff' END::public.access_level;
    NEW.access_scope := CASE NEW.role::text
      WHEN 'manager' THEN 'assigned' WHEN 'committee_member' THEN 'assigned'
      WHEN 'employee' THEN 'self' ELSE 'agency' END;
    NEW.access_preset_id := (
      SELECT id FROM public.access_presets
      WHERE organization_id = NEW.organization_id
        AND seed_key = CASE NEW.role::text
          WHEN 'program_manager' THEN 'program_manager' WHEN 'manager' THEN 'home_manager'
          WHEN 'employee' THEN 'dsp' WHEN 'committee_member' THEN 'hrc_committee' END);
  ELSE
    IF NEW.access_level = 'owner' THEN
      NEW.access_scope := 'agency';
      NEW.access_preset_id := NULL;
    ELSIF NEW.access_scope IS NULL THEN
      NEW.access_scope := COALESCE(
        (SELECT access_scope FROM public.access_presets WHERE id = NEW.access_preset_id),
        CASE NEW.access_level WHEN 'staff' THEN 'self' ELSE 'agency' END);
    END IF;
    SELECT seed_key INTO v_seed FROM public.access_presets WHERE id = NEW.access_preset_id;
    NEW.role := CASE NEW.access_level
      WHEN 'owner' THEN 'admin'
      WHEN 'admin' THEN CASE WHEN NEW.access_scope = 'agency' THEN 'program_manager' ELSE 'manager' END
      ELSE CASE WHEN v_seed = 'hrc_committee' THEN 'committee_member' ELSE 'employee' END
    END::public.app_role;
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.access_sync_legacy_role() IS 'Access (transition only): keeps legacy role and access_level consistent whichever one a writer sets. Dropped in Phase B.';

CREATE TRIGGER trg_access_sync_legacy_role
  BEFORE INSERT OR UPDATE OF role, access_level, access_scope, access_preset_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.access_sync_legacy_role();

-- Backfill from role. The trigger re-derives role from the new level, which maps back to the same value.
UPDATE public.organization_members m SET
  access_level = CASE m.role::text
    WHEN 'admin' THEN 'owner' WHEN 'super_admin' THEN 'owner'
    WHEN 'program_manager' THEN 'admin' WHEN 'manager' THEN 'admin' ELSE 'staff' END::public.access_level,
  access_scope = CASE m.role::text
    WHEN 'manager' THEN 'assigned' WHEN 'committee_member' THEN 'assigned'
    WHEN 'employee' THEN 'self' ELSE 'agency' END,
  access_preset_id = (
    SELECT p.id FROM public.access_presets p
    WHERE p.organization_id = m.organization_id
      AND p.seed_key = CASE m.role::text
        WHEN 'program_manager' THEN 'program_manager' WHEN 'manager' THEN 'home_manager'
        WHEN 'employee' THEN 'dsp' WHEN 'committee_member' THEN 'hrc_committee' END);

-- ---------------------------------------------------------------- at least one owner
CREATE OR REPLACE FUNCTION public.access_keep_one_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.access_level = 'owner' AND OLD.active
     AND (TG_OP = 'DELETE' OR NOT (NEW.active AND NEW.access_level = 'owner'))
     AND EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.organization_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE organization_id = OLD.organization_id AND id <> OLD.id
         AND active AND access_level = 'owner')
  THEN
    RAISE EXCEPTION 'An agency must keep at least one active Owner.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
COMMENT ON FUNCTION public.access_keep_one_owner() IS 'Access: blocks demoting, deactivating or removing the last active Owner of an agency.';
CREATE TRIGGER trg_access_keep_one_owner
  AFTER UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.access_keep_one_owner();

-- ---------------------------------------------------------------- homes: teams.manager_id -> assignments
INSERT INTO public.access_assignments (organization_id, user_id, kind, target_id)
SELECT t.organization_id, t.manager_id, 'home', t.id
FROM public.teams t
JOIN public.organization_members m ON m.organization_id = t.organization_id AND m.user_id = t.manager_id
WHERE t.manager_id IS NOT NULL AND t.organization_id IS NOT NULL
ON CONFLICT DO NOTHING;
