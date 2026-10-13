-- Nectar rebuild N3: the agency's AI settings (Decision 10). Nectar on/off for
-- the agency plus on/off per feature. Every key defaults to on, so nothing
-- changes for current agencies until an owner turns something off.

alter table public.organizations
  add column if not exists nectar_settings jsonb not null
    default '{"enabled": true, "ask": true, "note_help": true, "pcsp_reading": true, "summary_drafts": true}'::jsonb;

alter table public.organizations
  add constraint organizations_nectar_settings_object
    check (jsonb_typeof(nectar_settings) = 'object');

comment on column public.organizations.nectar_settings is
  'Nectar AI settings: enabled (Nectar on for the agency), ask, note_help (shift note help), pcsp_reading, summary_drafts. A missing key counts as on.';
