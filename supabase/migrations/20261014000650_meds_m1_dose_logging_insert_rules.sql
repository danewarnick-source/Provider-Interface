-- Meds rebuild M1 (audit): only the right staff log doses, and only for that
-- client's own medications. Before this, the INSERT rules on emar_logs,
-- controlled_med_counts and emar_log_addenda were just "agency member and
-- staff_id = self". Each rule is replaced in place (ALTER POLICY) so there is
-- never a moment without one. main's paths still pass: staff chart only for
-- clients they are assigned to or on shift with.

alter policy "members insert emar" on public.emar_logs
  with check (
    staff_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
    and public.can_log_client_meds(client_id, auth.uid())
    and public.medication_belongs_to_client(medication_id, client_id, organization_id)
  );
alter policy "members insert emar" on public.emar_logs rename to "loggers insert emar";

alter policy "members insert cmc" on public.controlled_med_counts
  with check (
    staff_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
    and public.can_log_client_meds(client_id, auth.uid())
    and public.medication_belongs_to_client(medication_id, client_id, organization_id)
  );
alter policy "members insert cmc" on public.controlled_med_counts rename to "loggers insert cmc";

alter policy "members insert addenda" on public.emar_log_addenda
  with check (
    staff_id = auth.uid()
    and exists (
      select 1 from public.emar_logs e
      where e.id = emar_log_id
        and e.organization_id = emar_log_addenda.organization_id
        and public.can_log_client_meds(e.client_id, auth.uid())
    )
  );
alter policy "members insert addenda" on public.emar_log_addenda rename to "loggers insert addenda";
