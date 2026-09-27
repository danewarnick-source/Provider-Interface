-- Item: DB-31 (Low, bug, failed closed). referral-documents storage policies called is_org_admin_or_manager(auth.uid(), org)
--   with arguments swapped (signature is (_org uuid, _user uuid)), so managers could not use the bucket via the user client.
-- Fix: swap arguments in read / upload / delete. Bucket has 0 objects.
-- Retest (rolled back): s1 upload <A>/ref.pdf=1, s1 read=1, s1 delete=1; s2 (staff A) read=0 upload=42501; s3 (org B) read=0 upload=42501 delete=0.
-- Note (not changed): the public.referral_documents TABLE policies ("referral_documents managers select/insert/update/delete")
--   have the same swapped-argument bug (fails closed; table has 0 rows). Candidate follow-up.
-- RESTORE:
-- ALTER POLICY "referral-documents managers read" ON storage.objects USING ((bucket_id = 'referral-documents'::text) AND is_org_admin_or_manager(auth.uid(), (NULLIF(split_part(name, '/'::text, 1), ''::text))::uuid));
-- ALTER POLICY "referral-documents managers upload" ON storage.objects WITH CHECK ((bucket_id = 'referral-documents'::text) AND is_org_admin_or_manager(auth.uid(), (NULLIF(split_part(name, '/'::text, 1), ''::text))::uuid));
-- ALTER POLICY "referral-documents managers delete" ON storage.objects USING ((bucket_id = 'referral-documents'::text) AND is_org_admin_or_manager(auth.uid(), (NULLIF(split_part(name, '/'::text, 1), ''::text))::uuid));

ALTER POLICY "referral-documents managers read" ON storage.objects USING ((bucket_id = 'referral-documents'::text) AND is_org_admin_or_manager((NULLIF(split_part(name, '/'::text, 1), ''::text))::uuid, auth.uid()));
ALTER POLICY "referral-documents managers upload" ON storage.objects WITH CHECK ((bucket_id = 'referral-documents'::text) AND is_org_admin_or_manager((NULLIF(split_part(name, '/'::text, 1), ''::text))::uuid, auth.uid()));
ALTER POLICY "referral-documents managers delete" ON storage.objects USING ((bucket_id = 'referral-documents'::text) AND is_org_admin_or_manager((NULLIF(split_part(name, '/'::text, 1), ''::text))::uuid, auth.uid()));
