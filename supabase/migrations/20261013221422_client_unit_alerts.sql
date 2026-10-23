-- "Coordinator emailed" records for authorizations whose units are running
-- out (Services & billing). PI sends nothing: the user emails the support
-- coordinator from their own email app and ticks "I sent it". One live record
-- per authorization row; Undo is a soft void (voided_at / voided_by).
create table if not exists public.client_unit_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  billing_code_id uuid not null references public.client_billing_codes(id),
  service_code text not null,
  units_used numeric not null,
  units_total numeric not null,
  runout_on date,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid
);

create unique index if not exists client_unit_alerts_one_live_per_code
  on public.client_unit_alerts (billing_code_id) where voided_at is null;
create index if not exists client_unit_alerts_org_client
  on public.client_unit_alerts (organization_id, client_id);

alter table public.client_unit_alerts enable row level security;

create policy client_unit_alerts_select on public.client_unit_alerts
  for select to authenticated
  using (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    or (public.is_org_member(organization_id, auth.uid())
        and public.access_can_see_client(client_id, auth.uid()))
  );

create policy client_unit_alerts_insert on public.client_unit_alerts
  for insert to authenticated
  with check (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    or (public.access_has_category(organization_id, auth.uid(), 'billing', 'edit')
        and public.access_can_see_client(client_id, auth.uid()))
  );

create policy client_unit_alerts_update on public.client_unit_alerts
  for update to authenticated
  using (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    or (public.access_has_category(organization_id, auth.uid(), 'billing', 'edit')
        and public.access_can_see_client(client_id, auth.uid()))
  )
  with check (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    or (public.access_has_category(organization_id, auth.uid(), 'billing', 'edit')
        and public.access_can_see_client(client_id, auth.uid()))
  );

grant select, insert, update on public.client_unit_alerts to authenticated;
