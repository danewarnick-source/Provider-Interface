-- staff_assignments: remove "no service codes means all codes".
--
-- Phase A (safe for main before merge): backfill only.
-- Rows whose service_codes is NULL or [] get the client's currently
-- authorized codes, computed exactly like clientAuthorizedCodes() in
-- src/lib/assignment-codes.ts: the union of clients.authorized_dspd_codes
-- then clients.job_code, trimmed, upper-cased, de-duplicated (first-seen
-- order). This is what the phone app shows today, so nobody loses access.
--
-- Rows whose client has no authorized codes can't be backfilled; they stay
-- NULL for a manual decision (listed in the PR). No rows are deleted.
--
-- The CHECK constraint lives in the Phase B file
-- (20260928190100_staff_assignments_explicit_codes_b_constraint.sql), applied
-- right after merge: main still writes NULL for "all codes" until then.
-- Idempotent: re-running only touches rows that are still NULL / [].

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

comment on column public.staff_assignments.service_codes is
  'Explicit service codes this staff member is assigned for this client (upper-case). '
  'Never NULL / [] for "all codes" — an empty assignment is deleted instead. '
  'Effective codes = these ∩ the client''s currently authorized codes. '
  'Written only through setStaffClientCodes (src/lib/scheduler/setup.functions.ts) and Smart Import commit.';
