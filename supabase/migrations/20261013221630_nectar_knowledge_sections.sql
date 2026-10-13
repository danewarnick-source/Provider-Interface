-- Nectar rebuild N3: the searchable sections Nectar answers from (Decision 8).
-- One row per section of a published library document version, a state rule
-- version, or (N7) a client document. Old versions' rows are kept and flagged
-- with retired_at instead of deleted.
--
-- A section is readable exactly when its source is readable: the select
-- policy checks the source row under the reader's own row-level security, so
-- library documents need published + meant for the reader (or an owner or
-- agency-wide admin), state rules need an active membership, and client
-- documents need access to that client.

create table if not exists public.knowledge_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  document_id uuid references public.nectar_documents (id) on delete cascade,
  state_document_id uuid references public.state_rule_documents (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  version integer not null,
  heading text,
  body text not null,
  position integer not null,
  tsv tsvector generated always as (
    to_tsvector('english'::regconfig, coalesce(heading, '') || ' ' || coalesce(body, ''))
  ) stored,
  embedding vector(1024),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint knowledge_sections_one_source check (
    (state_document_id is not null and document_id is null and organization_id is null and client_id is null)
    or (state_document_id is null and document_id is not null and organization_id is not null)
  )
);

comment on table public.knowledge_sections is
  'Sections Nectar searches (Nectar rebuild N3). organization_id is null for state rules. retired_at set = removed from search (archived or replaced version); rows are kept.';
comment on column public.knowledge_sections.embedding is 'Titan Text Embeddings v2, size 1024. Null until embedded.';

create index if not exists knowledge_sections_tsv_idx
  on public.knowledge_sections using gin (tsv);
create index if not exists knowledge_sections_embedding_idx
  on public.knowledge_sections using hnsw (embedding vector_cosine_ops);
create index if not exists knowledge_sections_org_doc_idx
  on public.knowledge_sections (organization_id, document_id);
create index if not exists knowledge_sections_state_doc_idx
  on public.knowledge_sections (state_document_id)
  where state_document_id is not null;
create index if not exists knowledge_sections_client_idx
  on public.knowledge_sections (client_id)
  where client_id is not null;

alter table public.knowledge_sections enable row level security;

create policy "sections readable with their source"
  on public.knowledge_sections
  for select
  to authenticated
  using (
    case
      when state_document_id is not null then exists (
        select 1 from public.state_rule_documents s
        where s.id = knowledge_sections.state_document_id
      )
      else exists (
        select 1 from public.nectar_documents d
        where d.id = knowledge_sections.document_id
          and d.organization_id = knowledge_sections.organization_id
      )
      and (client_id is null or public.can_access_client_phi(client_id))
    end
  );

create policy "admins add sections"
  on public.knowledge_sections
  for insert
  to authenticated
  with check (
    case
      when state_document_id is not null then public.is_hive_executive(auth.uid())
      else public.is_org_admin_or_manager(organization_id, auth.uid())
        and exists (
          select 1 from public.nectar_documents d
          where d.id = knowledge_sections.document_id
            and d.organization_id = knowledge_sections.organization_id
        )
    end
  );

create policy "admins update sections"
  on public.knowledge_sections
  for update
  to authenticated
  using (
    case
      when state_document_id is not null then public.is_hive_executive(auth.uid())
      else public.is_org_admin_or_manager(organization_id, auth.uid())
    end
  )
  with check (
    case
      when state_document_id is not null then public.is_hive_executive(auth.uid())
      else public.is_org_admin_or_manager(organization_id, auth.uid())
        and exists (
          select 1 from public.nectar_documents d
          where d.id = knowledge_sections.document_id
            and d.organization_id = knowledge_sections.organization_id
        )
    end
  );
