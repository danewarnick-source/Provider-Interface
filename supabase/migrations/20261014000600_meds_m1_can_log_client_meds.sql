-- Meds rebuild M1 (audit): helpers for the tightened dose INSERT rules
-- (next migration): who may chart doses for a client, and whether a
-- medication belongs to that client.

-- Who may chart doses for a client: anyone who can read the client's PHI
-- (can_access_client_phi rules, for _user instead of auth.uid()), or anyone
-- with a published shift for the client today (America/Denver).
create or replace function public.can_log_client_meds(_client_id uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = _client_id
      and public.is_org_member(c.organization_id, _user)
      and (
        public.access_can_see_client(c.id, _user)
        or public.staff_assigned_to_client(c.id, _user)
        or exists (
          select 1 from public.scheduled_shifts s
          where s.client_id = c.id
            and s.staff_id = _user
            and s.organization_id = c.organization_id
            and s.status = 'published'
            and s.starts_at < (((now() at time zone 'America/Denver')::date + 1)::timestamp at time zone 'America/Denver')
            and s.ends_at > (((now() at time zone 'America/Denver')::date)::timestamp at time zone 'America/Denver')
        )
      )
  );
$$;
revoke all on function public.can_log_client_meds(uuid, uuid) from public, anon;
grant execute on function public.can_log_client_meds(uuid, uuid) to authenticated, service_role;

-- The medication must belong to the dose's client and agency.
create or replace function public.medication_belongs_to_client(_medication_id uuid, _client_id uuid, _org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.client_medications m
    where m.id = _medication_id and m.client_id = _client_id and m.organization_id = _org
  );
$$;
revoke all on function public.medication_belongs_to_client(uuid, uuid, uuid) from public, anon;
grant execute on function public.medication_belongs_to_client(uuid, uuid, uuid) to authenticated, service_role;
