-- Meds rebuild M5 (audit): who counts as trained to give medications.
--
-- Counts only medication training whose file an admin approved
-- (evidence_files.review_status = 'accepted') before or on the dose date and
-- that hasn't expired by then. Returns:
--   'approved'    the staff member has it
--   'not_current' the agency set up medication training but this person
--                 doesn't have an approved, unexpired one
--   'not_set_up'  the agency has no medication training items at all
-- is_med_assist_current treated 'not_set_up' as trained and counted any
-- uploaded file; it stays for main until M6.
-- A person can ask about themselves; an Owner or agency-wide Admin can ask
-- about anyone in their agency.
create or replace function public.med_training_status(
  _user uuid,
  _org uuid,
  _on date default ((now() at time zone 'America/Denver')::date)
)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is not null and v_caller <> _user
     and not public.is_org_admin_or_manager(_org, v_caller) then
    return null;
  end if;

  if not exists (
    select 1 from public.evidence_items ei
    where ei.organization_id = _org
      and ei.subject_type = 'staff'
      and ei.opted_out_at is null
      and (
        ei.requirement_key ilike '%med_assist%'
        or ei.requirement_key ilike '%medication%'
        or ei.title ilike '%medication%'
        or ei.title ilike '%med assist%'
        or ei.title ilike '%med-assist%'
      )
  ) then
    return 'not_set_up';
  end if;

  if exists (
    select 1
    from public.evidence_items ei
    join public.evidence_files ef on ef.item_id = ei.id
    where ei.organization_id = _org
      and ei.subject_type = 'staff'
      and ei.subject_id = _user
      and ei.opted_out_at is null
      and (
        ei.requirement_key ilike '%med_assist%'
        or ei.requirement_key ilike '%medication%'
        or ei.title ilike '%medication%'
        or ei.title ilike '%med assist%'
        or ei.title ilike '%med-assist%'
      )
      and ef.review_status = 'accepted'
      and (ef.reviewed_at is null or (ef.reviewed_at at time zone 'America/Denver')::date <= _on)
      and (ei.expires_on is null or ei.expires_on >= _on)
  ) then
    return 'approved';
  end if;

  return 'not_current';
end;
$$;

revoke all on function public.med_training_status(uuid, uuid, date) from public, anon;
grant execute on function public.med_training_status(uuid, uuid, date) to authenticated, service_role;
