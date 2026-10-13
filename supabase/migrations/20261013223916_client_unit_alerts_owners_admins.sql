-- "I sent it" (client_unit_alerts) is for Owners and Admins with Billing: Edit
-- only, on clients they can see. Before, any Billing editor could record it,
-- and an agency-wide Admin could record it without Billing: Edit. Reading the
-- record is unchanged. Reads organization_members.access_level only.

alter policy client_unit_alerts_insert on public.client_unit_alerts
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = client_unit_alerts.organization_id
        and m.user_id = auth.uid()
        and m.active
        and m.access_level in ('owner', 'admin')
    )
    and public.access_has_category(organization_id, auth.uid(), 'billing', 'edit')
    and public.access_can_see_client(client_id, auth.uid())
  );

alter policy client_unit_alerts_update on public.client_unit_alerts
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = client_unit_alerts.organization_id
        and m.user_id = auth.uid()
        and m.active
        and m.access_level in ('owner', 'admin')
    )
    and public.access_has_category(organization_id, auth.uid(), 'billing', 'edit')
    and public.access_can_see_client(client_id, auth.uid())
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = client_unit_alerts.organization_id
        and m.user_id = auth.uid()
        and m.active
        and m.access_level in ('owner', 'admin')
    )
    and public.access_has_category(organization_id, auth.uid(), 'billing', 'edit')
    and public.access_can_see_client(client_id, auth.uid())
  );
