-- Drop leftovers from the Employees simplify work (PRs #389 / #390 / #391).
--
-- Approved by Dane on 2026-09-25 (3:09 AM MT). Checked right before applying:
-- nothing in the database (policies, views, functions, triggers, foreign keys,
-- columns) and no live code on main uses any of these objects.
--
--  * certification_types (9 rows, snapshot saved first) and its track_id column:
--    the old training-track certification catalog. track_id pointed at
--    training_tracks, which was dropped on 2026-09-24.
--  * recurring_shift_patterns.rotation_group_id: the old staff-rotation link
--    (staff_rotation_groups was dropped on 2026-09-24). The table has no rows.
--  * seed_system_rbac_roles(uuid), trg_seed_rbac_on_new_org(): dead legacy role
--    seeding. They write to public.rbac_roles, which no longer exists, and no
--    trigger calls them.
--  * enums track_type, hive_training_auto_renew_status, hive_training_order_status:
--    no column or function uses them.
--
-- Plain DROP ... IF EXISTS, no CASCADE, so anything that still depended on these
-- objects would make this migration fail instead of dropping it silently.

-- columns
ALTER TABLE public.recurring_shift_patterns DROP COLUMN IF EXISTS rotation_group_id;
ALTER TABLE public.certification_types DROP COLUMN IF EXISTS track_id;

-- table (its own RLS policies go with it)
DROP TABLE IF EXISTS public.certification_types;

-- functions (exact signatures)
DROP FUNCTION IF EXISTS public.trg_seed_rbac_on_new_org();
DROP FUNCTION IF EXISTS public.seed_system_rbac_roles(uuid);

-- enums last
DROP TYPE IF EXISTS public.track_type;
DROP TYPE IF EXISTS public.hive_training_auto_renew_status;
DROP TYPE IF EXISTS public.hive_training_order_status;
