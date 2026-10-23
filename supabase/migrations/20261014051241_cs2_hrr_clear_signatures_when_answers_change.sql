-- Rights restriction (HRR) signatures are cleared by the database whenever
-- what was signed changes, so the rule holds for every update (the save
-- server function, an admin's direct update, or a sign and an edit racing).
-- Mirrors signaturesClearedBy in src/lib/clients/hrc.ts exactly:
--   content = restriction_title plus every answer field;
--   when the content changes, each signature group already on the row is
--   cleared unless that same group is changed in the same update.
-- The stamping below then clears who/when for each cleared group.

create or replace function public.hrr_stamp_signatures()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  prev public.hrc_restriction_records%rowtype;
begin
  -- On insert every signature counts as new (prev stays all null).
  if tg_op = 'UPDATE' then
    prev := old;
    new.updated_at := now();

    if new.restriction_title is distinct from old.restriction_title
       or new.condition_description_text is distinct from old.condition_description_text
       or new.assessed_need_text is distinct from old.assessed_need_text
       or new.positive_interventions_text is distinct from old.positive_interventions_text
       or new.less_intrusive_methods_text is distinct from old.less_intrusive_methods_text
       or new.data_review_text is distinct from old.data_review_text
       or new.time_limits_text is distinct from old.time_limits_text
       or new.restore_plan_text is distinct from old.restore_plan_text
       or new.no_harm_text is distinct from old.no_harm_text
       or new.last_review_date is distinct from old.last_review_date
       or new.next_review_date is distinct from old.next_review_date then

      -- Consent (signer name, role, client name).
      if (coalesce(old.consent_signer_name, '') <> ''
          or coalesce(old.consent_signer_role, '') <> ''
          or coalesce(old.consent_client_name, '') <> '')
         and new.consent_signer_name is not distinct from old.consent_signer_name
         and new.consent_signer_role is not distinct from old.consent_signer_role
         and new.consent_client_name is not distinct from old.consent_client_name then
        new.consent_signer_name := null;
        new.consent_signer_role := null;
        new.consent_client_name := null;
      end if;

      -- Provider admin.
      if coalesce(old.admin_signer_name, '') <> ''
         and new.admin_signer_name is not distinct from old.admin_signer_name then
        new.admin_signer_name := null;
      end if;

      -- Support coordinator (name, date, method).
      if (coalesce(old.sc_name, '') <> ''
          or old.sc_signed_on is not null
          or coalesce(old.sc_method, '') <> '')
         and new.sc_name is not distinct from old.sc_name
         and new.sc_signed_on is not distinct from old.sc_signed_on
         and new.sc_method is not distinct from old.sc_method then
        new.sc_name := null;
        new.sc_signed_on := null;
        new.sc_method := null;
      end if;

      -- Human Rights Committee decision (decision, date).
      if (coalesce(old.hrc_decision, '') <> ''
          or old.hrc_decision_on is not null)
         and new.hrc_decision is not distinct from old.hrc_decision
         and new.hrc_decision_on is not distinct from old.hrc_decision_on then
        new.hrc_decision := null;
        new.hrc_decision_on := null;
      end if;
    end if;
  end if;

  if new.consent_signer_name is distinct from prev.consent_signer_name
     or new.consent_signer_role is distinct from prev.consent_signer_role
     or new.consent_client_name is distinct from prev.consent_client_name then
    if nullif(btrim(coalesce(new.consent_signer_name, '')), '') is null then
      new.consent_by := null; new.consent_at := null;
    else
      new.consent_by := auth.uid(); new.consent_at := now();
    end if;
  else
    new.consent_by := prev.consent_by; new.consent_at := prev.consent_at;
  end if;

  if new.admin_signer_name is distinct from prev.admin_signer_name then
    if nullif(btrim(coalesce(new.admin_signer_name, '')), '') is null then
      new.admin_signed_by := null; new.admin_signed_at := null;
    else
      new.admin_signed_by := auth.uid(); new.admin_signed_at := now();
    end if;
  else
    new.admin_signed_by := prev.admin_signed_by; new.admin_signed_at := prev.admin_signed_at;
  end if;

  if new.sc_name is distinct from prev.sc_name
     or new.sc_signed_on is distinct from prev.sc_signed_on
     or new.sc_method is distinct from prev.sc_method then
    if nullif(btrim(coalesce(new.sc_name, '')), '') is null then
      new.sc_recorded_by := null; new.sc_recorded_at := null;
    else
      new.sc_recorded_by := auth.uid(); new.sc_recorded_at := now();
    end if;
  else
    new.sc_recorded_by := prev.sc_recorded_by; new.sc_recorded_at := prev.sc_recorded_at;
  end if;

  if new.hrc_decision is distinct from prev.hrc_decision
     or new.hrc_decision_on is distinct from prev.hrc_decision_on then
    if new.hrc_decision is null then
      new.hrc_recorded_by := null; new.hrc_recorded_at := null;
    else
      new.hrc_recorded_by := auth.uid(); new.hrc_recorded_at := now();
    end if;
  else
    new.hrc_recorded_by := prev.hrc_recorded_by; new.hrc_recorded_at := prev.hrc_recorded_at;
  end if;

  return new;
end;
$function$;
