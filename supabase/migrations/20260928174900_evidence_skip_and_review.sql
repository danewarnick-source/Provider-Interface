-- Applied live as version 20260928174900.
-- Evidence: skips are kept on record (who / when / why + history), and staff
-- uploads wait for admin review. Additive only — main keeps working.
--   evidence_items: opted_out_at / opted_out_by / opt_out_reason / history
--   evidence_files: review_status ('pending' | 'accepted' | 'sent_back'),
--                   reviewed_by / reviewed_at / review_note
-- Existing file rows default to 'accepted'.

ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS opted_out_by uuid,
  ADD COLUMN IF NOT EXISTS opt_out_reason text,
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.evidence_files
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_files_review_status_check'
  ) THEN
    ALTER TABLE public.evidence_files
      ADD CONSTRAINT evidence_files_review_status_check
      CHECK (review_status IN ('pending', 'accepted', 'sent_back'));
  END IF;
END $$;
