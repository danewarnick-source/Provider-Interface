-- Added by Core: lock down all six _backup_20260928b tables (RLS on, no policies, no anon/authenticated privileges). Idempotent.
ALTER TABLE public.shift_templates_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shift_templates_backup_20260928b FROM anon, authenticated;
ALTER TABLE public.celebration_events_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.celebration_events_backup_20260928b FROM anon, authenticated;
ALTER TABLE public.celebration_acknowledgements_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.celebration_acknowledgements_backup_20260928b FROM anon, authenticated;
ALTER TABLE public.nectar_code_activations_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nectar_code_activations_backup_20260928b FROM anon, authenticated;
ALTER TABLE public.whiteboard_notes_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whiteboard_notes_backup_20260928b FROM anon, authenticated;
ALTER TABLE public.hive_training_course_modules_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hive_training_course_modules_backup_20260928b FROM anon, authenticated;
