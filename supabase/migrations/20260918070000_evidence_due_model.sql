-- Evidence due-date model — additive columns only.
-- Do NOT drop columns. Dane reviews this in the PR, then pastes it
-- into Lovable's SQL editor (clear the editor first).
-- See docs/SQL_HANDOFF.md ACTION — Evidence due-date model.
-- Persistence stays on evidence_items.

ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS first_due_rule text,
  ADD COLUMN IF NOT EXISTS first_due_on date,
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS next_due_on date,
  ADD COLUMN IF NOT EXISTS renew_years smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidence_items_first_due_rule_check'
  ) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_first_due_rule_check
      CHECK (
        first_due_rule IS NULL
        OR first_due_rule IN (
          'before_first_shift',
          'hire_30',
          'hire_90',
          'hire_180',
          'set_date'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidence_items_renew_years_check'
  ) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_renew_years_check
      CHECK (renew_years IS NULL OR renew_years IN (1, 2));
  END IF;
END $$;
