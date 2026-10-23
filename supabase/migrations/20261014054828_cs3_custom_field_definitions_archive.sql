-- CS3: custom field definitions are archived, never deleted, so client values stay.
-- Additive and nullable; main never archives, so its code is unaffected.
alter table public.custom_field_definitions
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

-- No new values on an archived field (existing values are kept as they are).
create or replace function public.custom_field_values_block_archived()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.custom_field_definitions d
    where d.id = new.definition_id and d.archived_at is not null
  ) then
    raise exception 'This field is archived. Restore it to change its values.';
  end if;
  return new;
end;
$$;
revoke all on function public.custom_field_values_block_archived() from public, anon, authenticated;

create trigger trg_custom_field_values_block_archived
  before insert or update on public.custom_field_values
  for each row execute function public.custom_field_values_block_archived();
