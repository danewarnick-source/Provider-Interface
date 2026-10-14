-- CS3: loans and loan ledger entries are voided, never deleted (7-year retention).
-- Additive and nullable so main's loan code keeps working until this ships.
alter table public.client_loans
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;
alter table public.client_loan_entries
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

alter table public.client_loans
  add constraint client_loans_void_needs_reason
  check (voided_at is null or (void_reason is not null and length(btrim(void_reason)) > 0));
alter table public.client_loan_entries
  add constraint client_loan_entries_void_needs_reason
  check (voided_at is null or (void_reason is not null and length(btrim(void_reason)) > 0));

-- A void is final: it can't be cleared, and a voided entry's numbers can't change.
create or replace function public.client_loan_void_is_final()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.voided_at is not null then
    if new.voided_at is null
       or new.voided_at is distinct from old.voided_at
       or new.void_reason is distinct from old.void_reason
       or new.voided_by is distinct from old.voided_by then
      raise exception 'A voided loan record stays voided.';
    end if;
    if tg_table_name = 'client_loan_entries' and (
         new.amount is distinct from old.amount
      or new.kind is distinct from old.kind
      or new.entry_date is distinct from old.entry_date
      or new.loan_id is distinct from old.loan_id) then
      raise exception 'A voided ledger entry can''t be changed.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_client_loans_void_is_final
  before update on public.client_loans
  for each row execute function public.client_loan_void_is_final();
create trigger trg_client_loan_entries_void_is_final
  before update on public.client_loan_entries
  for each row execute function public.client_loan_void_is_final();
