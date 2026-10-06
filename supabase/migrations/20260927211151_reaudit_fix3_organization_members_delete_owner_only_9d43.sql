-- Re-audit fix 3: remove Hive-exec cross-org write on organization_members (an exec could add themselves to any agency and gain PHI access). Owner path unchanged; exec SELECT policies unchanged. App writes use the service role and DB functions are SECURITY DEFINER, so no code depends on this branch.
DROP POLICY IF EXISTS "admins delete org members" ON public.organization_members;
CREATE POLICY "admins delete org members" ON public.organization_members AS PERMISSIVE FOR DELETE TO authenticated
  USING (access_is_owner(organization_id, auth.uid()));
