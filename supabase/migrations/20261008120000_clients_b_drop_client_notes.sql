-- PHASE B: apply only after this reaches main.
--
-- Drops the client office notes table (client_notes) now that "Add note" and
-- office notes are gone from the client profile. Created by
-- 20261006220000_clients_staff_exclusions_notes.sql; client_staff_exclusions
-- from that same file stays. Checked live before writing: 0 rows, no
-- triggers, no views, no foreign keys pointing at it and no functions that
-- reference it; only its three RLS policies and two indexes (dropped with it).
-- After applying, regenerate src/integrations/supabase/types.ts.

drop policy if exists "clients editors read notes" on public.client_notes;
drop policy if exists "clients editors insert notes" on public.client_notes;
drop policy if exists "clients editors update notes" on public.client_notes;
drop table if exists public.client_notes;
