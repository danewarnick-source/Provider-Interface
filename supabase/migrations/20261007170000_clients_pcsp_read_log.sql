-- One row per PCSP read (Add client "Start from their PCSP" and Upload PCSP in
-- Plans), so a slow or failed read can be looked up later. No PHI: no client,
-- no names, no PIDs, no PCSP text — only the organization, who read it, when,
-- how long it took, page count, how many goals, which service codes were ours,
-- which sections Nectar read, and an error kind ("timeout", "not_pdf", …).
-- Additive only.

CREATE TABLE IF NOT EXISTS public.pcsp_read_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  read_by uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('new_client', 'plans')),
  page_count integer,
  goals_found integer,
  codes_found text[] NOT NULL DEFAULT '{}'::text[],
  nectar_sections text[] NOT NULL DEFAULT '{}'::text[],
  duration_ms integer NOT NULL DEFAULT 0,
  error_kind text
);

CREATE INDEX IF NOT EXISTS pcsp_read_log_org_read_at_idx
  ON public.pcsp_read_log (organization_id, read_at DESC);

ALTER TABLE public.pcsp_read_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read pcsp read log" ON public.pcsp_read_log
  FOR SELECT TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()));

CREATE POLICY "members log their own pcsp reads" ON public.pcsp_read_log
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()) AND read_by = auth.uid());

GRANT SELECT, INSERT ON public.pcsp_read_log TO authenticated;
