-- DB-12 (Lane A). Applied live on Hive-Platform as version 20260927033139.
-- certificates bucket: "managers read all cert files" let an owner/agency-admin of ANY org read every user's
-- certificate files in every org (no org link). Files are keyed by user: path `<user_uid>/<uuid>.<ext>`
-- (src/routes/dashboard.external-certifications.tsx UploadDialog). Org is derived via organization_members:
-- reader must be an active owner/agency-admin in an org where the file's user has a membership row (any active
-- state, so deactivated staff's certs remain visible to their managers). Multi-org user: managers of each org
-- the user belongs to can read (0 multi-org users today). Own-file policies unchanged. Bucket has 0 objects.
-- PRIOR USING (restore with ALTER POLICY ... USING (<this>)):
--   (bucket_id = 'certificates' AND EXISTS (SELECT 1 FROM public.organization_members om
--      WHERE om.user_id = auth.uid() AND om.active
--        AND (om.access_level = 'owner' OR (om.access_level = 'admin' AND om.access_scope = 'agency'))))
ALTER POLICY "managers read all cert files" ON storage.objects USING (
  bucket_id = 'certificates' AND EXISTS (
    SELECT 1 FROM public.organization_members om
    JOIN public.organization_members tgt
      ON tgt.organization_id = om.organization_id
     AND tgt.user_id::text = (storage.foldername(name))[1]
    WHERE om.user_id = auth.uid() AND om.active
      AND (om.access_level = 'owner' OR (om.access_level = 'admin' AND om.access_scope = 'agency'))));
