-- Clients rebuild P10: do-not-schedule staff and office notes (additive only).
--
-- client_staff_exclusions: a team member who must never be scheduled with
--   this client, and why. Lifted exclusions are ended (ended_at), never
--   deleted. At most one open exclusion per client + team member.
-- client_notes: office-only notes about the client. Archived, never deleted.
-- RLS: writes need Clients: Edit on a client the user can see. Exclusions are
--   readable with Clients: View; notes only with Clients: Edit.
-- active_client_staff_exclusions(_org, _client): what the scheduler and the
--   caseload writer check. SECURITY DEFINER so a scheduler without Clients
--   access is still refused (and told why); callable by org members only.

create table if not exists public.client_staff_exclusions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  ended_at timestamptz,
  ended_by uuid
);
create unique index if not exists client_staff_exclusions_open_uniq
  on public.client_staff_exclusions (client_id, staff_user_id) where ended_at is null;
create index if not exists client_staff_exclusions_org_idx
  on public.client_staff_exclusions (organization_id) where ended_at is null;

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  archived_at timestamptz,
  archived_by uuid
);
create index if not exists client_notes_client_idx
  on public.client_notes (client_id, created_at desc);

alter table public.client_staff_exclusions enable row level security;
alter table public.client_notes enable row level security;

drop policy if exists "clients viewers read staff exclusions" on public.client_staff_exclusions;
create policy "clients viewers read staff exclusions" on public.client_staff_exclusions
  for select using (
    access_has_category(organization_id, auth.uid(), 'clients', 'view')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "clients editors insert staff exclusions" on public.client_staff_exclusions;
create policy "clients editors insert staff exclusions" on public.client_staff_exclusions
  for insert with check (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "clients editors update staff exclusions" on public.client_staff_exclusions;
create policy "clients editors update staff exclusions" on public.client_staff_exclusions
  for update using (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  ) with check (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );

drop policy if exists "clients editors read notes" on public.client_notes;
create policy "clients editors read notes" on public.client_notes
  for select using (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "clients editors insert notes" on public.client_notes;
create policy "clients editors insert notes" on public.client_notes
  for insert with check (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "clients editors update notes" on public.client_notes;
create policy "clients editors update notes" on public.client_notes
  for update using (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  ) with check (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
-- No DELETE policies: exclusions are ended and notes archived, never deleted.

create or replace function public.active_client_staff_exclusions(_org uuid, _client uuid default null)
returns table (client_id uuid, staff_user_id uuid, reason text)
language sql
stable
security definer
set search_path = public
as $$
  select e.client_id, e.staff_user_id, e.reason
  from public.client_staff_exclusions e
  where e.organization_id = _org
    and e.ended_at is null
    and (_client is null or e.client_id = _client)
    and public.is_org_member(_org, auth.uid());
$$;
revoke all on function public.active_client_staff_exclusions(uuid, uuid) from public, anon;
grant execute on function public.active_client_staff_exclusions(uuid, uuid) to authenticated, service_role;
