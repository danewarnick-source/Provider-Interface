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

## Notes for the main/staging merge into this branch (from the Oct 22 CLAUDE.md audit)
When `main` (or `staging`) is merged into `scheduler-rebuild-a`, update CLAUDE.md in the same merge so it matches Part A's code. These lines are not edited here yet, because the other branch changed the neighbouring lines and editing now would only add conflicts.
- **EVV codes line:** the list becomes `CMP, CMS, COM, HSQ, PAC, RP2, RP3, SLH, SLN` (ACA, CHA and LPS are not in DHHS91172; Decision 11). `src/lib/evv-codes.ts` stays authoritative.
- **Daily-rate codes line:** "Daily-rate codes come from `DAILY_UNIT_CODES` in `src/lib/scheduler/billing-mode.ts` (RHS, HHS, PPS, DSG, MTP, RP4, RP5, SED, PN1); `src/lib/service-billing.ts` re-exports them as `DAILY_SERVICE_CODES`. Hourly codes with a daily mode (COM, PAC, RP2, RP3, EPR, PN2) and the DSI/SEE tiers stay out of that list; `hasDailyMode()` / `billingFor()` decide them (owner-approved Oct 22)." RL6 is gone.
- **Unit math line:** add "`billingFor()` in billing-mode.ts owns the day-level mode (daily vs quarter hours, DSI/SEE tiers) once S10/S11 wire it in; per-entry quarter-hour counts stay in `computeEntryUnits()`."
- **Conflict engine line:** "Every 'can this shift exist?' rule lives in `src/lib/scheduler/rules.ts` (+ `rules-*.ts`); no ad-hoc checks elsewhere. 2:1 without a rights modification is a **block** (Decision 19). DSI over 6 h/day is a warn; CMP/CMS over 8 h/day or 40 h/week (Sun–Sat) is a block; asleep time on SLH/SLN/CMP/CMS overnights is a warn."
- **Add a scheduler bullet:** "Scheduler dates go through `src/lib/scheduler/time.ts` (America/Denver, weeks start Sunday). The scheduler runbook's Decisions (docs/scheduler-rebuild/RUNBOOK.md) are owner decisions and override older lines here."
- **Dates UI rule** (in the UI interaction rules): it points at `src/lib/clients/dates.ts`. `time.ts` and `clients/dates.ts` now both do date-only work; per "one source per fact", pick one owner during this merge and move the other's callers.
- **Source-of-truth map, service-code row:** owner code becomes `src/lib/evv-codes.ts` (EVV) and `src/lib/scheduler/billing-mode.ts` (daily modes), with `service-billing.ts` reading from it.
- **No-embed line:** drop `import.functions.ts` / `setup.functions.ts` from the known violations (S1 fixed them).
- **Scheduler RLS line:** drop "its migration files are on scheduler-rebuild-a".
- **Open owner decisions:** the MTP/1056 conflict matters for S4 — `authorizationRule` would block every MTP shift once the engine is wired in.

## Part B rewritten (Oct 22, 2026, Dane)
- Part B (S4–S15) of RUNBOOK.md is replaced by `PART-B.md` (B1–B20, one screen or flow per prompt, eight-part format). Decisions are in `DECISIONS.md` and override RUNBOOK.md's Decisions list.
- The spec is `docs/demos/scheduler.html` and `docs/demos/daily-notes.html`.
- Next: B1 (not started).
