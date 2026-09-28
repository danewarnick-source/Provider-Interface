-- Step 5. Copy whiteboard_notes (4 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.whiteboard_notes_backup_20260928b AS SELECT * FROM public.whiteboard_notes;
ALTER TABLE public.whiteboard_notes_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whiteboard_notes_backup_20260928b FROM anon, authenticated;
