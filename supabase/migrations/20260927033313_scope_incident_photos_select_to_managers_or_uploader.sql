-- DB-15 (Lane A). Applied live as version 20260927033313.
-- Fixes: any staff member could read every incident photo in their agency.
-- Now: org admin/manager of the path's org folder, or the uploader (owner = auth.uid()).
-- Callers: incident-report-dialog.tsx uploads to <org>/<client|unassigned>/<ts>_<name> (owner = uploader; insert policy unchanged).
--   signIncidentPhotos (incidents.functions.ts) has no caller in src; it signs with the user client, so managers still can.
-- Bucket had 0 objects at apply time.
-- Prior USING:
--   ((bucket_id = 'incident-photos'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
ALTER POLICY "incident-photos org members select" ON storage.objects USING (bucket_id = 'incident-photos' AND (public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR owner = auth.uid()));
