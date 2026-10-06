-- Access levels — Phase A, step 2: helper functions, rewritten role checks, policies.
-- After this migration no policy or live function reads organization_members.role,
-- has_org_role(), has_permission() or role_permissions, except the legacy
-- functions kept for code on main (dropped in Phase B).

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.access_is_owner(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user AND active AND access_level = 'owner');
$$;
COMMENT ON FUNCTION public.access_is_owner(uuid, uuid) IS 'Access: caller is an active Owner of the agency.';

CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user AND active
      AND (access_level = 'owner' OR (access_level = 'admin' AND access_scope = 'agency')));
$$;
COMMENT ON FUNCTION public.is_org_admin_or_manager(uuid, uuid) IS
  'Access: Owner or agency-wide Admin. Assigned-scope Admins get rows through access_can_see_client / access_can_see_staff instead (fail closed).';

CREATE OR REPLACE FUNCTION public.access_categories(_org uuid, _user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN m.access_level = 'owner' THEN (
      SELECT jsonb_object_agg(k, 'edit') FROM unnest(ARRAY[
        'staff_roster','staff_hiring','staff_compliance','clients','client_medical','documentation',
        'incidents','hrc','scheduling','timesheets','billing','payroll','financial_reports','reports',
        'hosts','loans','agency_settings','phone_app']) AS k)
    ELSE (COALESCE(p.categories, '{}'::jsonb) || m.access_overrides) - 'agency_settings'
  END
  FROM public.organization_members m
  LEFT JOIN public.access_presets p ON p.id = m.access_preset_id
  WHERE m.organization_id = _org AND m.user_id = _user AND m.active;
$$;
COMMENT ON FUNCTION public.access_categories(uuid, uuid) IS
  'Access: effective category map (preset + per-person overrides; Owners get everything; agency_settings is Owner-only). Mirrors src/lib/access/can.ts.';

CREATE OR REPLACE FUNCTION public.access_has_category(_org uuid, _user uuid, _category text, _min text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    CASE public.access_categories(_org, _user) ->> _category WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END, 0)
    >= CASE _min WHEN 'edit' THEN 2 ELSE 1 END;
$$;
COMMENT ON FUNCTION public.access_has_category(uuid, uuid, text, text) IS 'Access: caller has at least _min (view|edit) on _category.';

CREATE OR REPLACE FUNCTION public.access_can_see_client(_client uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.organization_members m
      ON m.organization_id = c.organization_id AND m.user_id = _user AND m.active
    WHERE c.id = _client
      AND public.access_has_category(c.organization_id, _user, 'clients', 'view')
      AND (
        m.access_scope = 'agency'
        OR EXISTS (
          SELECT 1 FROM public.access_assignments a
          WHERE a.organization_id = c.organization_id AND a.user_id = _user
            AND ((a.kind = 'client' AND a.target_id = c.id) OR (a.kind = 'home' AND a.target_id = c.team_id)))));
$$;
COMMENT ON FUNCTION public.access_can_see_client(uuid, uuid) IS
  'Access: caller can open this client under their scope (agency, or assigned via client/home) and has Clients >= view.';

CREATE OR REPLACE FUNCTION public.access_can_see_staff(_org uuid, _staff uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _viewer = _staff OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = _viewer AND m.active
      AND public.access_has_category(_org, _viewer, 'staff_roster', 'view')
      AND (
        m.access_scope = 'agency'
        OR EXISTS (
          SELECT 1 FROM public.access_assignments a
          WHERE a.organization_id = _org AND a.user_id = _viewer
            AND ((a.kind = 'staff' AND a.target_id = _staff)
              OR (a.kind = 'home' AND a.target_id = (SELECT team_id FROM public.profiles WHERE id = _staff))))));
$$;
COMMENT ON FUNCTION public.access_can_see_staff(uuid, uuid, uuid) IS
  'Access: viewer can open this staffer under their scope (self, agency, or assigned via staff/home) and has Staff roster >= view.';

-- ---------------------------------------------------------------- rewritten helpers
CREATE OR REPLACE FUNCTION public.is_hrc_committee_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.access_has_category(_org, _user, 'hrc', 'view');
$$;
COMMENT ON FUNCTION public.is_hrc_committee_member(uuid, uuid) IS 'Access: caller has HRC / rights restrictions >= view.';

CREATE OR REPLACE FUNCTION public.can_access_client_phi(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR public.access_can_see_client(_client_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = _client_id
        AND public.is_org_member(c.organization_id, auth.uid())
        AND public.staff_assigned_to_client(c.id, auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.can_view_staff_pii(_org uuid, _staff uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    _viewer = _staff
    OR public.access_is_owner(_org, _viewer)
    OR public.is_hive_executive(_viewer)
    OR (public.access_can_see_staff(_org, _staff, _viewer)
        AND public.access_has_category(_org, _viewer, 'staff_roster', 'edit'));
$$;
COMMENT ON FUNCTION public.can_view_staff_pii(uuid, uuid, uuid) IS
  'Access: SSN/DOB/address/pay rates — self, Owners, HIVE execs, or anyone who can see the staffer AND has Staff roster = edit.';

CREATE OR REPLACE FUNCTION public.can_view_client_intake(_org uuid, _client uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    public.access_is_owner(_org, _viewer)
    OR public.is_hive_executive(_viewer)
    OR public.access_can_see_client(_client, _viewer)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.organization_id = _org AND sa.client_id = _client AND sa.staff_id = _viewer);
$$;

CREATE OR REPLACE FUNCTION public.flag_member_deactivated(_org_id uuid, _user_id uuid, _changed_by_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.access_change_log (
    organization_id, changed_by_user_id, changed_by_name,
    target_user_id, target_user_name, change_type, details)
  SELECT _org_id, _changed_by_user_id,
         COALESCE((SELECT full_name FROM public.org_member_directory WHERE id = _changed_by_user_id), 'Unknown'),
         _user_id,
         COALESCE((SELECT full_name FROM public.org_member_directory WHERE id = _user_id), 'Unknown'),
         'deactivated',
         jsonb_build_object('access_level',
           (SELECT access_level FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_level public.access_level;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  IF lower(v_inv.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  v_level := COALESCE(v_inv.access_level,
    CASE v_inv.role::text WHEN 'admin' THEN 'owner' ELSE 'staff' END::public.access_level);

  INSERT INTO public.organization_members (organization_id, user_id, access_level, access_preset_id, active)
  VALUES (v_inv.organization_id, auth.uid(), v_level, v_inv.access_preset_id, true)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET access_level = EXCLUDED.access_level,
        access_preset_id = EXCLUDED.access_preset_id,
        access_scope = NULL,
        active = true;

  UPDATE public.invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    WHERE id = v_inv.id;

  RETURN v_inv.organization_id;
END;
$$;

-- Small in-place edits to functions whose only role use is one line.
DO $$
DECLARE
  r record;
  def text;
  edits text[][] := ARRAY[
    ['has_org_role(p.organization_id, auth.uid(), ''admin'')', 'access_is_owner(p.organization_id, auth.uid())'],
    ['has_org_role(j.org_id, auth.uid(), ''admin''::app_role)', 'access_is_owner(j.org_id, auth.uid())'],
    ['OR has_org_role(j.org_id, auth.uid(), ''super_admin''::app_role)', ''],
    ['has_org_role(j.target_org_id, auth.uid(), ''admin''::app_role)', 'access_is_owner(j.target_org_id, auth.uid())'],
    ['public.has_org_role(v_org, auth.uid(), ''admin''::app_role)', 'public.access_is_owner(v_org, auth.uid())'],
    ['AND role IN (''admin'', ''manager'', ''super_admin'')', 'AND (access_level = ''owner'' OR (access_level = ''admin'' AND access_scope = ''agency''))'],
    ['AND role IN (''admin'',''manager'')', 'AND access_level IN (''owner'', ''admin'')'],
    ['OR role IN (''admin'',''super_admin'')', 'OR access_level = ''owner'''],
    ['(organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, ''admin'')', '(organization_id, user_id, access_level)
  VALUES (new_org_id, NEW.id, ''owner'')']
  ];
  i int;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'apply_med_change_proposal', 'reject_med_change_proposal', 'can_access_import_job',
      'set_company_executive', 'incident_client_counts', 'incident_monthly_category_counts',
      'is_admin_anywhere', 'is_company_executive', 'handle_new_user')
  LOOP
    def := pg_get_functiondef(r.oid);
    FOR i IN 1 .. array_length(edits, 1) LOOP
      def := replace(def, edits[i][1], edits[i][2]);
    END LOOP;
    EXECUTE def;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- policies: new tables
CREATE POLICY "access_presets: members read" ON public.access_presets
  FOR SELECT USING (public.is_org_member(organization_id, auth.uid()) OR public.is_hive_executive(auth.uid()));
CREATE POLICY "access_presets: owners write" ON public.access_presets
  FOR ALL USING (public.access_is_owner(organization_id, auth.uid()))
  WITH CHECK (public.access_is_owner(organization_id, auth.uid()));

CREATE POLICY "access_assignments: members read" ON public.access_assignments
  FOR SELECT USING (public.is_org_member(organization_id, auth.uid()) OR public.is_hive_executive(auth.uid()));
CREATE POLICY "access_assignments: owners write" ON public.access_assignments
  FOR ALL USING (public.access_is_owner(organization_id, auth.uid()))
  WITH CHECK (public.access_is_owner(organization_id, auth.uid()));

-- ---------------------------------------------------------------- policies: rewrite role checks everywhere
DO $$
DECLARE
  r record;
  pats text[][] := ARRAY[
    [' OR has_org_role\(([^,]+), auth\.uid\(\), ''super_admin''::app_role\)', ''],
    ['has_org_role\(([^,]+), auth\.uid\(\), ''super_admin''::app_role\) OR ', ''],
    ['has_org_role\(([^,]+), auth\.uid\(\), ''super_admin''::app_role\)', 'false'],
    ['has_org_role\(([^,]+), auth\.uid\(\), ''admin''::app_role\)', 'access_is_owner(\1, auth.uid())'],
    ['has_org_role\(([^,]+), auth\.uid\(\), ''manager''::app_role\)', 'is_org_admin_or_manager(\1, auth.uid())'],
    ['has_org_role\(([^,]+), auth\.uid\(\), ''employee''::app_role\)', 'is_org_member(\1, auth.uid())'],
    [' OR has_permission\(auth\.uid\(\), ([^,]+), ''manage_users''::text\)', ''],
    ['has_permission\(auth\.uid\(\), ([^,]+), ''manage_referrals''::text\)', 'access_has_category(\1, auth.uid(), ''hosts''::text, ''edit''::text)'],
    ['has_permission\(auth\.uid\(\), ([^,]+), ''view_referrals''::text\)', 'access_has_category(\1, auth.uid(), ''hosts''::text, ''view''::text)'],
    ['(\m[a-z_]+)\.role = ANY \(ARRAY\[''admin''::app_role, ''manager''::app_role, ''super_admin''::app_role\]\)',
     '(\1.access_level = ''owner''::access_level OR (\1.access_level = ''admin''::access_level AND \1.access_scope = ''agency''::text))'],
    ['(\m[a-z_]+)\.role = ANY \(ARRAY\[''admin''::app_role, ''super_admin''::app_role\]\)',
     '(\1.access_level = ''owner''::access_level)']
  ];
  q text;
  c text;
  i int;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies
    WHERE (COALESCE(qual, '') || COALESCE(with_check, '')) ~ '(has_org_role|has_permission|app_role)'
  LOOP
    q := r.qual;
    c := r.with_check;
    FOR i IN 1 .. array_length(pats, 1) LOOP
      q := regexp_replace(q, pats[i][1], pats[i][2], 'g');
      c := regexp_replace(c, pats[i][1], pats[i][2], 'g');
    END LOOP;
    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
    IF c IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', c); END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
