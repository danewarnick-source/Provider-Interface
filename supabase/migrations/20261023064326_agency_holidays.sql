-- B2: the agency's paid holidays and their rate (Settings › Pay › Holidays).
-- pay_multiplier null = "Not paid extra".
CREATE TABLE public.agency_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  holiday_date date NOT NULL,
  pay_multiplier numeric CHECK (pay_multiplier IS NULL OR pay_multiplier >= 1),
  UNIQUE (organization_id, holiday_date)
);
ALTER TABLE public.agency_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_holidays_read ON public.agency_holidays FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
CREATE POLICY agency_holidays_owner_write ON public.agency_holidays FOR ALL TO authenticated
  USING (access_is_owner(organization_id, auth.uid())) WITH CHECK (access_is_owner(organization_id, auth.uid()));
