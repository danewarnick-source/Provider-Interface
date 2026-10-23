-- Rights restriction (HRR) records keep their own document, Nectar's draft
-- marks, the client/guardian informed consent, the provider admin and support
-- coordinator signatures, and the Human Rights Committee decision
-- (DHHS91172 SOW 1.20(b), 1.20(b)(7), 1.28(6)). Additive only.
-- Who/when on each signature is stamped here from auth.uid() and now(), so a
-- caller can't sign as someone else.

alter table public.hrc_restriction_records
  add column if not exists document_id uuid references public.client_documents(id) on delete set null,
  add column if not exists restore_plan_text text,
  add column if not exists nectar_fields text[] not null default '{}',
  add column if not exists consent_signer_name text,
  add column if not exists consent_signer_role text,
  add column if not exists consent_client_name text,
  add column if not exists consent_by uuid,
  add column if not exists consent_at timestamptz,
  add column if not exists admin_signer_name text,
  add column if not exists admin_signed_by uuid,
  add column if not exists admin_signed_at timestamptz,
  add column if not exists sc_name text,
  add column if not exists sc_signed_on date,
  add column if not exists sc_method text,
  add column if not exists sc_recorded_by uuid,
  add column if not exists sc_recorded_at timestamptz,
  add column if not exists hrc_decision text,
  add column if not exists hrc_decision_on date,
  add column if not exists hrc_recorded_by uuid,
  add column if not exists hrc_recorded_at timestamptz;

alter table public.hrc_restriction_records
  add constraint hrc_restriction_records_consent_role_check
    check (consent_signer_role is null or consent_signer_role in ('client', 'guardian')),
  add constraint hrc_restriction_records_sc_method_check
    check (sc_method is null or sc_method in ('in_person', 'email', 'signed_copy')),
  add constraint hrc_restriction_records_hrc_decision_check
    check (hrc_decision is null or hrc_decision in ('approved', 'denied'));

create index if not exists hrc_restriction_records_document_id_idx
  on public.hrc_restriction_records (document_id);

create or replace function public.hrr_stamp_signatures()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  prev public.hrc_restriction_records%rowtype;
begin
  -- On insert every signature counts as new (prev stays all null).
  if tg_op = 'UPDATE' then
    prev := old;
    new.updated_at := now();
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
$$;

create trigger hrr_stamp_signatures
  before insert or update on public.hrc_restriction_records
  for each row execute function public.hrr_stamp_signatures();
