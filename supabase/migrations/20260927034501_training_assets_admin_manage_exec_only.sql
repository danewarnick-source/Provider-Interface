-- DB-23: training-assets storage bucket. The "training assets admin manage" policy (ALL) let the owner of ANY org
-- read/overwrite/delete every object in the bucket (all agencies' course assets).
-- Fix: limit the blanket policy to Hive execs. Owners and agency admins keep the per-uid-folder upload/update/delete policies.
-- Callers checked: src/routes/dashboard.courses.$courseId.edit.tsx is the only one. It uploads to `${user.id}/<uuid>.<ext>` with upsert:false
-- (covered by "org managers upload training assets") and reads with getPublicUrl (public bucket, so no RLS).
-- Prior definition (RESTORE):
-- ALTER POLICY "training assets admin manage" ON storage.objects
--   USING (bucket_id = 'training-assets' AND (is_hive_executive(auth.uid()) OR EXISTS (SELECT 1 FROM organization_members om
--          WHERE om.user_id = auth.uid() AND om.active AND om.access_level = 'owner')))
--   WITH CHECK (bucket_id = 'training-assets' AND (is_hive_executive(auth.uid()) OR EXISTS (SELECT 1 FROM organization_members om
--          WHERE om.user_id = auth.uid() AND om.active AND om.access_level = 'owner')));
ALTER POLICY "training assets admin manage" ON storage.objects
  USING (bucket_id = 'training-assets' AND public.is_hive_executive(auth.uid()))
  WITH CHECK (bucket_id = 'training-assets' AND public.is_hive_executive(auth.uid()));
