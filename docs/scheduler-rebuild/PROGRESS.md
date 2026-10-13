# Scheduler rebuild progress

One short report per prompt, newest last.

## S1 — Safety fixes — MERGED
- PR #470 (squash into scheduler-rebuild-a). 18 files added, none deleted; 6 migrations applied to live.
- Migrations: scheduler_safety_helpers, scheduler_safety_day_program_rls, scheduler_safety_shift_write_rls, scheduled_shifts_staff_see_published_only, notifications_scheduler_types, shift_swap_partner_response (ALTER POLICY used; DROP POLICY hung through the Supabase tool).
- Checks: build passed (local-only xlsx shim, sandbox can't fetch xlsx); tsc 219 → 219 (no new); test:unit 6 failures before and after (deploy-aws, nectar onboarding, notification bell, org-subscription, sow-index, team-members import — unrelated, pre-existing), new tests pass; Done-when SQL run on live in a rolled-back transaction, all as expected; GitHub checks: none failed.
- Note: staff also see published shifts on clients/homes they are assigned to (S1 item 10).

## S2 — Cleanup and folders — MERGED
- PR #471 (squash into scheduler-rebuild-a). 17 files deleted, 33 moved with git mv, 0 added, ~20 edited for import paths/links/e2e. No migrations.
- Checks: build passed (local xlsx shim); tsc 219 → 219 (identical set); test:unit 1542 pass / 6 fail (same 6 pre-existing as base); GitHub checks: none failed.
- NOT VERIFIED: scheduler e2e. All 9 tests fail identically before and after in this sandbox (Playwright wants Chromium build 1248, 1194 installed; with dummy env the app hangs on "Loading workspace…" or redirects to /login). Needs a run in CI/locally before production.
- Small extras: removed dead `rhs-board.functions` line from src/lib/clinical/index.ts; dropped `?tab=schedule` from the homes-teams "View schedule" link; e2e test 8 reduced to the `?focus=` banner case since the redirect routes are gone.

## S3 — The rule engine — MERGED (PR #472; build ok, tsc 219 → 219, test:unit same 6 pre-existing failures, e2e not verified in sandbox)
- Branch `scheduler-rebuild-a-s3-rule-engine`. Pure logic, not wired into callers: `rules.ts` (+ `rules-*.ts` splits), `ratios.ts`, `billing-mode.ts`, each with tests in the `test:unit` list. `conflicts.ts` deleted (it had no importers).
- `qualificationsOnDate` is the one Evidence-only answer (reviewed, unexpired on the shift date, "waiting for review" as its own state, 90-day CPR and 180-day behavior hire grace). Old qualification paths are marked `S4-REPOINT`, not deleted.
- No migrations.
