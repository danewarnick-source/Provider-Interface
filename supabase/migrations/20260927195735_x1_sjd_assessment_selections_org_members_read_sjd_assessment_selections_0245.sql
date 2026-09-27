-- X-1: remove Hive exec (is_hive_executive) clause from public.sjd_assessment_selections "org members read sjd assessment selections".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "org members read sjd assessment selections" ON public.sjd_assessment_selections;

CREATE POLICY "org members read sjd assessment selections"
  ON public.sjd_assessment_selections
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
