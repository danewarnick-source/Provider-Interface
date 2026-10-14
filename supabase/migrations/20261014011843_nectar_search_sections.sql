-- Nectar rebuild N5: one search over the sections the asker may read (Decisions 7 and 8).
--
-- askNectar passes the ids it computed from the caller's access (published
-- library documents meant for them, current state rules, clients in their
-- scope) and the question. This returns the best full-text matches (any of the
-- question's words, ranked) and the nearest embeddings among those sections
-- only, both from sections still in search (retired_at is null).
--
-- security invoker: called with a user's token, knowledge_sections row-level
-- security applies on top of the ids passed. The vector search is exact over
-- the allowed rows (no index), so a narrow scope never loses matches.

create or replace function public.nectar_search_sections(
  p_organization_id uuid,
  p_document_ids uuid[],
  p_state_document_ids uuid[],
  p_client_ids uuid[],
  p_query text,
  p_embedding text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  organization_id uuid,
  document_id uuid,
  state_document_id uuid,
  client_id uuid,
  version integer,
  heading text,
  body text,
  text_rank real,
  vector_similarity double precision
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with allowed as materialized (
    select s.id, s.organization_id, s.document_id, s.state_document_id, s.client_id,
           s.version, s.heading, s.body, s.tsv, s.embedding
    from public.knowledge_sections s
    where s.retired_at is null
      and (
        (s.state_document_id is not null
          and s.state_document_id = any (coalesce(p_state_document_ids, '{}'::uuid[])))
        or (s.organization_id = p_organization_id
          and s.client_id is null
          and s.document_id = any (coalesce(p_document_ids, '{}'::uuid[])))
        or (s.organization_id = p_organization_id
          and s.client_id is not null
          and s.client_id = any (coalesce(p_client_ids, '{}'::uuid[])))
      )
  ),
  q as (
    select nullif(
      replace(plainto_tsquery('english'::regconfig, coalesce(p_query, ''))::text, ' & ', ' | '),
      ''
    )::tsquery as tsq
  ),
  qv as (
    select p_embedding::vector as v
  ),
  by_text as (
    select a.id, ts_rank(a.tsv, q.tsq, 1) as text_rank
    from allowed a cross join q
    where q.tsq is not null and a.tsv @@ q.tsq
    order by text_rank desc, a.id
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  ),
  by_vector as (
    select a.id, 1 - (a.embedding <=> qv.v) as vector_similarity
    from allowed a cross join qv
    where qv.v is not null and a.embedding is not null
    order by a.embedding <=> qv.v, a.id
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  select a.id, a.organization_id, a.document_id, a.state_document_id, a.client_id,
         a.version, a.heading, a.body, t.text_rank, v.vector_similarity
  from allowed a
  left join by_text t on t.id = a.id
  left join by_vector v on v.id = a.id
  where t.id is not null or v.id is not null;
$$;

comment on function public.nectar_search_sections(uuid, uuid[], uuid[], uuid[], text, text, integer) is
  'Nectar rebuild N5: full-text and embedding matches among the knowledge_sections ids askNectar allows (security invoker, so RLS also applies). p_embedding is a 1024-number pgvector literal or null.';
