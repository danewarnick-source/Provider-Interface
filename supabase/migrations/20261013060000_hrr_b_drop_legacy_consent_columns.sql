-- PHASE B — NOT APPLIED. Apply only after the rights restriction (HRR)
-- consent and signatures change is merged to main and deployed.
-- Informed consent now lives in consent_signer_name / consent_signer_role /
-- consent_by / consent_at (20261013052719_hrr_document_consent_signatures.sql).
-- The old free-text consent columns are unused by the new code. On
-- 2026-10-13 no live row had a value in either column.
-- After applying, regenerate src/integrations/supabase/types.ts.

alter table public.hrc_restriction_records
  drop column if exists consent_text,
  drop column if exists consent_signed_date;
