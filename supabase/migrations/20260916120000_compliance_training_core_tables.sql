-- Phase 1 compliance + training core tables.
-- Additive. Idempotent. Never drop existing tables or columns.
-- Do NOT apply to Hive-Platform production from CI — Tony/Core Soft pastes
-- this in Lovable (clear the editor first). See docs/SQL_HANDOFF.md.
--
-- Empty writers only. Production reads stay on company_obligations*,
-- nectar_*, and existing training_* tables.
--
-- Layered SOW (column support only — no invented SOW text):
--   all_staff_clock | staff_shelf | staff_exception | code_work_product
--   | client_shelf | company_standing
-- Transport pack DEFAULT ON: absence of org_facts.does_not_transport
-- (subject=staff) means the person transports. Rare opt-out writes that fact.
-- Punch / EVV / timeclock stay on existing shift tables — not these.

-- ── requirement_defs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.requirement_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  subject_kind text NOT NULL,
  layer text NOT NULL,
  title text NOT NULL DEFAULT '',
  source_sow_cite text,
  gate_fact_key text,
  default_on boolean NOT NULL DEFAULT true,
  evidence_kinds text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requirement_defs
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS layer text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS source_sow_cite text,
  ADD COLUMN IF NOT EXISTS gate_fact_key text,
  ADD COLUMN IF NOT EXISTS default_on boolean,
  ADD COLUMN IF NOT EXISTS evidence_kinds text[],
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.requirement_defs
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN default_on SET DEFAULT true,
  ALTER COLUMN evidence_kinds SET DEFAULT '{}',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.requirement_defs
  DROP CONSTRAINT IF EXISTS requirement_defs_subject_kind_chk;
ALTER TABLE public.requirement_defs
  ADD CONSTRAINT requirement_defs_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

ALTER TABLE public.requirement_defs
  DROP CONSTRAINT IF EXISTS requirement_defs_layer_chk;
ALTER TABLE public.requirement_defs
  ADD CONSTRAINT requirement_defs_layer_chk
  CHECK (layer IN (
    'all_staff_clock',
    'staff_shelf',
    'staff_exception',
    'code_work_product',
    'client_shelf',
    'company_standing'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS requirement_defs_platform_key_uidx
  ON public.requirement_defs (requirement_key)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS requirement_defs_org_key_uidx
  ON public.requirement_defs (organization_id, requirement_key)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS requirement_defs_org_layer_idx
  ON public.requirement_defs (organization_id, layer);

COMMENT ON TABLE public.requirement_defs IS
  'Phase 1 catalog/overlay for compliance+training keys. Empty until dual-write. No invented SOW text.';
COMMENT ON COLUMN public.requirement_defs.source_sow_cite IS
  'Citation only (e.g. DHHS91172 §). Do not store invented SOW body text.';
COMMENT ON COLUMN public.requirement_defs.default_on IS
  'Transport pack and similar packs default ON; opt-out is an org_facts row, not default_on=false on every staff.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_defs TO authenticated;
GRANT ALL ON public.requirement_defs TO service_role;

ALTER TABLE public.requirement_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requirement_defs_select_member ON public.requirement_defs;
CREATE POLICY requirement_defs_select_member
  ON public.requirement_defs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS requirement_defs_write_admin ON public.requirement_defs;
CREATE POLICY requirement_defs_write_admin
  ON public.requirement_defs
  FOR ALL
  TO authenticated
  USING (
    (organization_id IS NULL AND public.is_hive_executive(auth.uid()))
    OR (
      organization_id IS NOT NULL
      AND (
        public.is_org_admin_or_manager(organization_id, auth.uid())
        OR public.is_hive_executive(auth.uid())
      )
    )
  )
  WITH CHECK (
    (organization_id IS NULL AND public.is_hive_executive(auth.uid()))
    OR (
      organization_id IS NOT NULL
      AND (
        public.is_org_admin_or_manager(organization_id, auth.uid())
        OR public.is_hive_executive(auth.uid())
      )
    )
  );

DROP TRIGGER IF EXISTS requirement_defs_set_updated_at ON public.requirement_defs;
CREATE TRIGGER requirement_defs_set_updated_at
  BEFORE UPDATE ON public.requirement_defs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── org_facts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  subject_kind text NOT NULL,
  subject_id uuid,
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL DEFAULT 'null'::jsonb,
  source text NOT NULL DEFAULT 'recorded',
  recorded_by uuid,
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_facts
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS fact_key text,
  ADD COLUMN IF NOT EXISTS fact_value jsonb,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.org_facts
  ALTER COLUMN fact_value SET DEFAULT 'null'::jsonb,
  ALTER COLUMN source SET DEFAULT 'recorded',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.org_facts
  DROP CONSTRAINT IF EXISTS org_facts_subject_kind_chk;
ALTER TABLE public.org_facts
  ADD CONSTRAINT org_facts_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

ALTER TABLE public.org_facts
  DROP CONSTRAINT IF EXISTS org_facts_subject_shape_chk;
ALTER TABLE public.org_facts
  ADD CONSTRAINT org_facts_subject_shape_chk
  CHECK (
    (subject_kind = 'org' AND subject_id IS NULL)
    OR (subject_kind IN ('staff', 'client', 'site') AND subject_id IS NOT NULL)
  );

ALTER TABLE public.org_facts
  DROP CONSTRAINT IF EXISTS org_facts_source_chk;
ALTER TABLE public.org_facts
  ADD CONSTRAINT org_facts_source_chk
  CHECK (source IN ('recorded', 'computed', 'override'));

CREATE UNIQUE INDEX IF NOT EXISTS org_facts_org_subject_key_uidx
  ON public.org_facts (organization_id, subject_kind, subject_id, fact_key)
  WHERE subject_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_facts_org_key_uidx
  ON public.org_facts (organization_id, subject_kind, fact_key)
  WHERE subject_id IS NULL;

CREATE INDEX IF NOT EXISTS org_facts_org_key_idx
  ON public.org_facts (organization_id, fact_key);

COMMENT ON TABLE public.org_facts IS
  'Normalized gate facts. Transport DEFAULT ON: write fact_key=does_not_transport only for rare staff opt-out.';
COMMENT ON COLUMN public.org_facts.fact_key IS
  'Examples (not seeded): does_not_transport, operates_ol_site, uses_volunteers, has_governing_board, abi_caseload, behavior_caseload.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_facts TO authenticated;
GRANT ALL ON public.org_facts TO service_role;

ALTER TABLE public.org_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_facts_select_member ON public.org_facts;
CREATE POLICY org_facts_select_member
  ON public.org_facts
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS org_facts_write_admin ON public.org_facts;
CREATE POLICY org_facts_write_admin
  ON public.org_facts
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP TRIGGER IF EXISTS org_facts_set_updated_at ON public.org_facts;
CREATE TRIGGER org_facts_set_updated_at
  BEFORE UPDATE ON public.org_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── obligation_instances ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.obligation_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  requirement_def_id uuid REFERENCES public.requirement_defs (id) ON DELETE SET NULL,
  requirement_key text NOT NULL,
  subject_kind text NOT NULL,
  subject_id uuid,
  status text NOT NULL DEFAULT 'missing',
  due_at timestamptz,
  completed_at timestamptz,
  waived_at timestamptz,
  waived_reason text,
  period_key text,
  source_sow_cite text,
  gate_fact_key text,
  evidence_file_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obligation_instances
  ADD COLUMN IF NOT EXISTS requirement_def_id uuid,
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS waived_at timestamptz,
  ADD COLUMN IF NOT EXISTS waived_reason text,
  ADD COLUMN IF NOT EXISTS period_key text,
  ADD COLUMN IF NOT EXISTS source_sow_cite text,
  ADD COLUMN IF NOT EXISTS gate_fact_key text,
  ADD COLUMN IF NOT EXISTS evidence_file_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.obligation_instances
  ALTER COLUMN status SET DEFAULT 'missing',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.obligation_instances
  DROP CONSTRAINT IF EXISTS obligation_instances_subject_kind_chk;
ALTER TABLE public.obligation_instances
  ADD CONSTRAINT obligation_instances_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

ALTER TABLE public.obligation_instances
  DROP CONSTRAINT IF EXISTS obligation_instances_subject_shape_chk;
ALTER TABLE public.obligation_instances
  ADD CONSTRAINT obligation_instances_subject_shape_chk
  CHECK (
    (subject_kind = 'org' AND subject_id IS NULL)
    OR (subject_kind IN ('staff', 'client', 'site') AND subject_id IS NOT NULL)
  );

ALTER TABLE public.obligation_instances
  DROP CONSTRAINT IF EXISTS obligation_instances_status_chk;
ALTER TABLE public.obligation_instances
  ADD CONSTRAINT obligation_instances_status_chk
  CHECK (status IN ('missing', 'due', 'complete', 'waived'));

CREATE UNIQUE INDEX IF NOT EXISTS obligation_instances_person_period_uidx
  ON public.obligation_instances (
    organization_id,
    requirement_key,
    subject_kind,
    subject_id,
    COALESCE(period_key, '')
  )
  WHERE subject_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obligation_instances_org_period_uidx
  ON public.obligation_instances (
    organization_id,
    requirement_key,
    subject_kind,
    COALESCE(period_key, '')
  )
  WHERE subject_id IS NULL;

CREATE INDEX IF NOT EXISTS obligation_instances_org_status_due_idx
  ON public.obligation_instances (organization_id, status, due_at);

CREATE INDEX IF NOT EXISTS obligation_instances_org_key_idx
  ON public.obligation_instances (organization_id, requirement_key);

COMMENT ON TABLE public.obligation_instances IS
  'Phase 1 unified clocks/shelf rows. Not wired to production reads. Distinct from company_obligation_instances.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_instances TO authenticated;
GRANT ALL ON public.obligation_instances TO service_role;

ALTER TABLE public.obligation_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obligation_instances_select_member ON public.obligation_instances;
CREATE POLICY obligation_instances_select_member
  ON public.obligation_instances
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS obligation_instances_write_admin ON public.obligation_instances;
CREATE POLICY obligation_instances_write_admin
  ON public.obligation_instances
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP TRIGGER IF EXISTS obligation_instances_set_updated_at ON public.obligation_instances;
CREATE TRIGGER obligation_instances_set_updated_at
  BEFORE UPDATE ON public.obligation_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── obligation_instance_assignees ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.obligation_instance_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.obligation_instances (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL,
  staff_name text,
  staff_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, staff_id)
);

ALTER TABLE public.obligation_instance_assignees
  ADD COLUMN IF NOT EXISTS staff_name text,
  ADD COLUMN IF NOT EXISTS staff_role text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.obligation_instance_assignees
  ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS obligation_instance_assignees_org_idx
  ON public.obligation_instance_assignees (organization_id);

CREATE INDEX IF NOT EXISTS obligation_instance_assignees_staff_idx
  ON public.obligation_instance_assignees (staff_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_instance_assignees TO authenticated;
GRANT ALL ON public.obligation_instance_assignees TO service_role;

ALTER TABLE public.obligation_instance_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obligation_instance_assignees_select_member
  ON public.obligation_instance_assignees;
CREATE POLICY obligation_instance_assignees_select_member
  ON public.obligation_instance_assignees
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS obligation_instance_assignees_write_admin
  ON public.obligation_instance_assignees;
CREATE POLICY obligation_instance_assignees_write_admin
  ON public.obligation_instance_assignees
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

-- ── file_records ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.file_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.obligation_instances (id) ON DELETE SET NULL,
  subject_kind text NOT NULL,
  subject_id uuid,
  requirement_key text,
  storage_bucket text NOT NULL DEFAULT 'obligation-evidence',
  storage_path text NOT NULL,
  filename text,
  mime_type text,
  byte_size bigint,
  uploaded_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.file_records
  ADD COLUMN IF NOT EXISTS instance_id uuid,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS filename text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS byte_size bigint,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.file_records
  ALTER COLUMN storage_bucket SET DEFAULT 'obligation-evidence',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.file_records
  DROP CONSTRAINT IF EXISTS file_records_subject_kind_chk;
ALTER TABLE public.file_records
  ADD CONSTRAINT file_records_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

CREATE INDEX IF NOT EXISTS file_records_org_instance_idx
  ON public.file_records (organization_id, instance_id);

CREATE INDEX IF NOT EXISTS file_records_org_subject_idx
  ON public.file_records (organization_id, subject_kind, subject_id);

COMMENT ON TABLE public.file_records IS
  'Phase 1 evidence file refs for the unified register. Existing hr/client/audit cabinets stay.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_records TO authenticated;
GRANT ALL ON public.file_records TO service_role;

ALTER TABLE public.file_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_records_select_member ON public.file_records;
CREATE POLICY file_records_select_member
  ON public.file_records
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS file_records_write_admin ON public.file_records;
CREATE POLICY file_records_write_admin
  ON public.file_records
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR uploaded_by = auth.uid()
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR uploaded_by = auth.uid()
  );

-- Optional evidence pointer on instances (added after file_records exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obligation_instances_evidence_file_id_fkey'
  ) THEN
    ALTER TABLE public.obligation_instances
      ADD CONSTRAINT obligation_instances_evidence_file_id_fkey
      FOREIGN KEY (evidence_file_id) REFERENCES public.file_records (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ── attestations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.obligation_instances (id) ON DELETE SET NULL,
  subject_kind text NOT NULL,
  subject_id uuid,
  requirement_key text,
  attested_by uuid NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now(),
  attestation_text_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attestations
  ADD COLUMN IF NOT EXISTS instance_id uuid,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS attested_by uuid,
  ADD COLUMN IF NOT EXISTS attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS attestation_text_snapshot text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.attestations
  ALTER COLUMN attested_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.attestations
  DROP CONSTRAINT IF EXISTS attestations_subject_kind_chk;
ALTER TABLE public.attestations
  ADD CONSTRAINT attestations_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

CREATE INDEX IF NOT EXISTS attestations_org_instance_idx
  ON public.attestations (organization_id, instance_id);

CREATE INDEX IF NOT EXISTS attestations_org_subject_idx
  ON public.attestations (organization_id, subject_kind, subject_id);

COMMENT ON TABLE public.attestations IS
  'Human attestations for the unified register. Nectar never auto-publishes these.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attestations TO authenticated;
GRANT ALL ON public.attestations TO service_role;

ALTER TABLE public.attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attestations_select_member ON public.attestations;
CREATE POLICY attestations_select_member
  ON public.attestations
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS attestations_write_member ON public.attestations;
CREATE POLICY attestations_write_member
  ON public.attestations
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR attested_by = auth.uid()
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR attested_by = auth.uid()
  );

-- ── training_runs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.obligation_instances (id) ON DELETE SET NULL,
  subject_kind text NOT NULL DEFAULT 'staff',
  subject_id uuid NOT NULL,
  requirement_key text,
  source_system text NOT NULL DEFAULT 'unwired',
  course_key text,
  started_at timestamptz,
  completed_at timestamptz,
  score numeric,
  passed boolean,
  evidence_file_id uuid REFERENCES public.file_records (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_runs
  ADD COLUMN IF NOT EXISTS instance_id uuid,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS course_key text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS passed boolean,
  ADD COLUMN IF NOT EXISTS evidence_file_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.training_runs
  ALTER COLUMN subject_kind SET DEFAULT 'staff',
  ALTER COLUMN source_system SET DEFAULT 'unwired',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.training_runs
  DROP CONSTRAINT IF EXISTS training_runs_subject_kind_chk;
ALTER TABLE public.training_runs
  ADD CONSTRAINT training_runs_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

ALTER TABLE public.training_runs
  DROP CONSTRAINT IF EXISTS training_runs_source_system_chk;
ALTER TABLE public.training_runs
  ADD CONSTRAINT training_runs_source_system_chk
  CHECK (source_system IN (
    'unwired',
    'in_hive',
    'hive_training',
    'external',
    'manual_entry'
  ));

CREATE INDEX IF NOT EXISTS training_runs_org_subject_idx
  ON public.training_runs (organization_id, subject_id, requirement_key);

CREATE INDEX IF NOT EXISTS training_runs_org_instance_idx
  ON public.training_runs (organization_id, instance_id);

COMMENT ON TABLE public.training_runs IS
  'Phase 1 unified training attempt/completion. LMS content tables stay. Not wired.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_runs TO authenticated;
GRANT ALL ON public.training_runs TO service_role;

ALTER TABLE public.training_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_runs_select_member ON public.training_runs;
CREATE POLICY training_runs_select_member
  ON public.training_runs
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR subject_id = auth.uid()
  );

DROP POLICY IF EXISTS training_runs_write_admin ON public.training_runs;
CREATE POLICY training_runs_write_admin
  ON public.training_runs
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR subject_id = auth.uid()
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR subject_id = auth.uid()
  );

DROP TRIGGER IF EXISTS training_runs_set_updated_at ON public.training_runs;
CREATE TRIGGER training_runs_set_updated_at
  BEFORE UPDATE ON public.training_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── reviews ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.obligation_instances (id) ON DELETE SET NULL,
  subject_kind text NOT NULL,
  subject_id uuid,
  requirement_key text,
  review_kind text NOT NULL DEFAULT 'human',
  status text NOT NULL DEFAULT 'open',
  reviewer_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS instance_id uuid,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS review_kind text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.reviews
  ALTER COLUMN review_kind SET DEFAULT 'human',
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_subject_kind_chk;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_kind_chk;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_kind_chk
  CHECK (review_kind IN ('nectar_advisory', 'human', 'audit'));

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_status_chk;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_status_chk
  CHECK (status IN ('open', 'in_review', 'accepted', 'rejected', 'withdrawn'));

CREATE INDEX IF NOT EXISTS reviews_org_instance_idx
  ON public.reviews (organization_id, instance_id);

CREATE INDEX IF NOT EXISTS reviews_org_status_idx
  ON public.reviews (organization_id, status);

COMMENT ON TABLE public.reviews IS
  'Advisory/human/audit reviews. Nectar drafts stay marked; humans attest.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select_member ON public.reviews;
CREATE POLICY reviews_select_member
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS reviews_write_admin ON public.reviews;
CREATE POLICY reviews_write_admin
  ON public.reviews
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP TRIGGER IF EXISTS reviews_set_updated_at ON public.reviews;
CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── requirement_applicability (optional cache) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.requirement_applicability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  subject_kind text NOT NULL,
  subject_id uuid,
  applies boolean NOT NULL,
  unanswered boolean NOT NULL DEFAULT false,
  gate_fact_key text,
  source text NOT NULL DEFAULT 'computed',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requirement_applicability
  ADD COLUMN IF NOT EXISTS requirement_key text,
  ADD COLUMN IF NOT EXISTS subject_kind text,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS applies boolean,
  ADD COLUMN IF NOT EXISTS unanswered boolean,
  ADD COLUMN IF NOT EXISTS gate_fact_key text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.requirement_applicability
  ALTER COLUMN unanswered SET DEFAULT false,
  ALTER COLUMN source SET DEFAULT 'computed',
  ALTER COLUMN computed_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.requirement_applicability
  DROP CONSTRAINT IF EXISTS requirement_applicability_subject_kind_chk;
ALTER TABLE public.requirement_applicability
  ADD CONSTRAINT requirement_applicability_subject_kind_chk
  CHECK (subject_kind IN ('staff', 'client', 'org', 'site'));

ALTER TABLE public.requirement_applicability
  DROP CONSTRAINT IF EXISTS requirement_applicability_source_chk;
ALTER TABLE public.requirement_applicability
  ADD CONSTRAINT requirement_applicability_source_chk
  CHECK (source IN ('computed', 'override'));

CREATE UNIQUE INDEX IF NOT EXISTS requirement_applicability_person_uidx
  ON public.requirement_applicability (
    organization_id, requirement_key, subject_kind, subject_id
  )
  WHERE subject_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS requirement_applicability_org_uidx
  ON public.requirement_applicability (
    organization_id, requirement_key, subject_kind
  )
  WHERE subject_id IS NULL;

CREATE INDEX IF NOT EXISTS requirement_applicability_org_idx
  ON public.requirement_applicability (organization_id);

COMMENT ON TABLE public.requirement_applicability IS
  'Optional applicability cache. Distinct from obligation_applicability. Unwired.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_applicability TO authenticated;
GRANT ALL ON public.requirement_applicability TO service_role;

ALTER TABLE public.requirement_applicability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requirement_applicability_select_member
  ON public.requirement_applicability;
CREATE POLICY requirement_applicability_select_member
  ON public.requirement_applicability
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS requirement_applicability_write_admin
  ON public.requirement_applicability;
CREATE POLICY requirement_applicability_write_admin
  ON public.requirement_applicability
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP TRIGGER IF EXISTS requirement_applicability_set_updated_at
  ON public.requirement_applicability;
CREATE TRIGGER requirement_applicability_set_updated_at
  BEFORE UPDATE ON public.requirement_applicability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
