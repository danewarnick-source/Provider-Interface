-- DB-3 (Lane A). Applied live on Hive-Platform as version 20260927032228.
-- evidence-files storage policies checked only bucket_id, so any signed-in user could read/write/update/delete
-- any agency's evidence files. Scope by the first path segment (org id): members read/insert, admins/managers
-- update/delete. App writes paths as `<org_id>/<item_id>/<ts>-<file>` (staff-evidence-list.tsx, evidence-workspace.tsx);
-- no client-side update/delete calls. Prior state: USING/WITH CHECK (bucket_id = 'evidence-files') on all four.
ALTER POLICY evidence_files_storage_select ON storage.objects USING (bucket_id = 'evidence-files' AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));
ALTER POLICY evidence_files_storage_insert ON storage.objects WITH CHECK (bucket_id = 'evidence-files' AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));
ALTER POLICY evidence_files_storage_update ON storage.objects USING (bucket_id = 'evidence-files' AND public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()));
ALTER POLICY evidence_files_storage_delete ON storage.objects USING (bucket_id = 'evidence-files' AND public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()));
