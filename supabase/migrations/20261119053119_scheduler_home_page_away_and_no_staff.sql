-- B7 group home page (B7-PLAN.md, Dane chose full scope A on Nov 19).

-- Why a table: a client's recurring away schedule (day program, job, school, another
-- provider) has no home anywhere; when every resident of a home is away, those hours need
-- no staff. Owned by Clients (a fact about the person); never hard-deleted (archived_at).
CREATE TABLE public.client_away_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  weekday_mask smallint NOT NULL CHECK (weekday_mask > 0 AND weekday_mask < 128), -- Sunday = bit 0
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  label text NOT NULL CHECK (label IN ('day_program', 'job', 'school', 'other_provider', 'other')),
  note text,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_away_times_client_idx ON public.client_away_times (client_id) WHERE archived_at IS NULL;
ALTER TABLE public.client_away_times ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can see the client. Write: Clients edit on a client they can see,
-- in the same org. No delete policy (archive instead).
CREATE POLICY "client away times read" ON public.client_away_times FOR SELECT TO authenticated
  USING (public.access_can_see_client(client_id, auth.uid()) OR public.is_hive_executive(auth.uid()));
CREATE POLICY "client away times insert" ON public.client_away_times FOR INSERT TO authenticated
  WITH CHECK (public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_away_times.client_id
                AND c.organization_id = client_away_times.organization_id));
CREATE POLICY "client away times update" ON public.client_away_times FOR UPDATE TO authenticated
  USING (public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid()))
  WITH CHECK (public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid()));

-- Why: "no staff needed" is a staffing need of 0 staff; a one-time block needs its date.
-- NULL on_date = every week (as before).
ALTER TABLE public.location_coverage_requirements ADD COLUMN on_date date;
ALTER TABLE public.location_coverage_requirements
  ADD CONSTRAINT location_coverage_requirements_no_staff_needs_reason
  CHECK (required_staff_count > 0 OR nullif(btrim(coalesce(notes, '')), '') IS NOT NULL);
