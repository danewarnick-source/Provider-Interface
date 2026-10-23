-- Clients rebuild P3: one column per fact on clients. Additive only — the old
-- columns stay for production main until Prompt 12 drops them.
--   insurance          ← medical_insurance / private_insurance / medicare_number
--   about_me           ← preferred_activities / preferred_living
--   special_directions ← + clinical_alert / pertinent_health_notes / dietary_needs (staff must-knows)
--   client_photo_url   ← profile_photo_url where empty
-- Mirrors singleSourcesFromLegacy() in src/lib/clients/legacy-fields.ts.
-- Idempotent: only fills empty targets, and only appends text not already there.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS insurance text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS about_me text;

COMMENT ON COLUMN public.clients.insurance IS 'Insurance, one place (replaces medical_insurance/private_insurance/medicare_number).';
COMMENT ON COLUMN public.clients.about_me IS 'About me, one place (replaces preferred_activities/preferred_living).';

UPDATE public.clients SET insurance = nullif(concat_ws(E'\n',
    nullif(btrim(medical_insurance), ''),
    'Private: ' || nullif(btrim(private_insurance), ''),
    'Medicare: ' || nullif(btrim(medicare_number), '')
  ), '')
WHERE nullif(btrim(insurance), '') IS NULL
  AND coalesce(nullif(btrim(medical_insurance), ''), nullif(btrim(private_insurance), ''), nullif(btrim(medicare_number), '')) IS NOT NULL;

UPDATE public.clients SET about_me = nullif(concat_ws(E'\n',
    'Enjoys: ' || nullif(array_to_string(preferred_activities, ', '), ''),
    'Preferred living: ' || nullif(btrim(preferred_living), '')
  ), '')
WHERE nullif(btrim(about_me), '') IS NULL
  AND coalesce(nullif(array_to_string(preferred_activities, ', '), ''), nullif(btrim(preferred_living), '')) IS NOT NULL;

UPDATE public.clients c SET special_directions = x.merged
FROM (
  SELECT id, nullif(concat_ws(E'\n',
      nullif(btrim(special_directions), ''),
      CASE WHEN nullif(btrim(clinical_alert), '') IS NOT NULL
            AND position(btrim(clinical_alert) IN coalesce(special_directions, '')) = 0
           THEN btrim(clinical_alert) END,
      CASE WHEN nullif(btrim(pertinent_health_notes), '') IS NOT NULL
            AND position(btrim(pertinent_health_notes) IN coalesce(special_directions, '')) = 0
            AND btrim(pertinent_health_notes) IS DISTINCT FROM btrim(clinical_alert)
           THEN btrim(pertinent_health_notes) END,
      CASE WHEN nullif(btrim(dietary_needs), '') IS NOT NULL
            AND position(btrim(dietary_needs) IN coalesce(special_directions, '')) = 0
           THEN 'Diet: ' || btrim(dietary_needs) END
    ), '') AS merged
  FROM public.clients
) x
WHERE x.id = c.id AND x.merged IS DISTINCT FROM nullif(btrim(c.special_directions), '');

UPDATE public.clients SET client_photo_url = profile_photo_url
WHERE nullif(btrim(client_photo_url), '') IS NULL
  AND nullif(btrim(profile_photo_url), '') IS NOT NULL;
