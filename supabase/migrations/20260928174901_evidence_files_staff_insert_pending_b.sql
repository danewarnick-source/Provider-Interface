-- Phase B — apply only AFTER the evidence skip/review code is deployed on main.
-- A non-admin member's own upload must arrive as review_status 'pending' so it
-- can't skip admin review by inserting 'accepted' directly. Their own attestation
-- (attested_by = self, no stored file) may still land as 'accepted'.
-- Admins/managers keep evidence_files_write_member (FOR ALL).
-- Before the new code ships, main inserts staff uploads with the column default
-- ('accepted'), which this policy would reject — hence Phase B.
-- RESTORE: the WITH CHECK from 20260927034348_scope_evidence_files_write_admin_staff_insert_own.sql.
ALTER POLICY evidence_files_insert_own_upload ON public.evidence_files
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND uploaded_by = auth.uid()
    AND (attested_by IS NULL OR attested_by = auth.uid())
    AND (
      review_status = 'pending'
      OR (attested_by = auth.uid() AND storage_path IS NULL)
    )
  );
