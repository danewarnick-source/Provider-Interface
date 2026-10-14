-- Medication training status on a day, now one of four answers:
--   'current'     approved (evidence_files.review_status = 'accepted') on or
--                 before the day, and not expired on the day
--   'expired'     approved, but the training expired before the day
--   'unapproved'  the agency set up medication training, but this person has
--                 no approved file for it (none uploaded, waiting, or rejected)
--   'not_set_up'  the agency has no medication training items at all
-- The decision is one pure function (med_training_decision) over three facts
-- med_training_status reads from the training records. Nothing on main calls
-- either function. log_medication_dose never blocks on it; it marks the dose.
create or replace function public.med_training_decision(
  _agency_has_training boolean,
  _has_current boolean,
  _has_expired boolean
)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when not coalesce(_agency_has_training, false) then 'not_set_up'
    when coalesce(_has_current, false) then 'current'
    when coalesce(_has_expired, false) then 'expired'
    else 'unapproved'
  end
$$;

revoke all on function public.med_training_decision(boolean, boolean, boolean) from public, anon;
grant execute on function public.med_training_decision(boolean, boolean, boolean) to authenticated, service_role;

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
  v_set_up boolean;
  v_current boolean;
  v_expired boolean;
begin
  if v_caller is not null and v_caller <> _user
     and not public.is_org_admin_or_manager(_org, v_caller) then
    return null;
  end if;

  select exists (
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
  ) into v_set_up;

  select
    coalesce(bool_or(ei.expires_on is null or ei.expires_on >= _on), false),
    coalesce(bool_or(ei.expires_on < _on), false)
  into v_current, v_expired
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
    and (ef.reviewed_at is null or (ef.reviewed_at at time zone 'America/Denver')::date <= _on);

  return public.med_training_decision(v_set_up, v_current, v_expired);
end;
$$;

revoke all on function public.med_training_status(uuid, uuid, date) from public, anon;
grant execute on function public.med_training_status(uuid, uuid, date) to authenticated, service_role;
