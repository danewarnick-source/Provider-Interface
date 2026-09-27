-- D6 (owner decision 9:34 PM MT): every org member could read every nectar_documents row in their org, including client PHI docs
-- (pcsp, hrc_approval), contracts and billing docs. Hive execs could read all of them across every org.
-- New read rule:
--   admins/managers: everything in their org.
--   members: client-linked docs only with can_access_client_phi(client_id); staff docs only their own; company/state/other docs except
--            contracts, rates and billing (document_type contract/1056_budget/billing_record/timesheet/evv_report, or authoritative_kind provider_contract).
--   execs: non-client docs only (their PHI branch is removed from client-owned docs, in both the read and manage policies).
-- category is NULL on every row, so the predicate keys off owner_kind, client_id, document_type and authoritative_kind.
-- The storage read policy "nectar docs read for org members" does an EXISTS on nectar_documents under the caller's RLS, so it inherits this scoping.
-- Callers checked: sign-policy / courses.policy / policy-signatures read authoritative_kind='provider_policy' docs, which members still see.
-- nectar-help reads is_authoritative_source docs (contracts are now hidden from staff, which is intended). client-hr and client-documents-card read
-- client docs (now PHI-gated). The exec approvals path uses supabaseAdmin, so it is unaffected.
-- nectar-staff STAFF_DOC_TYPES includes 'contract', so staff no longer get contract excerpts, which is intended.
-- PRIOR (RESTORE):
-- ALTER POLICY "org members read nectar docs" ON public.nectar_documents USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
-- ALTER POLICY "admins manage nectar docs" ON public.nectar_documents USING (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
--   WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
ALTER POLICY "org members read nectar docs" ON public.nectar_documents USING (
  is_org_admin_or_manager(organization_id, auth.uid())
  OR (is_org_member(organization_id, auth.uid()) AND CASE
        WHEN client_id IS NOT NULL OR owner_kind = 'client' THEN client_id IS NOT NULL AND can_access_client_phi(client_id)
        WHEN owner_kind = 'staff' THEN staff_id = auth.uid()
        ELSE NOT (document_type IN ('contract','1056_budget','billing_record','timesheet','evv_report')
                  OR coalesce(authoritative_kind,'') = 'provider_contract')
      END)
  OR (is_hive_executive(auth.uid()) AND client_id IS NULL AND owner_kind <> 'client')
);
ALTER POLICY "admins manage nectar docs" ON public.nectar_documents
  USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_hive_executive(auth.uid()) AND client_id IS NULL AND owner_kind <> 'client'))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_hive_executive(auth.uid()) AND client_id IS NULL AND owner_kind <> 'client'));
