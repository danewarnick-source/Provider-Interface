-- Phase B — apply right AFTER the explicit-codes PR merges (main writes NULL
-- for "all codes" until then, which this constraint would reject).
--
-- 1. Re-run the Phase A backfill for any NULL / [] rows main wrote between
--    Phase A and merge (same clientAuthorizedCodes() computation).
-- 2. Add staff_assignments_codes_required NOT VALID: every new or updated
--    row must list at least one code.
-- 3. VALIDATE only when no existing row violates it. Rows whose client has
--    no authorized codes are left for a manual decision (never deleted); while
--    any remain, the constraint stays NOT VALID and a NOTICE says how many.

with authorized as (
  select
    c.id as client_id,
    array(
      select s.code
      from (
        select upper(btrim(x)) as code, min(ord) as first_ord
        from unnest(coalesce(c.authorized_dspd_codes, '{}'::text[])
                    || coalesce(c.job_code, '{}'::text[])) with ordinality as t(x, ord)
        where btrim(coalesce(x, '')) <> ''
        group by 1
      ) s
      order by s.first_ord
    ) as codes
  from public.clients c
)
update public.staff_assignments sa
set service_codes = a.codes
from authorized a
where a.client_id = sa.client_id
  and (sa.service_codes is null or cardinality(sa.service_codes) = 0)
  and cardinality(a.codes) >= 1;

alter table public.staff_assignments
  drop constraint if exists staff_assignments_codes_required;

alter table public.staff_assignments
  add constraint staff_assignments_codes_required
  check (service_codes is not null and cardinality(service_codes) >= 1)
  not valid;

do $$
declare
  leftover integer;
begin
  select count(*) into leftover
  from public.staff_assignments
  where service_codes is null or cardinality(service_codes) = 0;

  if leftover = 0 then
    alter table public.staff_assignments validate constraint staff_assignments_codes_required;
  else
    raise notice 'staff_assignments_codes_required left NOT VALID: % row(s) have no codes (client has no authorized codes) — resolve manually, then VALIDATE.', leftover;
  end if;
end $$;
