-- Step 6. Drop the updated-at triggers on the tables that will be dropped.
-- These call update_updated_at_column. The function stays.
DROP TRIGGER IF EXISTS trg_bc_data_updated ON public.bc_data_entries;
DROP TRIGGER IF EXISTS trg_bc_behaviors_updated ON public.bc_behaviors;
DROP TRIGGER IF EXISTS trg_bc_docs_updated ON public.bc_documents;
DROP TRIGGER IF EXISTS trg_bc_flags_updated ON public.bc_flags;
DROP TRIGGER IF EXISTS trg_bc_notes_updated ON public.bc_review_notes;
DROP TRIGGER IF EXISTS trg_bsc_updated ON public.behavior_support_clients;
DROP TRIGGER IF EXISTS trg_ctb_updated ON public.client_target_behaviors;
DROP TRIGGER IF EXISTS trg_shift_behavior_obs_updated_at ON public.shift_behavior_observations;
