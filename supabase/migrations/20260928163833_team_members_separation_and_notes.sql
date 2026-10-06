-- Team member profile rebuild: separation details on the membership, and
-- private staff notes. Additive only (safe for main before merge).

-- 1. Separation details. Deactivate writes them; Reactivate clears them.
--    Per agency (organization_members), never on profiles.
alter table public.organization_members
  add column if not exists end_date date,
  add column if not exists separation_reason text,
  add column if not exists rehire_eligible boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organization_members_separation_reason_check'
      and conrelid = 'public.organization_members'::regclass
  ) then
    alter table public.organization_members
      add constraint organization_members_separation_reason_check
      check (separation_reason in ('resigned', 'let_go', 'contract_ended', 'other'));
  end if;
end $$;

-- 2. Private notes about a team member. Append-only: no update or delete.
create table if not exists public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  staff_id uuid not null,
  author_id uuid not null,
  kind text not null check (kind in ('note', 'praise', 'concern')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists staff_notes_org_staff_created_idx
  on public.staff_notes (organization_id, staff_id, created_at desc);

alter table public.staff_notes enable row level security;

drop policy if exists staff_notes_select on public.staff_notes;
create policy staff_notes_select on public.staff_notes
  for select to authenticated
  using (public.access_has_category(organization_id, auth.uid(), 'staff_hiring', 'view'));

drop policy if exists staff_notes_insert on public.staff_notes;
create policy staff_notes_insert on public.staff_notes
  for insert to authenticated
  with check (
    public.access_has_category(organization_id, auth.uid(), 'staff_hiring', 'edit')
    and author_id = auth.uid()
  );

revoke update, delete on public.staff_notes from authenticated;
revoke update, delete on public.staff_notes from anon;
