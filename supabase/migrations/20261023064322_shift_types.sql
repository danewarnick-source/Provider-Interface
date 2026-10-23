-- B2: the agency's shift types (Settings › Shift types): default times, where
-- they're used, whether they count toward a home's coverage, and how they pay.
-- B3 offers them as time choices when adding a shift. Removing a type archives it.
CREATE TABLE public.shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text,                                 -- built-in types: day, eve, awake, asleep, paired, oncall, prog, transport, visit
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  color text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  start_time time NOT NULL,
  end_time time NOT NULL,                   -- at or before start_time = ends the next day
  used_at text[] NOT NULL CHECK (used_at <@ ARRAY['home', 'program', 'client']::text[] AND cardinality(used_at) > 0),
  counts_toward_coverage boolean NOT NULL DEFAULT true,
  pay_kind text NOT NULL DEFAULT 'normal' CHECK (pay_kind IN ('normal', 'sleep', 'stipend')),
  built_in boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (organization_id, key)
);
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_types_read ON public.shift_types FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
CREATE POLICY shift_types_owner_write ON public.shift_types FOR ALL TO authenticated
  USING (access_is_owner(organization_id, auth.uid())) WITH CHECK (access_is_owner(organization_id, auth.uid()));
