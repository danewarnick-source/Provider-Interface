-- Meds rebuild M5: tighten the logged-dose lock from M1.
-- M1 still let signed-in users change the PRN follow-up fields because M5
-- hadn't built their screen. Give meds now saves follow-ups through
-- record_prn_followup (SECURITY DEFINER), and no app code on main or this
-- branch updates emar_logs directly (checked). So a signed-in user can now
-- change only the admin review fields; everything else is a correction
-- (addendum). M6 still removes the "staff update own emar" policy.
create or replace function public.emar_logs_lock_logged_dose()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  -- late_entry_gap_minutes is generated: NEW holds null for it in a BEFORE
  -- trigger, so it is left out of the comparison (its inputs are compared).
  v_review_fields text[] := array['admin_reviewed', 'admin_reviewed_by', 'admin_reviewed_at',
    'admin_review_notes', 'late_entry_gap_minutes'];
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (to_jsonb(new) - v_review_fields) is distinct from (to_jsonb(old) - v_review_fields) then
    raise exception 'A logged dose can''t be changed. Add a correction instead.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
