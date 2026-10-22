-- Meds rebuild M1: columns the new Medications form needs. All nullable or
-- defaulted (additive; main ignores them). Existing columns are reused for
-- name, dose, route, times, purpose, side effects, etc.
alter table public.client_medications
  add column if not exists strength text,
  add column if not exists dose_form text,
  add column if not exists how_taken text,
  add column if not exists stop_reason text,
  add column if not exists paused_at timestamptz,
  add column if not exists pause_reason text,
  add column if not exists packaging_approval_path text,
  add column if not exists label_photo_path text,
  add column if not exists reference_key text,
  add column if not exists prn_min_hours numeric,
  add column if not exists prn_max_per_day int,
  add column if not exists prn_followup_minutes int default 60,
  add column if not exists prn_try_first text,
  add column if not exists prn_call_if text,
  add column if not exists is_psychotropic boolean not null default false,
  add column if not exists psychotropic_type text,
  add column if not exists used_for_behavior boolean not null default false,
  add column if not exists bsp_document_id uuid references public.client_documents(id),
  add column if not exists hrc_restriction_id uuid references public.hrc_restriction_records(id),
  add column if not exists consent_date date,
  add column if not exists consent_document_path text,
  add column if not exists next_review_date date;

alter table public.client_medications
  add constraint client_medications_how_taken_check
    check (how_taken is null or how_taken in ('self', 'assist', 'nurse')),
  add constraint client_medications_psychotropic_type_check
    check (psychotropic_type is null or psychotropic_type in
      ('antipsychotic', 'antidepressant', 'mood stabilizer', 'anti-anxiety', 'stimulant', 'sleep', 'other')),
  add constraint client_medications_prn_limits_check
    check ((prn_min_hours is null or prn_min_hours >= 0)
       and (prn_max_per_day is null or prn_max_per_day > 0)
       and (prn_followup_minutes is null or prn_followup_minutes > 0));

-- Backfill how_taken from the legacy support_level (kept in sync until M6).
update public.client_medications set how_taken = case
    when support_level in ('self', 'staff_observed') then 'self'
    when support_level = 'staff_administered' then 'assist'
    when support_level in ('lpn', 'rn', 'delegated') then 'nurse'
    else null
  end
where how_taken is null and support_level is not null;
