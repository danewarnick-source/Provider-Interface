-- Lane B item 5 (Dane-approved via Tony 2026-09-27; PR #399 live = deploy gate met).
-- Source: docs/SQL_HANDOFF_signup_after_confirm.sql on main of danewarnick-source/Provider-Interface (fetched via cursor-github).
--   Applied ONLY the CREATE OR REPLACE FUNCTION block, verbatim. The optional cleanup SELECT was NOT run.
--   The 3 existing workspaces from unconfirmed signups were NOT touched (Dane keeping them).
-- Purpose: the on_auth_user_created trigger (AFTER INSERT ON auth.users, i.e. at signUp, before email confirmation)
--   now only creates the profile row (full_name split into first_name / last_name at the first space, agency_name from
--   metadata). No organization / organization_members row; the app's ensureSignupWorkspace creates the workspace after
--   a confirmed session exists.
-- Prechecks: new function keeps SECURITY DEFINER and SET search_path TO 'public'; all inserted columns
--   (id, email, full_name, agency_name, first_name, last_name) exist on public.profiles. ACL unchanged
--   {postgres=X, authenticated=X, service_role=X} (CREATE OR REPLACE preserves it).
-- Verify: live def has 1 INSERT (profiles), no reference to organizations / organization_members; trigger
--   on_auth_user_created still enabled (O) and calls handle_new_user(). Rolled-back test with 2 fake auth.users rows:
--   full_name 'Sectest Firstname Lastpart' -> first 'Sectest', last 'Firstname Lastpart', agency set; 'Mononym' -> first
--   'Mononym', last NULL; 0 new organizations, 0 new memberships. Unconfirmed-user workspaces: 3 before, 3 after.
--   Totals unchanged after commit: orgs 26, members 34, profiles 29.
-- ROLLBACK (prior live definition, captured with pg_get_functiondef before apply):
/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, agency_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'agency_name'
  )
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  org_name := COALESCE(
    NEW.raw_user_meta_data->>'agency_name',
    split_part(NEW.email, '@', 1) || '''s workspace'
  );
  org_slug := lower(regexp_replace(org_name || '-' || substr(NEW.id::text, 1, 6), '[^a-z0-9]+', '-', 'g'));

  BEGIN
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (org_name, org_slug, NEW.id)
    RETURNING id INTO new_org_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO new_org_id FROM public.organizations WHERE slug = org_slug LIMIT 1;
    IF new_org_id IS NULL THEN
      RETURN NEW;
    END IF;
  END;

  INSERT INTO public.organization_members (organization_id, user_id, access_level)
  VALUES (new_org_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name  TEXT;
  v_first_name TEXT;
  v_last_name  TEXT;
  v_space_pos  INT;
BEGIN
  v_full_name := NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), '');
  IF v_full_name IS NOT NULL THEN
    v_space_pos := position(' ' IN v_full_name);
    IF v_space_pos > 0 THEN
      v_first_name := btrim(substring(v_full_name FROM 1 FOR v_space_pos - 1));
      v_last_name  := NULLIF(btrim(substring(v_full_name FROM v_space_pos + 1)), '');
    ELSE
      v_first_name := v_full_name;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, agency_name, first_name, last_name)
  VALUES (NEW.id, NEW.email, v_full_name, NEW.raw_user_meta_data->>'agency_name', v_first_name, v_last_name)
  ON CONFLICT (id) DO NOTHING;

  -- No organization / membership here. Workspace is provisioned after email confirmation
  -- by the app (ensureSignupWorkspace). Invite / manual / training-only users never get one.
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
