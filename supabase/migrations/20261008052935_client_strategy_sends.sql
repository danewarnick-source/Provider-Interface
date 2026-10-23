-- Support strategies sent to the support coordinator, one live record per
-- PCSP plan (SOW §1.24(5)). Undo is a soft void (voided_at / voided_by);
-- a new plan year simply has no send yet, and older plans keep theirs.
create table if not exists public.client_strategy_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  plan_id uuid not null references public.client_plans(id),
  source text not null check (source in ('nectar', 'upload')),
  sent_on date not null,
  sent_to text,
  evidence_file_id uuid references public.evidence_files(id),
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid
);

create unique index if not exists client_strategy_sends_one_live_per_plan
  on public.client_strategy_sends (plan_id) where voided_at is null;
create index if not exists client_strategy_sends_org_client
  on public.client_strategy_sends (organization_id, client_id);

alter table public.client_strategy_sends enable row level security;

create policy client_strategy_sends_select on public.client_strategy_sends
  for select to authenticated
  using (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    or (public.is_org_member(organization_id, auth.uid())
        and public.access_can_see_client(client_id, auth.uid()))
  );

create policy client_strategy_sends_insert on public.client_strategy_sends
  for insert to authenticated
  with check (public.is_org_admin_or_manager(organization_id, auth.uid()));

create policy client_strategy_sends_update on public.client_strategy_sends
  for update to authenticated
  using (public.is_org_admin_or_manager(organization_id, auth.uid()))
  with check (public.is_org_admin_or_manager(organization_id, auth.uid()));

grant select, insert, update on public.client_strategy_sends to authenticated;
