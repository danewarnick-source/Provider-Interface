-- DB-22 (Lane A). Applied live as version 20260927034348.
-- Fixes: evidence_files_write_member (FOR ALL) let any org member insert/update/delete any evidence_files row.
-- Now: FOR ALL limited to org admin/manager (+ Hive exec, as in the fix list; evidence is compliance, not client PHI).
-- Deviation from list SQL (to avoid breaking a live caller): staff DO insert evidence_files with the user client
--   (evidence.functions.ts recordEvidenceUpload / recordEvidenceAttestation, requireOrgMembership "staff",
--   insertFileRow -> sb.from("evidence_files").insert(row) with uploaded_by = userId, attested_by = userId|null).
--   So a new INSERT-only policy lets members add rows where uploaded_by = self and attested_by is null or self.
--   No staff update/delete path exists. SELECT policy evidence_files_select_org_member unchanged.
-- Prior:
--   evidence_files_write_member FOR ALL TO authenticated
--     USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
--     WITH CHECK (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
-- RESTORE: ALTER POLICY evidence_files_write_member ... (above); DROP POLICY evidence_files_insert_own_upload ON public.evidence_files;
ALTER POLICY evidence_files_write_member ON public.evidence_files
  USING (public.is_org_admin_or_manager(organization_id, auth.uid()) OR public.is_hive_executive(auth.uid()))
  WITH CHECK (public.is_org_admin_or_manager(organization_id, auth.uid()) OR public.is_hive_executive(auth.uid()));

CREATE POLICY evidence_files_insert_own_upload ON public.evidence_files
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid())
              AND uploaded_by = auth.uid()
              AND (attested_by IS NULL OR attested_by = auth.uid()));
