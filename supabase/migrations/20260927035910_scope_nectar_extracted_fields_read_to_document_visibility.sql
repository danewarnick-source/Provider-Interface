-- Item: nectar_extracted_fields scoping to match D6 (Dane decision 9:58 PM MT 2026-09-26)
-- Fixes: any TN member could read all 136 extracted fields regardless of parent document visibility.
--   Member read now requires the parent nectar_documents row to be visible under the caller's own RLS
--   (EXISTS runs as invoker, so D6 rules apply automatically). Admin/manager unchanged.
-- document_id is NOT NULL with FK -> nectar_documents (0 null rows).
-- Retest (rolled back): admins 0a6d/d672 = 136; staff 02cd/0ad9/bade = 131 (state SOW only, contract fields hidden);
--   exec X 1a45 = 136 (both parents non-client docs, which execs keep under D6); 583a = 0.
-- RESTORE:
-- ALTER POLICY "org members read extracted fields" ON public.nectar_extracted_fields USING ((is_org_member(organization_id, auth.uid())));

ALTER POLICY "org members read extracted fields" ON public.nectar_extracted_fields USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND EXISTS (SELECT 1 FROM public.nectar_documents d WHERE d.id = nectar_extracted_fields.document_id)));
