-- Nectar rebuild N3: every question asked of Nectar (Decisions 8 and 9).
-- Unanswered questions and thumbs-down answers show in the admin Questions
-- tab. Never deleted; an admin marks them resolved.

create table if not exists public.nectar_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  asked_by uuid not null,
  asker_name text,
  scope text not null check (scope in ('admin', 'staff')),
  client_ids uuid[] not null default '{}',
  question text not null,
  answer text,
  cited_section_ids uuid[] not null default '{}',
  found boolean not null default false,
  feedback text check (feedback in ('up', 'down')),
  status text check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

comment on table public.nectar_questions is
  'Questions asked of Nectar (Nectar rebuild N3). asked_by and resolved_by are auth user ids.';
comment on column public.nectar_questions.status is
  'Questions tab: open = no answer found or marked not helpful; resolved = handled by an admin; null = answered and not flagged.';

create index if not exists nectar_questions_org_status_idx
  on public.nectar_questions (organization_id, status, created_at desc);
create index if not exists nectar_questions_asked_by_idx
  on public.nectar_questions (asked_by, created_at desc);

alter table public.nectar_questions enable row level security;

create policy "members log their own questions"
  on public.nectar_questions
  for insert
  to authenticated
  with check (asked_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

create policy "agency admins read questions"
  on public.nectar_questions
  for select
  to authenticated
  using (public.is_org_admin_or_manager(organization_id, auth.uid()));

create policy "members read their own questions"
  on public.nectar_questions
  for select
  to authenticated
  using (asked_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

create policy "agency admins update questions"
  on public.nectar_questions
  for update
  to authenticated
  using (public.is_org_admin_or_manager(organization_id, auth.uid()))
  with check (public.is_org_admin_or_manager(organization_id, auth.uid()));
