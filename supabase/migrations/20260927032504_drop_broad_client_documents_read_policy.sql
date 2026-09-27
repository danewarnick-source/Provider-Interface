-- DB-5 (Lane A). Applied live on Hive-Platform as version 20260927032504.
-- The broad SELECT policy "org members read documents" (is_org_member OR is_hive_executive) was OR-ed with
-- the caseload policy, so any staff member could read every client's document rows.
-- Remaining: "caseload or admin read client_documents" (can_access_client_phi(client_id)) and
-- "admins manage documents" (ALL: owner/agency admin or Hive exec). Exec access is unchanged.
-- To revert: CREATE POLICY "org members read documents" ON public.client_documents FOR SELECT TO authenticated
--   USING (public.is_org_member(organization_id, auth.uid()) OR public.is_hive_executive(auth.uid()));
DROP POLICY "org members read documents" ON public.client_documents;
