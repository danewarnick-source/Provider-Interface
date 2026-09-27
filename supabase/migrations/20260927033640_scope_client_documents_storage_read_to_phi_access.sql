-- DB-14 (Lane A). Applied live as version 20260927033640. Owner GO: Dane 9:34 PM MT Sep 26 2026 (leave 9 orphans in place).
-- Fixes: client-documents storage SELECT was membership-only; any staff member could download any client's file by path.
-- Now: org admin/manager of folder-1 org, OR a client_documents row with storage_path = name whose client the caller
--   can_access_client_phi(). Orphans (9, all True North, see ../db14-client-documents-orphan-map.md) stay admin-only.
-- Callers: uploads are admin/manager-only (insert policy unchanged); all app flows that upload also insert a
--   client_documents row with storage_path (e.g. client-specific-training attach, budget/meal-plan reports).
--   Upload-then-read-before-row flows (budget parse, PCSP import) are admin flows -> admin branch.
-- Prior USING:
--   ((bucket_id = 'client-documents'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
ALTER POLICY "client-documents: org members can read" ON storage.objects USING (
  bucket_id = 'client-documents' AND (
    public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_documents d
               WHERE d.storage_path = name AND public.can_access_client_phi(d.client_id))));
