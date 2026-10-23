-- Clients rebuild P4: PCSP data in the shape DSPD uses.
--   plan year (client_plans) → goals (client_goals) → supports (client_goal_supports)
--   → the service codes paid to our agency (client_goal_supports.our_codes).
-- Additive only: clients.pcsp_goals / plan_year / pcsp_* and
-- client_specific_trainings.goals stay (production main still reads them)
-- until Prompt 12.

-- ---------------------------------------------------------------------------
-- Plan years
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- Nullable: migrated plans whose old record only had a year label.
  start_date date,
  end_date date,
  activated_on date,
  meeting_date date,
  status text NOT NULL DEFAULT 'current'
    CHECK (status IN ('upcoming','current','ended','past')),
  -- The old free-text plan_year label, kept so nothing is lost on migration.
  label text,
  document_id uuid REFERENCES public.client_documents(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('pcsp_upload','manual','migrated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_plans_one_current_per_client
  ON public.client_plans (client_id) WHERE status = 'current';
CREATE INDEX IF NOT EXISTS client_plans_client_idx
  ON public.client_plans (client_id, start_date DESC);
CREATE INDEX IF NOT EXISTS client_plans_org_idx
  ON public.client_plans (organization_id);

-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.client_plans(id) ON DELETE CASCADE,
  carried_from_goal_id uuid REFERENCES public.client_goals(id) ON DELETE SET NULL,
  goal_text text NOT NULL CHECK (btrim(goal_text) <> ''),
  domain text,
  current_status text,
  strengths text,
  barriers text,
  success_person text,
  success_team text,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS client_goals_plan_idx ON public.client_goals (plan_id, sort);
CREATE INDEX IF NOT EXISTS client_goals_client_idx ON public.client_goals (client_id);
CREATE INDEX IF NOT EXISTS client_goals_org_idx ON public.client_goals (organization_id);

-- ---------------------------------------------------------------------------
-- Supports (one goal has many; each lists the codes that pay us for it)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_goal_supports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.client_goals(id) ON DELETE CASCADE,
  -- May be blank on migrated rows whose old goal had no support written.
  support_text text NOT NULL DEFAULT '',
  details text,
  start_date date,
  end_date date,
  our_codes text[] NOT NULL DEFAULT '{}',
  other_providers jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(other_providers) = 'array'),
  health_needs text[] NOT NULL DEFAULT '{}',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_goal_supports_goal_idx
  ON public.client_goal_supports (goal_id, sort);
CREATE INDEX IF NOT EXISTS client_goal_supports_codes_idx
  ON public.client_goal_supports USING gin (our_codes);
CREATE INDEX IF NOT EXISTS client_goal_supports_org_idx
  ON public.client_goal_supports (organization_id);

-- ---------------------------------------------------------------------------
-- RLS. Read: Clients: View on a client the caller can see, or staff assigned
-- to the client (same PHI rule as client_contacts). Write: Clients: Edit.
-- No DELETE policies: goals/supports are ended, plans become 'past'.
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_goal_supports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.client_goal_client(_goal uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT client_id FROM public.client_goals WHERE id = _goal $$;

CREATE POLICY "read client plans" ON public.client_plans
  FOR SELECT TO authenticated
  USING (
    public.access_can_see_client(client_id, auth.uid())
    OR (public.is_org_member(organization_id, auth.uid()) AND public.can_access_client_phi(client_id))
  );
CREATE POLICY "clients editors insert client plans" ON public.client_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  );
CREATE POLICY "clients editors update client plans" ON public.client_plans
  FOR UPDATE TO authenticated
  USING (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  )
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  );

CREATE POLICY "read client goals" ON public.client_goals
  FOR SELECT TO authenticated
  USING (
    public.access_can_see_client(client_id, auth.uid())
    OR (public.is_org_member(organization_id, auth.uid()) AND public.can_access_client_phi(client_id))
  );
CREATE POLICY "clients editors insert client goals" ON public.client_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  );
CREATE POLICY "clients editors update client goals" ON public.client_goals
  FOR UPDATE TO authenticated
  USING (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  )
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  );

CREATE POLICY "read client goal supports" ON public.client_goal_supports
  FOR SELECT TO authenticated
  USING (
    public.access_can_see_client(public.client_goal_client(goal_id), auth.uid())
    OR (public.is_org_member(organization_id, auth.uid())
        AND public.can_access_client_phi(public.client_goal_client(goal_id)))
  );
CREATE POLICY "clients editors insert client goal supports" ON public.client_goal_supports
  FOR INSERT TO authenticated
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(public.client_goal_client(goal_id), auth.uid())
  );
CREATE POLICY "clients editors update client goal supports" ON public.client_goal_supports
  FOR UPDATE TO authenticated
  USING (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(public.client_goal_client(goal_id), auth.uid())
  )
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(public.client_goal_client(goal_id), auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Notes and summaries point at the goal/support they address.
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS goal_ids uuid[],
  ADD COLUMN IF NOT EXISTS support_ids uuid[];
ALTER TABLE public.evv_timesheets
  ADD COLUMN IF NOT EXISTS goal_ids uuid[],
  ADD COLUMN IF NOT EXISTS support_ids uuid[];
ALTER TABLE public.client_progress_summaries
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.client_plans(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Backfill. Mirrors legacyPlanForClient() / legacyGoalsForClient() in
-- src/lib/clients/legacy-fields.ts. Only clients with no plan yet are touched,
-- so re-running is a no-op.
-- ---------------------------------------------------------------------------
WITH src AS (
  SELECT c.id AS client_id, c.organization_id, nullif(btrim(c.plan_year), '') AS label,
         c.pcsp_expiration_date AS exp,
         regexp_match(c.plan_year,
           '^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*-\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$') AS m
  FROM public.clients c
  WHERE NOT EXISTS (SELECT 1 FROM public.client_plans p WHERE p.client_id = c.id)
),
dated AS (
  SELECT client_id, organization_id, label,
    CASE
      WHEN m IS NOT NULL THEN make_date(m[3]::int, m[1]::int, m[2]::int)
      WHEN exp IS NOT NULL THEN (exp - interval '1 year' + interval '1 day')::date
    END AS start_date,
    CASE
      WHEN m IS NOT NULL THEN make_date(m[6]::int, m[4]::int, m[5]::int)
      ELSE exp
    END AS end_date
  FROM src
)
INSERT INTO public.client_plans (organization_id, client_id, start_date, end_date, status, label, source)
SELECT organization_id, client_id, start_date, end_date,
  CASE
    WHEN start_date IS NOT NULL AND start_date > current_date THEN 'upcoming'
    WHEN end_date IS NOT NULL AND end_date < current_date THEN 'ended'
    ELSE 'current'
  END,
  label, 'migrated'
FROM dated;

-- Goals: the client's training-record goals (person_specific first, then the
-- most recently updated record that has any), else the flat pcsp_goals list.
WITH plan AS (
  SELECT p.id AS plan_id, p.client_id, p.organization_id
  FROM public.client_plans p
  WHERE p.source = 'migrated'
    AND NOT EXISTS (SELECT 1 FROM public.client_goals g WHERE g.plan_id = p.id)
),
cst AS (
  SELECT DISTINCT ON (t.client_id) t.client_id, t.goals
  FROM public.client_specific_trainings t
  WHERE jsonb_typeof(t.goals) = 'array' AND jsonb_array_length(t.goals) > 0
  ORDER BY t.client_id, (t.training_type = 'person_specific') DESC, t.updated_at DESC NULLS LAST
),
active_codes AS (
  SELECT b.client_id, array_agg(DISTINCT upper(btrim(b.service_code)) ORDER BY upper(btrim(b.service_code))) AS codes
  FROM public.client_billing_codes b
  WHERE (b.service_end_date IS NULL OR b.service_end_date >= current_date - 1)
    AND nullif(btrim(b.service_code), '') IS NOT NULL
  GROUP BY b.client_id
),
legacy AS (
  SELECT plan.plan_id, plan.client_id, plan.organization_id,
         btrim(e.value ->> 'goal') AS goal_text,
         nullif(btrim(coalesce(e.value ->> 'supports', '')), '') AS support_text,
         nullif(btrim(coalesce(e.value ->> 'details', '')), '') AS details,
         (SELECT coalesce(array_agg(DISTINCT upper(btrim(j))) FILTER (WHERE nullif(btrim(j), '') IS NOT NULL), '{}')
            FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(e.value -> 'job_codes') = 'array' THEN e.value -> 'job_codes' ELSE '[]'::jsonb END) j
         ) AS job_codes,
         (e.ordinality - 1)::int AS sort
  FROM plan
  JOIN cst ON cst.client_id = plan.client_id
  CROSS JOIN LATERAL jsonb_array_elements(cst.goals) WITH ORDINALITY e
  WHERE jsonb_typeof(e.value) = 'object' AND nullif(btrim(e.value ->> 'goal'), '') IS NOT NULL
  UNION ALL
  SELECT plan.plan_id, plan.client_id, plan.organization_id,
         btrim(f.g), NULL, NULL, '{}'::text[], (f.ordinality - 1)::int
  FROM plan
  JOIN public.clients c ON c.id = plan.client_id
  CROSS JOIN LATERAL unnest(c.pcsp_goals) WITH ORDINALITY f(g, ordinality)
  WHERE NOT EXISTS (SELECT 1 FROM cst WHERE cst.client_id = plan.client_id)
    AND nullif(btrim(f.g), '') IS NOT NULL
),
ins_goals AS (
  INSERT INTO public.client_goals (organization_id, client_id, plan_id, goal_text, sort)
  SELECT organization_id, client_id, plan_id, goal_text, sort FROM legacy
  RETURNING id, plan_id, sort, organization_id, client_id
)
INSERT INTO public.client_goal_supports (organization_id, goal_id, support_text, details, our_codes, sort)
SELECT g.organization_id, g.id, coalesce(l.support_text, ''), l.details,
       CASE WHEN cardinality(l.job_codes) > 0 THEN l.job_codes ELSE coalesce(ac.codes, '{}') END,
       0
FROM ins_goals g
JOIN legacy l ON l.plan_id = g.plan_id AND l.sort = g.sort
LEFT JOIN active_codes ac ON ac.client_id = g.client_id;
