-- NOT APPLIED. Database owner pastes this after the app in this PR is deployed.
-- Do not run it from CI. Do not run it before that app is live.
--
-- Goal: no organization or organization_members row until the email is confirmed.
--
-- Verified read-only on 2026-09-27 against live public.handle_new_user()
-- (main @ 0506776). The live function runs AFTER INSERT ON auth.users, so it
-- runs at signUp, before confirmation. It inserts profiles, then organizations,
-- then organization_members (access_level owner). It skips the org only when
-- that user already has any organization_members row. It does not skip
-- created_via invitation / manual_admin / training_only. That skip is in
-- supabase/migrations/20260903040000_training_only_orders.sql and is not what
-- is live. Three unconfirmed auth users each already own an auto-created org.
--
-- After this change the trigger only creates the profile row. The workspace
-- is created by ensureSignupWorkspace (src/lib/signup-workspace.functions.ts)
-- after a confirmed session exists (signup "I've confirmed", sign-in, or the
-- first signed-in page).
--
-- trg_org_members_require_org_setup does not need a change. It calls
-- enforce_org_setup_before_create(), which allows the first
-- organization_members row for that org (verified live, same body as
-- supabase/migrations/20260914120000_agency_setup_gate.sql). The owner insert
-- is done with the service role because RLS policy "admins insert org members"
-- only allows a user who is already an owner. The service role bypasses RLS.
-- The trigger still fires and allows that first row.
--
-- Invite join, Add manually, roster import, and training-only logins do not
-- use this trigger to create an org or a membership. They set created_via and
-- write their own profile (and, except training-only, their own membership).

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

-- Optional cleanup (review first; currently 3 unconfirmed users each own an auto-created org).
-- Do not run this as part of the paste above.
-- SELECT u.id, u.created_at, o.id AS org_id, o.name
--   FROM auth.users u JOIN public.organizations o ON o.created_by = u.id
--  WHERE u.email_confirmed_at IS NULL;
