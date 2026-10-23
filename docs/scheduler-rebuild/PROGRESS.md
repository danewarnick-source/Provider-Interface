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

## B1 — Foundations — PR OPEN (into staging)
- Branch `claude/jolly-planck-uz9pd6` from main. No new screen; the punch pad gains a "reason" dialog that only opens when an agency sets a rule to Require a reason.
- Settled with Dane (Oct 23): home kind = `teams.team_type` (rhs_home / day_program / other; group_home → rhs_home), site lead and note reviewer = `teams.manager_id`, licensed capacity = `teams.capacity`. Rule strengths live in `org_shift_behavior_settings.rule_settings` (agency only; per-home overrides in B2). Driver file = the three existing Evidence items, reviewed and current on the shift date. A van shift = `van_route_id` set (none exist until B8). MTP is never a shift code. Staff type their own reason at clock-in (saved on `evv_timesheets.override_reason`).
- Decisions made in B1 (later prompts don't reopen): fixed (always Block) = staff/client double-booking, minimum age, no authorization. Agency rules = rest, 16 h straight, overtime, fatigue, travel gap, preference, availability. Cards = the Evidence/training reminders and the driver file. Everything else is a contract rule (Warn / Reason / Block). A contract or fixed rule set to an unavailable choice keeps its default.
- One path: `rules.ts` → `shift-guard.server.ts` (facts from `rule-context.server.ts` + `rule-staff-facts.server.ts`). Save, publish (`publish.functions.ts`, still all-or-nothing), claim, approve claim, copy week, repeat, Nectar drafts (`drafts.functions.ts`) and clock-in (`clock-in.server.ts`) all call it.
- Deleted: shifts.functions.ts, client-codes.functions.ts, eligibility(.functions).ts + test, required-qualifications.functions.ts, shift-checks.ts + test, shift-commit.ts, locations.functions.ts, location-type.ts, launchpad-gate.test.ts (it tested a copy), publishShiftsWithNotify, readinessWarnings / isCprQualificationKey, the dsi_over_6h rule.
- Phase B (apply after B1 is on main): `20261023052600_scheduler_b_drop_job_code.sql`.
- Notes for later prompts: B2 edits `rule_settings` with `strengthChoices()`; B3 needs RLS for team shifts (`client_id` null) and must send `override_reason` when a save needs one; B5 shows `evv_timesheets.override_reason`; B6 / B8 add the `pattern_line_id` / `van_route_id` foreign keys; B12 must allow staff to set `scheduled_shifts.confirmed_at` (staff update guard). The punch pad still runs the Nectar staff-prerequisite gate; retire it when the phone clock-in is rebuilt (B14). `test:unit` runs the scheduler tests only when the first list passes (`&&`), so they are skipped while its 8 known failures remain.
