-- Drop Chores / Chore Chart feature tables.
-- Idempotent. Safe to re-run. Do NOT apply from the agent — Dane/Core
-- pastes this in Lovable's SQL editor after merge (see docs/SQL_HANDOFF.md).
--
-- Live Hive-Platform tables this removes:
--   chore_completions
--   chore_client_rotation
--   chore_daily_items
--   chore_definitions
--   chore_space_clients
--   client_chore_support
--   chore_spaces
--
-- CASCADE is required and scoped:
--   Child FKs point at chore_spaces / chore_definitions. RLS policies,
--   indexes, and update triggers live on these tables and drop with them.
--   Outside tables (clients, teams, organizations) are PARENTS of these
--   FKs, not children — CASCADE does not drop them.
--
-- Does NOT drop:
--   * client_meal_support (unrelated meal feature)
--   * client_documents rows with document_type = 'chore_chart' (audit history)
--   * storage objects under .../chore-charts/ (same reason; no dedicated
--     chore storage bucket exists)
--   * historical create-table migrations (left in place)
--
-- chore_shift_rows / chore_shift_assignments were already dropped in
-- 20260707221413 and are not listed live — not touched here.

-- Drop RLS policies first so a partial re-run does not leave named
-- policies dangling if a later DROP TABLE is skipped.
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chore_completions',
    'chore_client_rotation',
    'chore_daily_items',
    'chore_definitions',
    'chore_space_clients',
    'client_chore_support',
    'chore_spaces'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    FOR pol IN
      SELECT p.polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t);
    END LOOP;
  END LOOP;
END $$;

-- Children first, then parent. CASCADE absorbs leftover FKs / triggers
-- / indexes on this set only.
DROP TABLE IF EXISTS public.chore_completions CASCADE;
DROP TABLE IF EXISTS public.chore_client_rotation CASCADE;
DROP TABLE IF EXISTS public.chore_daily_items CASCADE;
DROP TABLE IF EXISTS public.chore_definitions CASCADE;
DROP TABLE IF EXISTS public.chore_space_clients CASCADE;
DROP TABLE IF EXISTS public.client_chore_support CASCADE;
DROP TABLE IF EXISTS public.chore_spaces CASCADE;
