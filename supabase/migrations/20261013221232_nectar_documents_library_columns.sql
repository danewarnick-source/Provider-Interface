-- Nectar rebuild N3: library fields on nectar_documents (Decisions 1, 2, 5).
-- Additive only: new columns, a parse status for files with no readable text,
-- and a backfill of the existing company documents.
--
-- Versions keep using version / parent_document_id / superseded_by /
-- superseded_at. Who it's for: audience_all = true (all team members), or
-- false with policy_assigned_users holding the checked people's user ids.

alter table public.nectar_documents
  add column if not exists library_status text not null default 'draft',
  add column if not exists library_group text,
  add column if not exists required_slot text references public.required_policy_slots (id),
  add column if not exists owner_name text,
  add column if not exists review_due date,
  add column if not exists audience_all boolean not null default true;

alter table public.nectar_documents
  add constraint nectar_documents_library_status_check
    check (library_status in ('draft', 'published', 'archived')),
  add constraint nectar_documents_library_group_check
    check (library_group is null or library_group in ('agency', 'procedures', 'state', 'reference'));

comment on column public.nectar_documents.library_status is
  'Knowledge base status: draft, published or archived. Nectar and team members see only published library documents.';
comment on column public.nectar_documents.library_group is
  'Knowledge base group: agency (Agency policies), procedures (Procedures and forms), state (State rules), reference (Reference). Null = not a library document.';
comment on column public.nectar_documents.required_slot is
  'The required policy (required_policy_slots.id) this document fills, if any.';
comment on column public.nectar_documents.owner_name is 'Who owns this policy at the agency (free text).';
comment on column public.nectar_documents.review_due is 'Next review date for this version.';
comment on column public.nectar_documents.audience_all is
  'Who it''s for: true = all team members; false = only the people in policy_assigned_users.';

-- A file with no readable text is kept and shown as "No readable text".
-- Widens the existing check; every current value stays valid.
alter table public.nectar_documents drop constraint if exists nectar_documents_parse_status_check;
alter table public.nectar_documents
  add constraint nectar_documents_parse_status_check
    check (parse_status in ('pending', 'parsing', 'parsed', 'failed', 'skipped', 'no_text'));

create index if not exists idx_nectar_docs_library
  on public.nectar_documents (organization_id, library_group, library_status)
  where library_group is not null;

-- Backfill: existing company documents join the library as published, with a
-- review date one year after they were added. Group comes from the old
-- source kind: provider_policy -> agency, tool_template -> procedures,
-- anything else -> reference. (No archived or superseded company documents
-- exist today; the case keeps such rows archived if they ever do.)
update public.nectar_documents
   set library_group = case authoritative_kind
                         when 'provider_policy' then 'agency'
                         when 'tool_template' then 'procedures'
                         else 'reference'
                       end,
       library_status = case
                          when archived_at is not null or superseded_by is not null then 'archived'
                          else 'published'
                        end,
       review_due = (created_at + interval '1 year')::date
 where owner_kind = 'company'
   and library_group is null;
