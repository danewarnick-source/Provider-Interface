-- Evidence Phase 1 — people × requirements tracker.
-- Idempotent. Do NOT drop or truncate. Dane reviews this in the PR, then
-- pastes it into Lovable's SQL editor (clear the editor first).
-- See docs/SQL_HANDOFF.md.
--
-- Required for Apply / upload / attest. The app does not fall back to
-- organizations.feature_config. Until this SQL is applied, the UI shows
-- a friendly “storage isn’t set up” message and does not write that column.

-- ── Assigned requirement rows ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('staff', 'client', 'company')),
  subject_id uuid NOT NULL,
  requirement_key text NOT NULL,
  title text NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('upload', 'attestation')),
  attestation_text text,
  cadence text NOT NULL DEFAULT 'once',
  sow_cite text,
  suggested boolean NOT NULL DEFAULT false,
  sent_to_staff boolean NOT NULL DEFAULT false,
  visible_to_staff_id uuid,
  dual_link_key text,
  dual_link_peer_id uuid,
  expires_on date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_org_subject_req_idx
  ON public.evidence_items (organization_id, subject_type, subject_id, requirement_key);

CREATE INDEX IF NOT EXISTS evidence_items_org_subject_idx
  ON public.evidence_items (organization_id, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS evidence_items_visible_staff_idx
  ON public.evidence_items (organization_id, visible_to_staff_id)
  WHERE sent_to_staff = true;

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence_items_select_org_member" ON public.evidence_items;
CREATE POLICY "evidence_items_select_org_member"
  ON public.evidence_items FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS "evidence_items_write_admin" ON public.evidence_items;
CREATE POLICY "evidence_items_write_admin"
  ON public.evidence_items FOR ALL TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR (sent_to_staff = true AND visible_to_staff_id = auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
    OR (sent_to_staff = true AND visible_to_staff_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_items TO authenticated;
GRANT ALL ON public.evidence_items TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS evidence_items_set_updated_at ON public.evidence_items;
    CREATE TRIGGER evidence_items_set_updated_at
      BEFORE UPDATE ON public.evidence_items
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── Uploads / attestations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.evidence_items(id) ON DELETE CASCADE,
  storage_path text,
  filename text,
  attested_at timestamptz,
  attested_by uuid,
  attestation_text_snapshot text,
  uploaded_by uuid,
  uploaded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_files_item_idx
  ON public.evidence_files (organization_id, item_id, created_at DESC);

ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence_files_select_org_member" ON public.evidence_files;
CREATE POLICY "evidence_files_select_org_member"
  ON public.evidence_files FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS "evidence_files_write_member" ON public.evidence_files;
CREATE POLICY "evidence_files_write_member"
  ON public.evidence_files FOR ALL TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_files TO authenticated;
GRANT ALL ON public.evidence_files TO service_role;

-- ── Saved pack templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('staff', 'client', 'company')),
  pack_keys text[] NOT NULL DEFAULT '{}',
  requirement_keys text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_templates_org_idx
  ON public.evidence_templates (organization_id, subject_type, created_at DESC);

ALTER TABLE public.evidence_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence_templates_select_org_member" ON public.evidence_templates;
CREATE POLICY "evidence_templates_select_org_member"
  ON public.evidence_templates FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

DROP POLICY IF EXISTS "evidence_templates_write_admin" ON public.evidence_templates;
CREATE POLICY "evidence_templates_write_admin"
  ON public.evidence_templates FOR ALL TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR public.is_hive_executive(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_templates TO authenticated;
GRANT ALL ON public.evidence_templates TO service_role;

-- ── Private uploads ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-files',
  'evidence-files',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "evidence_files_storage_select" ON storage.objects;
CREATE POLICY "evidence_files_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-files');

DROP POLICY IF EXISTS "evidence_files_storage_insert" ON storage.objects;
CREATE POLICY "evidence_files_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence-files');

DROP POLICY IF EXISTS "evidence_files_storage_update" ON storage.objects;
CREATE POLICY "evidence_files_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'evidence-files');

DROP POLICY IF EXISTS "evidence_files_storage_delete" ON storage.objects;
CREATE POLICY "evidence_files_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidence-files');
