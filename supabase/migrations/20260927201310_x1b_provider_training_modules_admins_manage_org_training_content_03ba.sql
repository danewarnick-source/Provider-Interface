-- X-1b: remove Hive exec (is_hive_executive) clause on public.provider_training_modules "admins manage org training content".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage org training content" ON public.provider_training_modules;

CREATE POLICY "admins manage org training content"
  ON public.provider_training_modules
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
