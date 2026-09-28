-- Step 24. Point the eMAR medication-training check at Evidence. If the org has no medication evidence, the pass is still allowed.
CREATE OR REPLACE FUNCTION public.is_med_assist_current(_user uuid, _org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH med_items AS (
    SELECT ei.id, ei.subject_id, ei.expires_on
    FROM public.evidence_items ei
    WHERE ei.organization_id = _org
      AND ei.subject_type = 'staff'
      AND (
        ei.requirement_key ILIKE '%med_assist%'
        OR ei.requirement_key ILIKE '%medication%'
        OR ei.title ILIKE '%medication%'
        OR ei.title ILIKE '%med assist%'
        OR ei.title ILIKE '%med-assist%'
      )
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM med_items) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM med_items m
      JOIN public.evidence_files ef ON ef.item_id = m.id
      WHERE m.subject_id = _user
        AND (m.expires_on IS NULL OR m.expires_on >= current_date)
        AND (
          ef.storage_path IS NOT NULL
          OR ef.filename IS NOT NULL
          OR ef.attested_at IS NOT NULL
        )
    )
  END;
$function$;
