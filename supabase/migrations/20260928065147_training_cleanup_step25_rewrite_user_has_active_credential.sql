-- Step 25. Point the eMAR LPN/RN license check at Evidence license rows instead of external certifications.
CREATE OR REPLACE FUNCTION public.user_has_active_credential(_user_id uuid, _org_id uuid, _cert_type text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.evidence_items ei
      JOIN public.evidence_files ef ON ef.item_id = ei.id
     WHERE ei.subject_type = 'staff'
       AND ei.subject_id = _user_id
       AND ei.organization_id = _org_id
       AND ei.requirement_key = CASE lower(_cert_type)
            WHEN 'lpn' THEN 'pm1_lpn_license'
            WHEN 'rn' THEN 'pm2_rn_license'
            ELSE NULL
          END
       AND (ei.expires_on IS NULL OR ei.expires_on >= current_date)
       AND (
         ef.storage_path IS NOT NULL
         OR ef.filename IS NOT NULL
         OR ef.attested_at IS NOT NULL
       )
  );
$function$;
