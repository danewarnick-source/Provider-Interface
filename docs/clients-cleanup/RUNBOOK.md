# Clients Rebuild Cleanup — Runbook (K1–K3, replaces the old Prompt 12)

_Written Oct 12, 2026. Replaces "Prompt 12" in `docs/clients-rebuild/RUNBOOK.md`, which was written Oct 6 and misses the polish work and later sessions' leftovers._

Owner: Jeff (Dane Warnick). Repo: danewarnick-source/Provider-Interface. Live Supabase project: dhrrukdcigiiqksibdfb.

**Goal:** finish the Clients rebuild by removing everything it replaced: old database tables and columns, the pending Phase B migrations, dead code, and oversized files. Screens must look and behave exactly the same afterward.

**Run this only when:**
1. The Clients rebuild (PRs #457 and #468) is merged to `main` and Jeff has checked production. Confirm with `git log origin/main` and that `src/lib/clients/legacy-fields.ts` exists on `main`. If not, stop and say so.
2. No other Claude Code session is changing client files. Run it **before** the Client Medications rebuild starts, so that rebuild starts from the cleaned-up `main`.

---

## HOW TO RUN THIS (Claude Code)

1. Read `CLAUDE.md` and obey it. Read this whole file once.
2. Create the integration branch `clients-cleanup` from latest `main`. Copy this file to `docs/clients-cleanup/RUNBOOK.md` on it and commit.
3. Run K1, K2, K3 in order. Each in a **fresh subagent** on `clients-cleanup/kN-<name>` cut from the tip of `clients-cleanup`. Each must pass `npm run build` (commit `src/routeTree.gen.ts`), `npx tsc --noEmit` with no new errors, and `npm run test:unit`. PR into `clients-cleanup`, squash-merge when green; on a failure after two honest attempts, leave the PR open marked `BLOCKED:` and stop.
4. Each subagent returns a ≤ 10-line report; append it to `docs/clients-cleanup/PROGRESS.md`.
5. At the end open `clients-cleanup` → `staging` titled `Clients cleanup (K1–K3)`. Never merge to `staging` or `main` yourself.
6. **These migrations drop things, which is allowed here only because the rebuild is already on `main`.** Before every drop: grep `src/`, `supabase/functions/`, and the live database (views, functions, triggers, RLS policies, `cron.job`) for the name. Drop only what nothing reads. List anything kept and what still reads it.
7. **7-year retention:** before dropping any table or column that holds rows, export them to CSV in the private storage bucket `archive` (create it if missing, admin-only) under `clients-cleanup/<table>.csv`. Never drop service records (notes, shifts, punches, MAR, incidents).
8. Never run `supabase db push`. Apply migrations directly (Supabase MCP or SQL) and record them in `supabase_migrations.schema_migrations`.

---

## K1 — Apply the pending Phase B migrations and fix migration file names

1. Apply these five, oldest first, after checking each one's comment for its precondition. Look each up **by name** in `supabase_migrations.schema_migrations` first; skip any already applied.
   - `20261006100300_clients_b_codes_copy_trigger_noop.sql` (switches off the old service-code copy into `job_code` / `authorized_dspd_codes`).
   - `20261007160000_smart_import_phase_b_discard_drafts_and_reminders.sql` (marks the open Smart Import client draft discarded; unschedules the `smart-import-reminders` cron job).
   - `20261008120000_clients_b_drop_client_notes.sql` (drops `client_notes`; export its rows first if any).
   - `20261013060000_hrr_b_drop_legacy_consent_columns.sql` (drops the old free-text consent columns on `hrc_restriction_records`; no live row used them).
   - `20261013200000_clients_b_drop_monthly_budget.sql` (drops `client_budgets` and `client_budget_lines`, the removed Monthly budget card; export their rows to the `archive` bucket first).
2. **Make the repo match the database.** Some migration files were applied under a different version than their file name (example: `20261007190000_people_soft_delete_columns.sql` is recorded live as `20261007063308`). For every file in `supabase/migrations/` whose name is recorded under a different version, `git mv` it to the recorded version. List every rename in the PR body.

**Done when:** the five are recorded as applied; `client_notes`, `client_budgets` and `client_budget_lines` are gone; the cron job is unscheduled; every migration file's version matches `schema_migrations`.

## K2 — Drop the old tables and columns

1. **Old client tables** (confirm 0 rows or fully copied by comparing counts; export any rows first): `client_meals`, `client_meal_support`, `client_nutrition_config`, `client_recipes`, `client_recipe_ingredients`, `client_shopping_items`, `client_meal_plans`, `client_meal_actuals`, `client_intake_completion`, `client_emergency_contacts`.
2. **Old `clients` columns:** every column in the "PROMPT 12 DROP LIST" in `src/lib/clients/legacy-fields.ts` and the drop list in `src/lib/clients/legacy-plans.ts`. That covers the old contacts, providers, insurance trio, codes pair (`job_code`, `authorized_dspd_codes`), `pcsp_goals`, PCSP dates and `plan_year`, physical description, the sensitive/unused list, meal and shopping fields, `hhs_monthly_support_hours`, `rights_restrictions`, `hr_applicable`, `court_orders`, `grievance_*`, `personal_belongings_inventory`, `bsp_status`, `roommates`, `housing_voucher`, `residential_provider`, `day_program_provider`, `immunizations`, `staff_ratio` (after confirming it was copied to `client_ratios`), `profile_photo_url`, `clinical_alert`, `pertinent_health_notes`, `dietary_needs`, `polst/palliative/hospice/dnr_applicable`, `intake_date`, `level_of_need`, `disability_category`. Check views like `hhs_daily_records_v` and every function before each drop.
3. **The code-copy trigger and its function**, and any function only they used.
4. **Smart Import's tables** (Smart Import was removed in polish C7): `import_jobs`, `import_documents`, `import_subjects`, `import_audit`, `import_access_log`, `import_cert_documents`, `import_field_provenance`, `import_merge_flags`, `import_nectar_questions`, and `extracted_fields`. **First check whether "Fill from PCSP", the client spreadsheet import, the team member import, or anything else still reads or writes any of them.** Drop only the ones nothing uses; export rows first.
5. Regenerate `src/integrations/supabase/types.ts`. Grep every dropped table and column name in `src/` → zero (except migration files).

**Done when:** every dropped name greps to zero; the app builds; the PR body lists each table and column dropped, its row count, and where its CSV export is.

## K3 — Shrink the code (no visible change)

1. Delete `src/lib/clients/legacy-fields.ts`, `legacy-plans.ts` and their tests, plus anything else that existed only to read or backfill the dropped columns.
2. Run `npx knip` (no install needed) and delete every unused file, export, type and dependency it reports in the client area, Smart Import leftovers and anything K2 orphaned. Grep each removed export → zero imports.
3. **Bring oversized files under the limits** (routes ≤ 80 lines, components ≤ 250, lib files ≤ 300) by removing dead and duplicate code first, and splitting only what's left. The worst offenders:
   - `src/lib/clients/training.functions.ts` (1,397)
   - `src/lib/clients/import-schema.ts` (1,130). Remove every key and branch only Smart Import used; keep only what Fill from PCSP and the spreadsheet import need.
   - `src/routes/dashboard.hhs-hub.$clientId.tsx` (1,016)
   - `src/components/clients/profile/client-specific-training-card.tsx` (640)
   - `src/components/clients/shared/client-documents-card.tsx` (583)
   - `src/components/staff-client-grid.tsx` (572)
   - `src/lib/clients/care-data.functions.ts` (539)
   - `src/lib/clients/face-sheet.functions.ts` (498)
   Merge duplicate helpers (date formatting, status chips, contact formatting, guards) into one shared file each. No new features, no visual change.
4. Delete tests that only tested deleted code. Keep every test for behavior that still exists.
5. Delete `docs/clients-rebuild/` and `docs/clients-polish/`.
6. PR body: client-area line count (all files under `src/` with "client" in the path, tests counted separately) before → after, and repo-wide app code (`src/`, excluding tests and generated files) before → after.

**Done when:** knip reports nothing unused in the client area; no client file is over its limit (or the PR lists each exception and why); every client screen looks identical on the preview.

---

## KICKOFF MESSAGE (paste into Claude Code)

> Read `CLAUDE.md`, then read `docs/clients-cleanup/RUNBOOK.md` on branch `clients-cleanup-runbook`. Confirm the Clients rebuild is on `main`; if it isn't, stop and tell me. Then run K1–K3 exactly as written: one subagent and one PR per step into `clients-cleanup`, merging each only when every check passes, stopping on a blocker. When done, open the `clients-cleanup` → `staging` PR.
