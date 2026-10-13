-- PHASE B: apply only after this reaches main.
--
-- Drops the client monthly budget tables now that the Monthly budget card is
-- gone from Services & billing (production's client-budget-panel.tsx and
-- client-budget-report.ts still read them until this change is on main).
-- Created by 20260707184349_c2d41bd7-85e5-464d-81e5-ee14914c2246.sql, with
-- client_budget_lines.day_of_month / archived_at / archived_by added later.
-- Checked live before writing: 2 budgets and 3 lines (the owner chose to
-- remove them), no views or functions reference them, and the only foreign
-- key pointing at client_budgets is client_budget_lines.budget_id. Their RLS
-- policies, indexes and *_touch triggers go with the tables;
-- touch_updated_at_generic() is shared and stays. clients.income_sources stays
-- (the face sheet prints it).
-- After applying, regenerate src/integrations/supabase/types.ts.

drop table if exists public.client_budget_lines;
drop table if exists public.client_budgets;
