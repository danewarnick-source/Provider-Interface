-- DB-16 (Lane A). Applied live as version 20260927033405.
-- Fixes: any staff member could overwrite/delete receipt evidence in their agency.
-- Now: org admin/manager of the path's org folder, or the uploader (owner = auth.uid()).
-- Owner branch kept because staff remove their own receipts:
--   reimbursement-shift-panel.tsx removeReceipt -> activity-receipts .remove()
--   client-spending-shift-panel.tsx removeEntry  -> client-spending-receipts .remove() (only own entries)
-- All uploads use upsert:false (no UPDATE path in app). Buckets had 0 objects at apply time.
-- Prior USING (all three were is_org_member):
--   "Org members can update receipts":            ((bucket_id = 'client_receipt_snapshots'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
--   "Org members delete activity receipts":        ((bucket_id = 'activity-receipts'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
--   "Org members delete client spending receipts": ((bucket_id = 'client-spending-receipts'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
ALTER POLICY "Org members can update receipts" ON storage.objects USING (bucket_id = 'client_receipt_snapshots' AND (public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR owner = auth.uid()));
ALTER POLICY "Org members delete activity receipts" ON storage.objects USING (bucket_id = 'activity-receipts' AND (public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR owner = auth.uid()));
ALTER POLICY "Org members delete client spending receipts" ON storage.objects USING (bucket_id = 'client-spending-receipts' AND (public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR owner = auth.uid()));
