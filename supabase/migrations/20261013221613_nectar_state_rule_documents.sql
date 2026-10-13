-- Nectar rebuild N3: state rules, loaded by PI once for every agency
-- (Decisions 6 and 7). No organization. Any active member of any agency reads
-- the published ones; only hive executives add or change them. Archive, never
-- delete: a new version gets a new row and the old one gets archived_at.

create or replace function public.is_any_org_member(_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.organization_members
    where user_id = _user and active
  );
$$;

revoke all on function public.is_any_org_member(uuid) from public, anon;
grant execute on function public.is_any_org_member(uuid) to authenticated, service_role;

create table if not exists public.state_rule_documents (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  title text not null,
  effective_from date,
  raw_text text not null default '',
  version integer not null default 1,
  file_name text,
  storage_bucket text,
  storage_path text,
  source_document_id uuid references public.nectar_documents (id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.state_rule_documents is
  'State rules loaded by PI for every agency (Nectar rebuild N3). rule_key ties the versions of one rule together; the current version has archived_at null.';

create unique index if not exists state_rule_documents_one_current
  on public.state_rule_documents (rule_key)
  where archived_at is null;
create unique index if not exists state_rule_documents_rule_version
  on public.state_rule_documents (rule_key, version);

create trigger trg_state_rule_documents_updated
  before update on public.state_rule_documents
  for each row execute function public.set_updated_at();

alter table public.state_rule_documents enable row level security;

create policy "members read published state rules"
  on public.state_rule_documents
  for select
  to authenticated
  using (
    (published_at is not null and public.is_any_org_member(auth.uid()))
    or public.is_hive_executive(auth.uid())
  );

create policy "hive execs add state rules"
  on public.state_rule_documents
  for insert
  to authenticated
  with check (public.is_hive_executive(auth.uid()));

create policy "hive execs update state rules"
  on public.state_rule_documents
  for update
  to authenticated
  using (public.is_hive_executive(auth.uid()))
  with check (public.is_hive_executive(auth.uid()));

-- Seed: copy the DHHS91172 Scope of Work text from the existing state_sow
-- document. The original row is not moved, changed or deleted. Its stored
-- text is complete (259,223 characters, ending with the last section), so no
-- re-extraction is needed; the storage path is kept so the indexer can
-- re-read the file if a stored text is ever found cut at 50,000 characters.
insert into public.state_rule_documents (
  rule_key, title, effective_from, raw_text, version,
  file_name, storage_bucket, storage_path, source_document_id, published_at
)
select 'dhhs91172-sow',
       'DHHS91172 Scope of Work',
       date '2026-07-01',
       d.raw_text,
       1,
       d.file_name,
       d.storage_bucket,
       d.storage_path,
       d.id,
       now()
  from public.nectar_documents d
 where d.authoritative_kind = 'state_sow'
   and coalesce(length(d.raw_text), 0) > 0
 order by d.is_current desc, d.created_at desc
 limit 1
on conflict do nothing;
