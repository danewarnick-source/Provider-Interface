-- Meds rebuild M3 (audit): dose corrections (emar_log_addenda).
-- 1. A correction needs a reason (new column; addEmarAddendum requires it).
-- 2. Who may add one: someone with client_medical edit who can see the
--    client, or the person who logged the dose within 24 hours of logging
--    it. The rule is replaced in place (ALTER POLICY) so there is never a
--    moment without one. main's admins with medical edit still pass.
-- 3. Corrections are insert-only: there are no UPDATE or DELETE rules, and a
--    trigger refuses updates and direct deletes from any role (a cascade from
--    its dose row is left alone).

alter table public.emar_log_addenda add column if not exists reason text;

alter policy "loggers insert addenda" on public.emar_log_addenda
  with check (
    staff_id = auth.uid()
    and exists (
      select 1 from public.emar_logs e
      where e.id = emar_log_id
        and e.organization_id = emar_log_addenda.organization_id
        and (
          (
            public.access_has_category(e.organization_id, auth.uid(), 'client_medical', 'edit')
            and public.can_access_client_phi(e.client_id)
          )
          or (
            e.staff_id = auth.uid()
            and e.created_at > now() - interval '24 hours'
            and public.can_log_client_meds(e.client_id, auth.uid())
          )
        )
    )
  );

create or replace function public.emar_log_addenda_insert_only()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'A correction can''t be changed or removed. Add another correction instead.'
    using errcode = '42501';
end;
$$;

create trigger trg_emar_log_addenda_insert_only
  before update or delete on public.emar_log_addenda
  for each row execute function public.emar_log_addenda_insert_only();
