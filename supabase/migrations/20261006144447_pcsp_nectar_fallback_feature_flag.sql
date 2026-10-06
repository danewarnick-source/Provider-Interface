-- PCSP reader: an org flag for the Nectar fallback. Off by default.
-- When on (and Nectar is on), a PCSP section the plain-code reader can't
-- match is sent to Nectar with a fixed schema that needs {value, page, quote}
-- per field. Orgs turn it on in the Master Controller (organization_features).
insert into public.feature_registry (feature_key, label, description, parent_key, category, default_enabled, sort_order)
values (
  'pcsp_nectar_fallback',
  'Nectar help reading unusual PCSP sections',
  'When a PCSP section does not match the usual USTEPS layout, ask Nectar to read only that section. Every value must quote the page it came from.',
  'nectar',
  'nectar_feature',
  false,
  75
)
on conflict (feature_key) do nothing;
