-- Item: DB-27 (Low). Any staff member could overwrite other staff photos.
-- Fix: UPDATE on staff-photos requires org admin/manager OR object owner.
-- Callers checked: components/person/photo-upload.tsx uploads to <org>/<subject>/photo-<timestamp>.<ext> with upsert:true
--   (unique path, so upsert only ever overwrites the uploader's own object). Bucket has 0 objects, private.
-- Retest (rolled back): s2 overwrite s1 photo=0 rows; s2 own photo=1; s1 (owner A) on s2 photo=1; s3 (org B)=0.
-- RESTORE:
-- ALTER POLICY "org members update staff-photos" ON storage.objects USING ((bucket_id = 'staff-photos'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));

ALTER POLICY "org members update staff-photos" ON storage.objects USING (bucket_id = 'staff-photos' AND (public.is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR owner = auth.uid()));
