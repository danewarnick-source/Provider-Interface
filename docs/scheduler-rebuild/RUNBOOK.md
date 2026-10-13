# Scheduler Rebuild — Runbook (Part A: S1–S3 · Part B: S4–S14 · S15 morning only)

_Updated Oct 12, 2026 (evening): adds the Scheduler Rebuild Gap Review (Decisions 18–25: every contract code's rules, overnight and same-day disruption, ease-of-use features). Earlier the same day: Jeff's Oct 7 decisions (Evidence is the only source for cards and training; reminders, not blocks; admins create open shifts themselves) and the Oct 12 staff-data trace fixes. Changes from the Oct 6 version are listed at the end._

Owner: Jeff (Dane Warnick). Repo: danewarnick-source/Provider-Interface. Live Supabase project: dhrrukdcigiiqksibdfb (NEVER refrpqrxpjeqmygxgekp).
Plan of record: "Scheduler rebuild plan" (Claude Docs). Clickable references: "Scheduler — Live Demo" (Oct 7, the latest board) and "Staff Phone Demo" (Oct 12, the Schedule tab and on-shift screens the phone steps S12–S14 must match). Related: "Staff View Plan" (Claude Docs), whose staff-app steps reuse what S12–S14 build.

This runbook covers the admin scheduler AND the staff phone in one round. It runs in two parts:

- **Part A (S1–S3)** touches no Clients tables, so it can run in a second Claude Code session **at the same time as the Clients rebuild**.
- **Part B (S4–S14)** starts only **after the Clients rebuild (P1–P11) and Part A are merged to `main`**, because it uses the Clients rebuild's `client_absences`, `client_staff_exclusions`, `client_contacts`, client code rows and the Homes route.
- **S15** drops tables. It runs only after Part B is merged to `main` and Jeff has checked it.

---

## DECISIONS (all agreed by Jeff, Oct 6, 2026; build exactly to these)

1. RHS **home shifts** and DSG **session shifts** have no client (`scheduled_shifts.client_id` null, `team_id` set). The resident's day card and the DSG roster carry the client side.
2. Clock-out with required daily notes missing is **blocked**, with a supervisor override that needs a reason.
3. The week starts **Sunday** everywhere (matches the SOW's Sun–Sat week for CMP/CMS).
4. Minimum staff age follows the SOW: 16; 18 to drive a client or for DCFS/DJJYS clients; 21 for HHS/PPS. Agency setting can raise the floor to 18.
5. Daily RHS plus hourly DSI/SEI on the same date is **allowed** as long as times don't overlap another service for that resident.
6. RHS "Away" days: agency setting, default **billable when a daily note exists**.
7. DSG short day (≤ 4 h) for a client with no DSP authorization: bill DSG and **flag** it for review.
8. Open-shift claims: **scheduler approves** by default; agency setting can switch to first qualified claim wins.
9. Cost per home is visible only to owners and anyone with `financial_reports` access.
10. The 198 never-published SLH drafts are cleared (S15).
11. Remove ACA and CHA from the EVV list and RL6 from the daily codes (not in DHHS91172).
12. Nectar in the scheduler: rank staff for open slots and draft DSG session notes. **No** auto-scheduling.
13. Assumed ratio: **warn** at publish; becomes a **publish block 15 days after** the code's `authorization_approved_on`.

### Added Oct 7, 2026 (Jeff)

14. **Evidence is the only source of truth for cards and training.** The scheduler never stores its own "turned in" flag and never has a "mark it done" button. One function in `rules.ts` answers, per shift: does this team member hold a valid, reviewed, unexpired qualification **on the date of this shift** for every qualification the shift's code (and client) requires? Today that answer is spread over `eligibility.functions.ts`, `conflicts.functions.ts`, `staff-qualifications.functions.ts` (`evidence_items` + `evidence_files`), `hive_training_assignments`, `training_completions`, `nectar_compliance_rules` with a hardcoded fallback map, and CPR as a separate readiness rule with the 90-day hire grace. Consolidate into that one function.
15. **Expired or missing training and cards are reminders, not blocks** ("We don't block shifts, we remind"). The reminder links to the person's Evidence row ("Open Leo's Evidence") and never clears itself. On the staff phone, "Upload new card" opens the existing Evidence upload for that requirement. The reminder clears only when the new file is uploaded, **reviewed (approved)** and expires **after** the shift date. Between upload and review it reads "New card uploaded, waiting for review". If the new card still expires before a later shift, that shift keeps its reminder.
16. **PI never creates open shifts on its own.** The old plan to auto-generate DSG open slots from ratio math is dropped. Admins create open shifts themselves: any place or client, any day, any time (to the minute), any code, and how many spots (1+), from "Add a shift" ("Make it an open shift"), the + in the Open shifts row, or the buttons on a Needs you reminder. Open shifts are posted to qualified team members when the week is published (or right away if it already is). Ratio math (DSG staff needed = ceil(Σ 1/ratio)) and home coverage hours stay as **Needs you reminders** ("Lehi Day Program: Mon 0 of 2") with buttons to add a shift or add open shifts. An open shift doesn't count as coverage until someone is assigned.
17. A shift a staff member gives up ("Can't make it") or that approved time off covers is **not** silently re-posted: it shows in Needs you with **Make it an open shift** (one tap, posts to qualified staff), **Find staff**, or **Leave it**. This keeps decision 16 (the admin decides) and the Staff Phone Demo's "posted to qualified coworkers" once the admin taps it, or automatically only if the agency turns on "Re-post call-outs automatically" (default off).

### Added Oct 12, 2026 (Jeff, from the Scheduler Rebuild Gap Review)

18. **Rules for every contract code, screens only for codes agencies use.** `rules.ts` covers every code in DHHS91172 and its rate table (respite RP2–RP5 and RPS, nursing PM1/PM2/PN1/PN2, behavior BC1–BC3, SED, SEE, SJD, EPR, TFB, PBA and the rest). Codes without their own screen are scheduled as ordinary shifts on the board and are checked by the same rules. Only RHS homes (S8–S9), host homes (S9), DSG/DSP day programs (S10) and the hourly codes on the board get dedicated screens. No respite, nursing or behavior-consult screens.
19. **2:1 stays as it is:** a hard block without a rights modification (§1.33(2)). No emergency or temporary 2:1 window for now.
20. **Hold over:** Needs you can extend a shift as "mandated" with a reason; the rolling 16-hours-in-24 check is a warning, logged.
21. **Text messages** for open shifts, call-outs and changes, with a tap-to-accept link, only to staff with recorded SMS consent and never with client information in the text.
22. **Auto-approve swaps and pickups that pass every rule:** an agency setting, off by default.
23. **Approving punches against the schedule and payroll export** are built in S11.
24. **Asleep overnight:** PI tracks the sleep window and interruptions; whether sleep time is paid is an agency setting (paid, or unpaid only with 5+ uninterrupted hours).
25. **Client staffing preferences** (such as same-gender personal care) are a warning by default; an agency can make one a block.

---

## HOW TO RUN THIS (read first, Claude Code)

You are running unattended. Jeff will tell you which part to run ("Part A" or "Part B"). **Never run S15** unless Jeff's message says "Run S15".

1. Read `CLAUDE.md` first and obey it. Then read this whole file once.
2. Integration branch:
   - **Part A:** `scheduler-rebuild-a`. If it exists on origin, check it out; otherwise create it from latest `main`.
   - **Part B:** first confirm with `git log origin/main` that the Clients rebuild (P1–P11) and Part A are on `main` (look for their merged PRs, and check that `client_absences` and `client_staff_exclusions` exist in `supabase/migrations/`). If not, stop and say so. Then create `scheduler-rebuild-b` from latest `main`.
   - Make sure `docs/scheduler-rebuild/` on the branch holds this file as `RUNBOOK.md`. Commit and push.
   - Supabase: confirm you can apply migrations to live `dhrrukdcigiiqksibdfb` (Supabase MCP or CLI). If you can't, still write each migration file, mark it `NOT APPLIED` in the PR body, and continue only if the prompt's code doesn't depend on it; otherwise stop.
3. For each prompt in the part, in order:
   a. Start a **fresh subagent** for the prompt. Give it the Decisions, the Standard Rules and that prompt, verbatim.
   b. It works on branch `<integration-branch>/sN-<short-name>` cut from the current tip of the integration branch.
   c. Before finishing it must pass: `npm run build` (commit the regenerated `src/routeTree.gen.ts`), `npx tsc --noEmit` with **no new errors vs. the start of the prompt** (record the count before and after), `npm run test:unit`, and the prompt's "Done when". Run any e2e configs the prompt names.
   d. Open a PR into the integration branch titled `Scheduler rebuild SN: <name>`. The body lists what changed, files added and deleted, line counts before → after for every touched file, migrations applied, test results, and anything skipped.
   e. If every check passes, **squash-merge it into the integration branch** and continue to the next prompt.
   f. If a check fails and you can't fix it within the prompt's scope after two honest attempts: leave the PR open, put `BLOCKED: <reason>` at the top of its body, and **stop the run**.
4. At the end of the part (or a stop), open one PR from the integration branch → `staging` titled `Scheduler rebuild Part A (S1–S3)` or `Part B (S4–S14)`. Body: a table of the step PRs with status, total scheduler-area line count before → after, every migration applied to live, and a "Check on staging" click-through list.
5. Never merge anything into `staging` or `main` yourself. Jeff does.
6. **Clean slate after every PR (context hygiene):**
   - All of a prompt's work happens inside its subagent. The subagent starts with only the Decisions + Standard Rules + that prompt + the repo.
   - The subagent returns **only** a ≤ 10-line report: PR number and link, merged yes/no, checks passed, migrations applied, files added and deleted counts, anything blocked.
   - You keep only those reports. Don't read diffs or big files yourself; start a small subagent if you need a fact.
   - Before the next prompt, `git fetch` and start from the current tip of the integration branch.
   - Append each report to `docs/scheduler-rebuild/PROGRESS.md` on the integration branch (commit it). If the run is interrupted, read PROGRESS.md and continue from the first prompt not marked merged.
7. **Running beside the Clients rebuild (Part A only):** stay on your own branch. Touch no file under `src/lib/clients/`, `src/components/clients/` or any client route. If `src/integrations/supabase/types.ts` conflicts when rebasing, regenerate it from the live schema instead of hand-merging.

---

## STANDARD RULES (every prompt)

- Read CLAUDE.md first. Never read or write the `role` column. Never PostgREST-embed organization_members↔profiles (two queries, join in JS).
- **Database:** every change is a migration in `supabase/migrations/` named for what it does, applied to live `dhrrukdcigiiqksibdfb`. S1–S14 are **additive only**: new tables/columns, backfills, functions, RLS, relaxing a NOT NULL. **No drops, renames or type changes** before S15; the live DB is shared with production `main`. Regenerate `src/integrations/supabase/types.ts` from live after any migration.
- **No hard deletes** of shifts, punches, attendance or notes (7-year Medicaid retention). Use status/`cancelled_at`/`ended_on`. The only exception is S15's 198 never-published drafts, which were never service records.
- **No PHI** in code, tests, fixtures, logs or PR text. Fixtures use made-up people.
- **Organization:** scheduler logic lives in `src/lib/scheduler/`; scheduler UI in `src/components/scheduler/` (subfolders `board/`, `rows/`, `homes/`, `roster/`, `phone/`, `shared/`). No barrel `index.ts` files. Use `git mv` so history is kept.
- **Size limits:** route files ≤ 80 lines, components ≤ 250, lib files ≤ 300. Split before merging. Existing oversized files you don't touch are reported, not split.
- **Delete what's unused:** when a prompt replaces something, delete the old file/function/component/route/test/type in the same PR. Grep every removed export and confirm zero imports. No commented-out code, no "legacy" copies.
- **Writes go through server functions** guarded with `requireCategory` (`src/lib/access/require.ts`): schedule writes → `scheduling:edit`; timesheet edits → `timesheets:edit`; cost figures → `financial_reports:view`. Staff acting on their own shifts (confirm, can't make it, claim, clock) are checked by ownership, not category. If the actor's scope isn't agency-wide, also require `access_can_see_client` for any client involved.
- **One rule engine:** after S3, every "can this shift exist?" question goes through `src/lib/scheduler/rules.ts`. No new ad-hoc checks anywhere else.
- **Times:** all date math in America/Denver via one helper (`src/lib/scheduler/time.ts`, S1). Never `new Date("YYYY-MM-DD")`. Weeks start Sunday.
- **Tests:** every new or changed lib file gets a `*.test.ts` next to it, added to the `test:unit` list in package.json. Update e2e mocks (`e2e/helpers/mock-hive.ts` and fixtures) when routes or data shapes change.
- **Wording in UI:** plain English, "team member" and "client", no SOW citations except small "§" hints where the plan shows them.
- **Don't break** these readers of shifts and punches (re-point them when data moves): EVV punch pad (`components/evv/punch-pad.tsx`), client workspace clock-in (`routes/dashboard.workspace.$clientId.tsx`), `hooks/use-today-shift.tsx`, `hooks/use-today-shifts.tsx`, `hooks/use-active-shift.tsx`, My Schedule (`routes/dashboard.schedule.tsx`), the medications Give meds component (the Client Medications rebuild on branch `meds-rebuild` deletes `routes/dashboard.emar.tsx`; don't run S4 or S14 while that rebuild's M5 is running, since both touch `punch-pad.tsx`), Form 520 (`routes/dashboard.billing.form520.tsx`), Nectar staff (`lib/nectar-staff.functions.ts`), progress summaries (`lib/progress-summaries*.ts`), obligation escalation (`lib/obligations/escalation.ts`), audit packet (`lib/audit-packet.functions.ts`), general time clock (`hooks/use-general-shift.tsx`).

---

# PART A — can run alongside the Clients rebuild

## S1 — Safety fixes (no redesign)

**Goal:** what's broken today works, and nothing looks different.

1. Migration `…_scheduler_safety_rls.sql`: recreate every RLS policy on `day_program_sessions`, `day_program_session_staff`, `day_program_attendance` and `day_program_transport` with the `is_org_admin_or_manager` / `is_org_member` arguments in the right order (they are swapped today, so nothing can save). Fix the `scheduled_shifts` insert/update policy so a manager with `scheduling` edit access (via `access_has_category`) can write, not only org admins. Write a SQL check in the PR showing a scoped manager can insert.
2. `src/lib/scheduler/time.ts`: `startOfWeek` (Sunday), `dayKey(date)` in America/Denver, `parseLocalDate`, `toLocalRange`. Replace the Monday-based `startOfWeek` in `components/scheduler/repeat-shifts-dialog.tsx` and the UTC time-off date check in `lib/scheduler/scheduler.functions.ts`. Test with TZ=America/Denver around midnight and DST.
3. `applyDrafts` (`lib/scheduler/setup.functions.ts`) and `decideClaim` (`lib/scheduling/open-shifts.functions.ts`) must run the same checks `saveShift` runs (client authorized for the code, staff on the client's team with that code, staff not on approved time off) before writing.
4. `publishWeek` (`scheduler.functions.ts`): before flipping `published`, run those same checks on every shift in the week. Return the failures and publish nothing if any fail. The current UI shows them in a simple list. (S7 replaces this with the full publish screen.)
5. `shift-commit.ts`: the billing-conflict detection result must be used. Overlapping services for one client throw a clear error, on insert **and** update.
6. Shift page (`routes/dashboard.shift.$shiftId.tsx`): its clock-in must go through the punch pad's checks and use the shift's own `service_code`, never a default of "RHS".
7. `hooks/use-active-shift.tsx`: an open punch from a previous day must not show as the current shift. Show "You have an open punch from <date>. Fix it" instead.
8. Remove the forbidden members↔profiles embeds in `lib/scheduler/setup.functions.ts` (~:282) and `lib/scheduler/import.functions.ts` (~:57): two queries, joined in JS.
9. Access: the Scheduler route uses `requireCategory('scheduling','view')` instead of `can('create_shifts')`. My Schedule and the shift page check that the viewer is the shift's staff member or has `scheduling` view.
10. **Staff only see published shifts** (Oct 12 trace): `routes/dashboard.schedule.tsx` and `hooks/use-today-shifts.tsx` read `published = true` (they show 198 drafts today). Migration: replace the `scheduled_shifts` SELECT policy (`is_org_member`, so every member reads every shift) with: admins and `scheduling` viewers see all; staff see their own shifts, published open shifts, and shifts on clients or homes they're assigned to.
11. **Notifications stop failing silently:** add the types the code sends to `notifications_type_check` (`swap_request`, `swap_partner_accepted`, `swap_approved`, `swap_assigned`, `shift_claim_request`, `shift_claim_approved`, `shift_claim_denied`, `shift_declined`, `shifts_published`, `shift_changed`, `callout`), change the `'employee'` recipient role to `'staff'`, and replace the swallowed insert errors with logged errors.
12. **Swaps:** the coworker can't accept or decline today (no UPDATE rule for `to_staff_id`, and open swaps are invisible to coworkers), so `respondToSwap` silently does nothing. Add `partner_status` and `partner_responded_at` and a server function in `lib/schedule-requests.ts` (moved to `lib/scheduler/requests.ts` in S2) that lets the named coworker respond; the scheduler still approves. `swaps.functions.ts` has no callers and is still deleted in S2.
13. **Call-outs:** stop writing "sent" `callout_escalation_events` for alerts that were never sent (the shift page logs "Shift opened to qualified staff" without doing it). Until S7, a call-out only notifies the scheduler.

**Done when:** a scoped manager can save a shift; a day program session can be created on live; a staff member sees no drafts and no other team member's shifts; a swap request notification row is saved; publishing a week with a shift for an unauthorized code is refused with the reason; copying a week lands on the same weekdays; unit tests cover `time.ts`; build/tsc/unit pass.

---

## S2 — Cleanup and folders (no visible change)

**Goal:** delete everything unused, put the rest in two folders, app behaves the same.

1. Delete (confirm zero importers first, list each in the PR): `components/scheduling/add-segment-dialog.tsx`, `components/scheduler/index.ts`, `lib/scheduler/index.ts`, `lib/scheduling/conflicts.functions.ts`, `lib/scheduling/swaps.functions.ts`, `lib/scheduling/coverage-count.ts`, `lib/scheduling/auto-assign.functions.ts`, `lib/scheduling/targets.functions.ts`, `lib/day-program.functions.ts`, `lib/nectar-schedule-actions.functions.ts`, `lib/nectar-schedule-parse.functions.ts`, `lib/rhs-board-scoring.ts`, `lib/rhs-board.functions.ts`, `lib/schedule-preview-mutations.ts`. **Keep** `lib/scheduling/conflicts.ts` (S3 turns it into the rule engine).
2. Redirect routes: update every link (including notifications in `workflow.functions.ts` and `schedule-requests.ts`, and e2e) to `/dashboard/scheduler`, then delete `dashboard.scheduling.tsx`, `dashboard.schedule-preview.tsx` and `dashboard.day-program.tsx`. **Leave `dashboard.clients.rhs-board.tsx` and `dashboard.teams.tsx` alone**: the Clients rebuild owns them.
3. `git mv` into `src/lib/scheduler/`: everything left in `src/lib/scheduling/`, plus `lib/schedule-requests.ts` → `requests.ts`, `lib/schedule-staff-clock.ts` → `staff-clock.ts`, `lib/day-program-billing.ts` → `day-program.ts`, `lib/hhs.functions.ts` → `hhs.functions.ts`. Delete the empty `src/lib/scheduling/`.
4. `git mv` UI into `src/components/scheduler/`: `components/scheduling/*` and `components/schedule-preview/*` (into `shared/` for now). Delete the empty folders.
5. Hooks used only by the scheduler (`use-scheduler-data`, `use-schedule-preview`, `use-day-program-data`) → `components/scheduler/shared/hooks/`.
6. Fix `day-program.ts` comments: DSI is SOW Article 8 (not 9).

**Done when:** `src/lib/scheduling`, `src/components/scheduling` and `src/components/schedule-preview` no longer exist; a repo-wide grep for each deleted export returns nothing; build/tsc/unit and the scheduler e2e config pass; screens look identical.

---

## S3 — The rule engine (pure logic, not wired in yet)

**Goal:** one tested place that answers "can this shift exist, and why not?" using the SOW and the agreed decisions.

1. Turn `lib/scheduler/conflicts.ts` into `lib/scheduler/rules.ts` (+ `rules-*.ts` splits to stay ≤ 300 lines). Pure functions only, no database calls. Input: the proposed shift(s) plus a context object (authorizations with units left and `authorization_approved_on`, client ratios with `confirmed`, team membership, do-not-schedule list, staff trainings and certs and age and driver's license, time off, availability, existing shifts and segments, Form 930 and rights modifications on file, licensed capacity, agency settings).
2. Output per finding: `{ rule, level: 'block'|'warn', message, fix? }`. Messages are one plain line, for example "Maria isn't trained for Ben yet (Person-specific)".
3. Rules (SOW rules always on; Agency rules have an on/off + level setting):
   - Block: no authorization that day, or units would go over (§2.1(5)(J)); not on the client's team; on the do-not-schedule list; staff inactive or on approved time off; same staff in two places (a segment inside its own parent shift is fine); client double-booked or two services at once (§2.1(5)(G)); SEI with SEE or SJD the same day; under the minimum age (Decision 4); RHS 1:1 of 4+ hours/day with no Form 930 (§21.3(4)); 2:1 with no rights modification (§1.33(2)); group over the staff needed from client ratios, or over licensed capacity; CMP/CMS over 8 h/day or 40 h/week Sun–Sat; ELS over 6 h/day or 260 days/year or before absence days are used up; segment outside its parent shift.
   - Warn (Decision 15, reminders not blocks): solo before the 23 general trainings or the client's person-specific training (§1.8(4)); first aid/CPR expired or past 90 days; code-specific qualification missing; driving without a license on file. Each comes from one function, `qualificationsOnDate(staff, shift, evidence)` (Decision 14), that reads only Evidence (reviewed, unexpired on the shift's date, with "uploaded, waiting for review" as its own state) and returns a `fix` linking to that person's Evidence row. DSI over 6 h; weekly hours below the Worksheet; behavior training past 180 days; overtime / under 8 h rest / over 16 h straight (Agency); **assumed ratio** (Decision 13: warn, block once 15 days have passed since `authorization_approved_on`).
3a. **Every contract code (Decision 18).** Add these rules, each citing its section in the finding (block unless marked warn):
   - **All codes:** no shift on a day the client is a hospital inpatient (the admission day is blocked, the discharge day is allowed) or in jail (§2.1(5)(A),(K)), read from `client_absences` and `client_days`.
   - **Allowed overlaps:** BC1–BC3, HSQ, PM1, PM2, PBA, PN1 and PN2 may overlap other services (§2.1(5)(G)); exclude them from the "two services at once" block.
   - **Asleep time** (SLH, SLN, CMP, CMS) is not billable (§31.4(4), §32.4(6)): a contract warn on overnight shifts without an awake slot, replacing the old Agency setting; S14 asks for awake confirmation.
   - **DCFS and DJJYS custody:** COM and HSQ are barred for DCFS or DJJYS clients (§6.4(3), §12.3); SLH, SLN, CMP, CMS, RP2–RP5 and TFB are barred for DCFS clients (§31.4(2), §32.4(2), §22.4(1), §23.4(1), §24.4(1), §25.4(1), §36.3(3)).
   - **Supported Living and respite:** no more than 4 hours of SLH/SLN when overnight respite falls in the same 24 hours (§31.4(3), §32.4(3)); no RP2–RP5 daily rate on a day with more than 4 hours of SL (§22.4(2), §23.4(2), §24.4(3), §25.4(3)).
   - **Code by staff relationship (§32.6):** parent, step-parent or guardian → CMP; spouse → CMS; anyone else → SLN. Scheduling the wrong one of the three is a block with the right code as the fix.
   - **MTP:** only with DSG, DSP, EPR or SED on the same day (§13.1, §9.2(7), §28.2(5)); never with DSI (§8.4(4)); not more MTP days than day-support days billed in the month (§13.4(3)).
   - **Respite:** facility 1:6; staff's own home 1:3 counting the staff member's own children and others under 14 (§22.3(1)); RP4, RP5 and RPS not in the client's home, and RPS not in a relative's or staff home (§24.4(2), §25.4(2), §26.4); RP3 and RP5 need Form 929 on file (§23.3(1), §25.3).
   - **Nursing:** PM1/PM2 not billable when the client gets PN1/PN2 (§16.3, §17.3); PN1 only when the agency provides the client's RHS, HHS, PPS or SLH, with PN2 oversight (§18.4); PN2 never daily and session on the same day, daily needs an in-person visit, more than 3 days in a week is a warn needing a reason (§19.4, §19.7); PM1 needs an LPN license, PM2 an RN (qualification check).
   - **Behavior consults (BC1–BC3):** no direct support or transport on those shifts (§3.5); license tier by code.
   - **Host homes and PPS:** client 18+ for HHS (§11.2(1)), under 22 for PPS (§20.1); one client per home unless an exception is on file (§11.3(7), §20.3(7)); no HHS and PPS clients in the same home (§11.4(4)); respite in the home at most 14 consecutive days and 21 days per Plan Year, other-home respite at most 20 days per Plan Year (§11.3(7)(D), §11.4(9), §20.3(7)(D), §20.4(9)).
   - **RHS:** not when the client lives with an immediate relative or guardian (§21.4(1)).
   - **Supported employment:** SED work groups of 2 to 8 people (§28.2(1)); SJD not for clients under 14, at most 80 hours per client (120 with approval on file) (§33.4(2),(4)); SEI telehealth only combined with in-person (warn) (§30.2(1)(E)).
   - **EPR:** at least 20% community time each month (warn) and a 24-consecutive-month limit (§9.3(1), §9.4(2)).
   - **DSP extended:** 10-hour maximum (§7.6(b)). **DSI:** not mostly site-based in any Sun–Sat week (warn) (§8.4(5)). **DSG:** not solely in the client's home or a staff home (§7.4).
   - **TFB:** not with RHS, HHS, PPS or SLH without written Director approval on file (§36.3(1)).
   - **ELS by HHS/PPS staff:** only with the 4 documented conditions on file (§10.4(4)).
3b. **`lib/scheduler/billing-mode.ts`** (pure): one table of every code's unit and billing modes from the rate table, and `billingFor(code, minutes, day)`: COM bills daily when more than 6 hours in a 24-hour day (§6.6), PAC when more than 8 hours (§14.5), RP2 and RP3 when 6 or more hours (§22.6, §23.6), otherwise quarter hours rounded per entry; DSI and SEE bill as daily tiers of 1 to 6 hours (rate-table note 2); DSG/DSP code picking stays in S10. Billing and the burn-down (S10, S11) read this; nothing else decides units.
3c. **Also in `rules.ts`:** a rolling 16-hours-in-24 fatigue check (Agency warn) that counts holdovers and staff-declared outside hours; time-window requirements on home slots and sessions ("7–9 a.m.: 1 med-trained"), checked through `qualificationsOnDate`; client staffing preferences (Decision 25); a travel-gap warn when back-to-back hourly shifts at different addresses are less than 20 minutes apart (agency can change the minutes).
4. `lib/scheduler/ratios.ts`: `staffNeeded(clientsPresent)` = Σ 1/ratio, rounded up (1:6 → 1/6, 1:3 → 1/3, 1:1 → 1, 2:1 → 2). Ratio defaults when none is entered: DSG/DSP/EPR/RPS 1:6, RP2–RP5 1:6 in a facility and 1:3 in a staff home, SED by work group (2–8), DSI 1:1, SLH/SLN/COM/PAC/SEI 1:1, RHS/HHS/PPS null ("not set"), each marked `assumed: true`.
5. `lib/evv-codes.ts`: remove ACA, CHA and LPS (none are in DHHS91172); fix RP3's label. Remove RL6 from the daily codes (Decision 11). Make `service-billing.ts`'s daily-code list come from `billing-mode.ts` (it misses PN1 and the daily modes of COM, PAC, RP2, RP3, EPR, PN2). Update their tests.
6. `minStaffAgeForCode` follows Decision 4 (move it into `rules.ts`; delete the old one in `code-colors.ts`).
7. Delete `org_shift_behavior_settings` readers that only the old engine used; the new settings shape is read in S4.
8. Mark (don't delete yet) the old qualification paths that S4 re-points to `qualificationsOnDate`: `eligibility.functions.ts`, `staff-qualifications.functions.ts`, `team-members/readiness.ts`'s CPR rule and the `nectar_compliance_rules` fallback map. List them in the PR.

**Done when:** `rules.test.ts`, `ratios.test.ts` and `billing-mode.test.ts` have at least one passing and one failing case per rule and per code (including COM at 6 h vs 6 h 15 m, DSI tiers, SLH asleep, a DCFS client on COM, MTP with DSI, PM1 with PN1, and HHS respite day 22) (and `qualificationsOnDate` has cases for reviewed, waiting for review, expiring before vs after the shift date, and the 90-day CPR grace), including the worked example 9 at 1:6 + one at 1:3 + one at 1:1 = 2.83 → 3; the old `conflicts*.ts` files are gone; build/tsc/unit pass.

---

# PART B — only after the Clients rebuild and Part A are on `main`

## S4 — One source per fact + wire the engine in

**Goal:** one place for each fact, and the rule engine runs at save, publish and clock-in.

1. Migration `…_scheduler_single_sources.sql` (additive):
   - `teams`: add `kind` ('rhs_home'|'hhs_home'|'day_program'|'other'), `geofence_lat`, `geofence_lng`, `geofence_radius_m`, `site_lead_id`, `licensed_capacity` (copy `capacity`). Backfill from the 1 `locations` row; point `day_program_sessions.location_id` readers at a new `day_program_sessions.team_id` (backfilled).
   - `scheduled_shifts`: add `team_id` (→ teams), `pattern_line_id` (null for now), `confirmed_at`, `cancelled_at`, `open_spots` (int, default 1, for an open shift posted for several people; claiming one spot creates an assigned copy and lowers the count). Relax `client_id` to nullable with a check: `client_id is not null or team_id is not null` (Decision 1).
   - `evv_timesheets`: add `scheduled_shift_id` (→ scheduled_shifts), backfilled where a punch matches a shift (same staff, overlapping time, same client or team).
   - `client_billing_codes`: add `worksheet_weekly_hours`, `worksheet_absence_days`, `ratio` ('1:6','1:4','1:3','1:2','1:1','2:1'), `ratio_when` text, `ratio_source` text, `ratio_confirmed_at`, `ratio_confirmed_by`. Copy `client_weekly_targets` and `client_ratios` rows if any.
   - `org_shift_behavior_settings`: add a `rules` jsonb of `{rule: {on, level}}` for Agency rules, plus `open_shift_mode` ('approve'|'first_claim'), `min_staff_age_floor` (16|18), `away_days_billable` (bool, default true).
2. Code: read `service_code` only (stop reading `job_code` and `code_id`). Read homes and programs from `teams` only (stop reading `locations`).
3. Punch pad: when a staff member clocks in on a scheduled shift, store `scheduled_shift_id`. Clock-in runs `rules.ts` for that shift and blocks on a block finding.
4. Wire `rules.ts` into `saveShift`, `applyDrafts`, `decideClaim`, `publishWeek` and the punch pad, replacing S1's interim checks. Context is loaded once per request by `lib/scheduler/rules-context.functions.ts`. Re-point every qualification reader listed in S3 step 8 to `qualificationsOnDate` and delete the old paths (Team Members readiness and the scheduler must now agree on every card and training).
4a. `org_shift_behavior_settings` also gets `repost_callouts_automatically` (bool, default false; Decision 17), `auto_approve_requests` (bool, default false; Decision 22), `sleep_time_paid` ('paid'|'unpaid_if_5h'; Decision 24), `travel_gap_minutes` (default 20), `request_notice_days` (default 14).
4c. **Context data for the new rules (Decision 18), additive migration `…_scheduler_rule_context.sql`:**
   - `clients.custody` ('none'|'dcfs'|'djjys', default 'none') and `clients.lives_with_relative_or_guardian` bool. Show both on the client's Profile (Clients guard for writes).
   - `staff_client_relationships` (organization_id, staff_id, client_id, relationship 'parent'|'step_parent'|'guardian'|'spouse'|'other_relative'). Edited on the client's Team section.
   - `client_staffing_preferences` (organization_id, client_id, kind 'gender'|'other', value, applies_to text, requested_by 'person'|'guardian'|'team', decided_on, level 'warn'|'block').
   - `client_approvals_on_file` (organization_id, client_id, kind 'form_929'|'tfb_director'|'hhs_extra_client'|'sjd_120h'|'els_hhs_conditions'|'original_packaging', document_id, valid_from, valid_to). The rules read approvals from here.
   - `staff_outside_hours` (organization_id, staff_id, week_start, hours, note): staff declare second-job hours for fatigue checks.
   - `on_call_shifts` (organization_id, team_id null for agency-wide, staff_id, backup_staff_id, starts_at, ends_at). Edited on the board (an On call row) and shown in Needs you.
   - `org_holidays` (organization_id, day, name); the Staff view shows holidays worked per person this year.
   - `vehicles` (organization_id, name, seats, wheelchair_spots, active) for day program rides.
   - `shift_tasks` (organization_id, shift_id or pattern_line_id, text, due_time null, done_at, done_by) and a `handoff_note` on `scheduled_shifts`; both show at clock-in.
4b. `scheduled_shifts` also gets `is_training_shift` (bool), `trainer_staff_id`, and `involves_driving` (bool) (Staff View Plan F2, F6): the vehicle check before clock-in and the new hire's "training shift with Tom" read these.
5. Client profile → Services → code row: add a **Staffing** card (ratio, when it applies, source, confirm button; 2:1 needs the rights modification upload; RHS 1:1 4+ h/day needs Form 930 upload). This file lives under `src/components/clients/profile/services/`; keep it ≤ 250 lines and use the Clients guard for writes.

**Done when:** saving a shift for a staff member on the client's do-not-schedule list is refused with the reason; a punch is linked to its shift; a grep for `job_code` and `from('locations')` in `src/` returns only types and the S15 drop list; build/tsc/unit/e2e scheduler pass.

---

## S5 — The board

**Goal:** the week grid from the demo, with the Staff view, the shift card and the staff picker.

1. `routes/dashboard.scheduler.tsx` becomes a ≤ 80-line route that renders `components/scheduler/board/board.tsx`. Delete the old 2,000-line page in this PR, moving any piece still needed into the new folders.
2. Board: week header (Sun–Sat, prev/next, Day/Week/Month; Month read-only), status pill (Draft/Published), view switch (Staff / Homes & programs / Clients; only Staff is built here, the other two show "coming in S8/S11"), legend, and the right-side tray placeholder (filled in S7).
3. Staff view (`rows/staff-row.tsx`): an "Open shifts" row on top, then one row per staff member with weekly hours (amber at 36+, red over 40), time off and unavailable times greyed. On a phone-width screen the grid scrolls sideways with the name column pinned; the tray moves above the grid.
4. Shift card (`board/shift-card.tsx`): click an empty cell to add (who, where = client/home/program, code, time to any minute, **Make it an open shift** with number of spots, Training shift with trainer, Involves driving). The + in the Open shifts row opens the same card set to open. Drag to move, Alt-drag to copy, drag an edge to resize. Every change runs `rules.ts` live; block findings show inline with the one-line reason and stop the save.
5. Staff picker (`board/staff-picker.tsx`): ranked best-first (qualified and trained, available, no overtime, has worked with this client or home, by count). Staff who can't take it are shown greyed with the reason. Client ratio badges (dashed with "?" when assumed) show on chips and in the picker.
6. Draft chips are dashed, published are solid, open are striped, confirmed get a ✓.

**Done when:** the Staff view matches the demo; drag/copy/resize persist and are blocked by a failing rule; e2e covers add, move and a blocked save; each file within size limits.

---

## S6 — Standard weeks and rotations

**Goal:** the week builds itself.

1. Migration `…_scheduler_patterns.sql`: `schedule_patterns` (id, organization_id, owner_kind 'team'|'client'|'staff', owner_id, kind 'week'|'rotation', cycle_days, anchor_date, active) and `schedule_pattern_lines` (id, pattern_id, staff_id null, team_id null, client_id null, service_code, day_offset, start_time, end_time, slot_id null, segment_of_line_id null). RLS: `scheduling` view/edit.
2. `lib/scheduler/patterns.ts` (pure): expand patterns into draft shifts for a date range, including rotations (2-2-3 Pitman, 4-on/4-off, every other weekend, custom N-day) and planned DSI/SEI segments; skip days with approved time off (they become open shifts). Tests for each rotation.
3. `patterns.functions.ts`: keep **4 weeks of drafts** built ahead (run on page load and nightly with the existing cron mechanism); never overwrite a shift someone edited. Editing a generated shift asks "Just this week, or from now on?"; "from now on" edits the pattern line.
4. Pattern editor UI (`board/pattern-editor.tsx`) for a staff member, client or home; rotation picker with the 14-day preview from the demo.
5. Copy week (merge or replace) and the fixed Excel import (`lib/scheduler/import.functions.ts`) create drafts through the same path.
6. Delete `repeat-shifts-dialog.tsx`, `lib/scheduler/repeat.functions.ts`, `recurrence.ts` and the unused recurrence columns' writers (columns themselves drop in S15).

**Done when:** a rotation generates the right days for 8 weeks; editing "from now on" changes future drafts only; no shift is generated without an end date.

---

## S7 — Publish, the Needs you tray, open shifts and requests

**Goal:** the scheduler only handles exceptions, and nothing broken reaches staff.

1. Needs you tray (`board/needs-you-tray.tsx`, one data call): coverage and ratio reminders ("Lehi Day Program: Mon 0 of 2", "Maple House Tue 2–6p: 1 of 2") with **Add a shift** and **Add open shifts** buttons (PI never creates them itself, Decision 16; open shifts don't count as coverage until assigned), card and training reminders linking to the person's Evidence row (Decision 15), block and warn findings for the visible week, call-outs, time off and swap requests, unconfirmed staff after publish, assumed ratios, residents below Worksheet hours. Each item has its one-click fix (Find staff opens the picker; Approve/Deny; Accept with reason; Use ratio from PCSP / Keep).
2. Publish screen: runs `rules.ts` over the week; blocks listed first (Publish disabled until fixed), warnings accepted with a reason saved to the audit log, open slots "will be posted to qualified staff". On publish, notify **only staff whose shifts changed** since the last publish (existing `notifications` table).
3. Open shifts (created only by an admin, Decision 16): offered only to staff who pass `rules.ts` for it, posted at publish (or right away if the week is already published). Claim mode per Decision 8. A released shift or one covered by approved time off goes to Needs you with Make it an open shift / Find staff / Leave it (Decision 17), unless the agency turned on automatic re-posting.
4. Time off and swaps (existing `time_off_requests`, `shift_swap_requests`, `lib/scheduler/requests.ts`): shown on the grid and in the tray; approving time off over a scheduled shift puts that shift in Needs you (Decision 17). Swaps: the coworker accepts first (S1 step 12), then the scheduler approves; the coworker list is filtered by `rules.ts`.
5. My Schedule (`routes/dashboard.schedule.tsx`): light touch only so it reads the new shifts (team shifts, segments, cancelled) correctly. The phone redesign is S12.
6. Call-outs: replace the shift page's call-out panel with a server function used by S12; the tray shows each call-out with Find staff and Make it an open shift. The scheduler board reads `shift_callouts`.
8. **Hold over (Decision 20):** on a call-out or a no-show for the next shift, Needs you offers "Hold over <name>": extends their shift to cover, runs the fatigue check, saves "mandated" and the reason.
9. **Fill by text (Decision 21):** "Text available staff" sends the open shift to qualified, rested staff with SMS consent (first-come or scheduler-approves per Decision 8); each open shift shows outreach: "Sent to 7 · 2 declined · 1 interested · 40 min ago" with Send to more. Staff can Decline from the text or the app. Messages carry no client information, only "An open shift is available in PI" and the link.
10. **Close or partly close a program day:** one action marks the session closed or short-staffed, marks expected attendees absent (RHS residents get absence days and their homes get daytime coverage needs), cancels rides and tells the affected staff.
11. **Give up part of a shift:** staff (S12) or admins can split a shift and post only the uncovered part.
12. **Notice period:** time off or unavailability sent with less than `request_notice_days` notice is flagged "short notice" in Needs you (still allowed).
13. **Auto-approve (Decision 22):** when the setting is on, swaps and pickups that pass every rule are approved immediately and noted in the audit log.
14. **Printable weekly schedule** per home and per program (PDF with `pdf-lib`), for the house wall and surveys.
15. **Phone width for admins:** the Needs you tray, Find staff → Assign, Hold over and Text available staff all work at 390 px.
7. **Changes after publish** (Staff View Plan F2): migration adds `scheduled_shift_changes` (shift_id, changed_by, changed_at, before jsonb, after jsonb, sent_at, acknowledged_at, acknowledged_by). Edits to a published shift stay pending until **Send changes**, which records the change, marks the shift Changed and notifies that team member; their **Got it** sets `acknowledged_at`. Publish notifications use this table to notify only changed staff.

**Done when:** e2e: publish refused with a DSG ratio block, then succeeds after Find staff → Assign; only changed staff get notifications; approving time off puts the shift in Needs you, and Make it an open shift posts it; PI never creates an open shift without an admin action; Hold over extends a shift and logs it; Text available staff records outreach; closing a program day marks attendees absent.

---

## S8 — Homes view, RHS coverage, residents' daytime services

**Goal:** RHS is scheduled to the home, with each resident's day visible on top.

1. Migration `…_scheduler_home_coverage.sql`: `home_coverage_slots` (id, organization_id, team_id, name, days int[], start_time, end_time, staff_needed, awake bool, one_to_one_client_id null, active). Copy any `location_coverage_requirements` rows. RLS: `scheduling`.
2. `lib/scheduler/coverage.ts` (pure): suggested slots from residents' ratios and Worksheet hours per time of day; coverage by hour (needed vs placed); residents' day lanes (home / Away / DSG roster times / SEI shift / DSI segment); **coverage left behind**: when a segment or outing leaves residents at home below what they need, return a warn finding with the hour range. Tests include the demo case (Eli home at 2p while Theo is out with Rosa until 3p).
3. Homes & programs view (`rows/home-row.tsx`): one row per home with each slot per day and a coverage meter; Day view per home shows the hour strip, slot lanes, the 1:1 lane and each resident's day lane. Programs show staff vs staff needed from the expected roster (from client ratios).
4. Home page (`components/scheduler/homes/home-page.tsx`, route `/dashboard/scheduler/homes/$teamId`): Coverage, Residents' days (S9), Slots & rotation tabs, header with site lead, licensed capacity, next evacuation drill due (quarterly, from the obligations already tracked), and cost per home (Decision 9).
5. **Away** blocks on a resident's standard week (school, job, another provider's program): stored as `schedule_pattern_lines` with `service_code = 'AWAY'`, not billed. They lower the home's needed coverage for those hours.
6. DSI/SEI segments inside a home shift (`parent_shift_id`), planned on the standard week, run through `rules.ts` (no overlap with the resident's other services, units, coverage left behind).
7. The Form 930 block for RHS 1:1 4+ h/day shows on the home page with the upload button (from S4's Staffing card).
7a. **Slot requirements:** each home slot can carry time-window requirements ("7–9 a.m.: 1 med-trained"), optional handoff overlap minutes, and a type: awake or asleep overnight with a sleep window (Decision 24).
7b. **Live coverage:** changing a resident's day card (hospital, away, stayed home from DSG) recalculates that home's coverage for those hours right away and raises a Needs you item to add or cut staff.
8. Move the old homes board (`homes-teams-board.tsx`, `dashboard.homes.$teamId.tsx`) into this page and delete them; `/dashboard/homes` redirects here. `dashboard.host-home-control.tsx` stays read-only and is linked from each HHS home's row.

**Done when:** the demo's Maple House Coverage tab works with real data; a planned DSI that leaves a resident alone shows the warning; Worksheet hours per resident show "x of y h".

---

## S9 — RHS day cards and absence days

**Goal:** the RHS bill comes from each resident's day card, not from a fake per-client shift.

1. Migration `…_scheduler_client_days.sql`: `client_days` (id, organization_id, client_id, team_id, day date, code 'RHS'|'HHS'|'PPS', status 'home'|'absence_day'|'hospital_admit'|'hospital'|'hospital_discharge'|'away'|'respite_in'|'respite_out'|'jail'|'moved_out', reason, **overnight_stayed bool, overnight_confirmed_at, overnight_confirmed_by** (HHS and PPS), note_id null, billable bool, billable_reason text, source 'auto'|'roster'|'staff'|'host'|'admin', unique (client_id, day, code)). Backfill HHS overnights from `hhs_monthly_attendance` (Present = stayed overnight). RLS: `scheduling` view, write via server function; staff on that home's shift that day can set Home/Absence day with a reason.
2. `lib/scheduler/client-days.ts` (pure): billable when authorized + status allows + a daily note exists from staff who worked in that home that day (via `scheduled_shift_id` on punches). Hospital: admission and inpatient not billable, discharge billable (§2.1(5)(A)); jail not billable; moved-out day not billable for the off-boarding provider; Away per Decision 6. **HHS and PPS: no billing without `overnight_stayed = true` (§11.4(8), §20.4(8)).** Respite counters: respite in the home at most 14 consecutive days and 21 days per Plan Year, other-home respite at most 20 days (§11.3(7)(D), §11.4(9)). Tests for each, including an HHS day with a note but no overnight (not billable).
3. A nightly job creates each RHS resident's card for the day. A DSG roster "Absent" for an RHS resident sets that day to `absence_day` with source 'roster' (wired in S10). Absence days also write `client_absences` (Clients rebuild) for the date and reason.
4. Absence counter: used vs `worksheet_absence_days` for the plan year. When used up, the tray and home page prompt "Add ELS block (up to 6 h)", `rules.ts` enforces ELS 6 h/day and 260 days/year, and PI drafts the Support Coordinator notice (contact from `client_contacts`) for a human to send.
5. Rebuild `hhs_daily_records_v` on `client_days` (for HHS and PPS too; no fan-out per code), **keeping every column it has today** so production keeps working. A day bills only when the note is **approved** (not sent back) and is for that code. Billing reads it.
6. Residents' days tab on the home page, as in the demo: one card per resident per day, click to change status, counts ready / waiting on a note / not billable.
7. The host's day card (Staff View Plan host home Today card) writes `overnight_stayed` and the away reason to `client_days` through a server function; once it does, delete the `hhs_monthly_attendance` writers (the side-effect upsert in `hhs.functions.ts`) and `setAttendance`. Never remove the overnight check.
8. A non-billable **hospital sitter** shift type for staff who stay with a hospitalized resident.

**Done when:** unit tests cover every status; a week with one missing note shows 1 "waiting"; an HHS day with a note but no confirmed overnight shows "Not billable: no overnight stay"; the old view's duplicate per-code rows are gone.

---

## S10 — DSG: sessions, roster check-in, code picking

**Goal:** DSG works end to end, on a tablet or phone.

1. Program setup on the Homes & programs view: a `teams` row of kind 'day_program' with days, hours, licensed capacity and the usual roster (pattern lines per client). Sessions are created from it by the S6 pattern job.
2. Migration (additive): `day_program_attendance` adds `pickup_time`, `pickup_place`, `dropoff_time`, `dropoff_place`, `driver_staff_id`, `note_id`, `flag` text. Merge any `day_program_transport` rows into it.
3. (Decision 16: the staff-needed number creates Needs you reminders with Add a shift / Add open shifts; it never creates shifts.) Today's roster (`components/scheduler/roster/*`, route `/dashboard/scheduler/roster/$sessionId`): one-tap Arrived / Left / Absent (time stamped, editable with a reason), ratio badges per client (dashed "?" when assumed), the live **staff needed** meter (Σ 1/ratio vs staff clocked in to the session, naming the client that tips it), staff list with Clock in, ride button per client, authorization burn-down per name. Works at phone width with 44 px targets.
4. `lib/scheduler/day-program.ts`: code picking from hours and authorization: ~4–7 h DSG daily; ≤ 4 h DSP by the 15 minutes if authorized, else DSG flagged (Decision 7); 7–10 h DSP extended if authorized; DSG + DSP the same day when two programs. Bands are an agency setting. Monthly average check per client creates a tray item suggesting a talk with the Support Coordinator.
5. Close session: every attending client needs a summary note; "Draft notes with Nectar" drafts from the session's activity (Decision 12), staff edit and sign. Closing writes billing rows (`day_program_billable_v` rebuilt and read by billing) and MTP rows (only on days with DSG/DSP billed, ride logged).
6. Absent RHS residents → `client_days.absence_day` (S9).
7. Delete any old Day Program tab code left in the scheduler.
8. MTP rows also for SED and EPR attendance; never for DSI (S3 rule). Rides pick a vehicle from `vehicles`; a run over its seats or wheelchair spots is a block.
9. **Breaks:** a Break button on the roster takes a staff member out of the live staff-needed meter until they tap Back; agency setting "On-duty meals" (no automatic meal deduction).
10. **Close the day:** the S7 close action from the roster header.

**Done when:** the demo flow works on staging: Lucas (1:1) arriving with 2 staff turns the meter red; clocking in a third fixes it; closing the session produces DSG/DSP rows and MTP rows; unit tests cover code picking and staff needed.

---

## S11 — Clients view and cost per home

1. Clients view (`rows/client-row.tsx`): rows for clients with hourly codes; scheduled hours against the 1056 as a burn-down per code ("SLH 212 / 520 h"); DSI segments shown inside their home shift.
2. Cost per home (Decision 9): scheduled hours × `profiles.hourly_rate` vs the home's daily rates × residents for the week, on the home page header and the Homes row; hidden without `financial_reports` view.
3. Scheduled vs worked hours per staff member for the week (from linked punches), shown in the Staff row tooltip.
4. **Punches against the schedule (Decision 23):** a weekly list of exceptions (late, early, no punch, unscheduled punch, open punch, edited time) with one-click Approve or Send back, then a payroll export (CSV: staff, date, code, client or home, start, end, hours, regular vs overtime, holiday flag) per pay period from `time_pay_settings`.
5. Projected unit run-out date per code ("SLH runs out about Mar 3 at this pace"); SJD hours used of 80; EPR months used of 24; HHS/PPS respite days used.
6. **One "on track" line on the client's Services & billing card (Jeff, Oct 13: keep it simple).** Under each code's existing pace line, add a single sentence from the published schedule, e.g. "With the shifts on the schedule, Mia is on track to use about 1,010 of 1,040 units by Sep 30, 2027." No new numbers, bars or charts. If the schedule would go over, the same sentence says so in the warning color. That component lives in the Clients area (`components/clients/profile/services/authorization-card.tsx`); keep the change to that one line and its helper.

**Done when:** a user without `financial_reports` can't see cost figures (server-checked); burn-down matches `client_billing_codes` minus scheduled and billed units.

---

## S12 — Staff phone: My Schedule

**Goal:** what staff see and do on their phone, as in the demo's Staff phone screen.

1. Rebuild `routes/dashboard.schedule.tsx` (≤ 80 lines) on `components/scheduler/phone/*`, phone first (390 px), matching the Staff Phone Demo's Schedule tab: **My shifts / Open shifts / Requests** (Requests holds Time off, Availability and Swaps). Shift sheet: code, time, place, who else is on (from the staff directory, not `profiles`), Directions, **Swap**, **Can't make it**; a changed shift shows "Changed · was 2:00–6:00 PM" with **Got it** (S7 step 7). The Staff View Plan's later staff-app steps reuse these components rather than rebuilding them.
2. My shifts: upcoming published shifts only, with place, code, segments; "Confirm all" after a publish and per-shift **Confirm** (sets `confirmed_at`); **Can't make it** with reason chips → releases the shift (S7 call-out function) into the scheduler's Needs you (Decision 17).
3. Open shifts: only ones this staff member passes `rules.ts` for; ones they can't take show the reason with a link (e.g. "Needs MANDT on file" → Upload it, Decision 15). **Pick up** follows Decision 8 (request → scheduler approves, or first qualified claim wins).
4. Clock-in from a scheduled shift opens the punch pad with the shift prefilled.
4a. **Reminders and alerts:** a reminder 1 hour before each shift (app, and text with consent); if nobody has clocked in 10 minutes after a shift starts, the on-call person (S4 `on_call_shifts`) and the scheduler get an alert, with a backup after 15 more minutes. Open shifts can be declined.
5. Delete the old My Schedule components replaced here.

**Done when:** e2e: confirm a shift, release a shift (appears open on the board), pick up an open shift (appears in the tray for approval).

---

## S13 — Staff phone: availability and requests

1. Migration `…_scheduler_staff_availability.sql`: `staff_availability` (id, organization_id, staff_id, weekday, start_time null, end_time null, kind 'unavailable'|'preferred', note). RLS: staff edit their own; `scheduling` view.
2. Availability (under Requests): the Staff Phone Demo's week grid of Morning / Afternoon / Evening (stored as weekday rows with times: morning 6a–12p, afternoon 12–5p, evening 5–11p; agency can change the blocks). The board greys those times; the picker and `rules.ts` treat unavailable as a warn (staff may still be asked).
3. Time off and swap requests from the phone (time off lists the shifts it affects before sending; swaps pick from coworkers who pass `rules.ts`, and the coworker accepts or declines before the scheduler approves), using the existing request tables and `lib/scheduler/requests.ts`; replace `request-time-off-dialog.tsx` and `request-swap-dialog.tsx` with phone versions and delete the old ones.

**Done when:** an unavailable day shows on the board and lowers that staff member in the picker; a time-off request appears in the tray.

---

## S14 — Staff phone: on shift (DSI/SEI segments, notes at clock-out)

1. On a home shift, the phone lists the home's residents with where each is right now (from S8's day lanes). **Start DSI** / **Start SEI** shows only when the resident is authorized for that code with units left. Before starting, run `rules.ts` including coverage left behind; a block stops it, a warn asks to confirm. Start creates a segment (`parent_shift_id` = the home shift) with a start time; **End** sets the end time and asks for the segment's note. Pay keeps running on the home shift; billing uses the segment.
2. Clock-out (Decision 2): list every required note not yet done for this shift: RHS daily notes for residents of that home without one today, segment notes, client shift notes. If any are missing, clock-out is blocked with "Write notes" (Nectar drafts them). A supervisor override (staff with `timesheets:edit`) can allow it with a reason, saved to the audit log and shown on the timesheet.
2a. **Overnight and handoff:** at clock-out from an SL overnight, confirm the person was awake-supported or log asleep time (not billable). On an asleep overnight slot, a "Woke up" button logs each interruption for the sleep-pay rule (Decision 24). At a home clock-out, if relief hasn't clocked in and the home would drop below coverage, warn "Relief not clocked in" and ask for a reason (the on-call person is alerted). Shift tasks and the handoff note show at clock-in and can be checked off.
2b. **EVV exceptions:** every location or time mismatch needs a reason code; a weekly exception list for admins, with a warning before the 3-month UEVV submission deadline.
3. Delete the shift page's own clock-in/out code if the punch pad now covers it, and turn `routes/dashboard.shift.$shiftId.tsx` into a read-only shift summary or a redirect (grep links first).

**Done when:** e2e: start and end DSI from a home shift creates a segment with its own times; clock-out with a missing RHS daily note is blocked, then allowed after the note is written or with a supervisor override.

---

## S15 — Removals (ONLY when Jeff says "Run S15", after Part B is on `main` and checked)

Drops, applied to live only after the rebuild is on production:
1. Clear the 198 never-published SLH drafts (`published = false`, `created_from` the old repeat path, starting on or before 2027-12-08; list the exact count first and stop if it isn't 198 ± what Jeff approves).
2. Drop tables (confirm 0 rows or fully copied first, compare counts): `recurring_shift_patterns`, `shift_templates_backup_20260928b` (export its 36 rows to a CSV in the PR first), `locations`, `location_coverage_requirements`, `client_ratios`, `client_weekly_targets`, `home_designations`, `day_program_transport`, `hhs_monthly_attendance`, `callout_escalation_events`, `home_staff_designations` (after its rows, if any, are in `staff_assignments`).
3. Drop columns: `scheduled_shifts.job_code`, `code_id`, `is_recurring`, `recurrence_rule`, `recurrence_end_date`, `location_id`, `is_awake_overnight`, `claim_requested_by`; `day_program_sessions.location_id`; `teams.capacity` (after confirming `licensed_capacity` is read everywhere).
4. Drop functions and triggers only those columns or tables used.
5. Regenerate types; run `npx knip` and delete every unused file and export it reports in the scheduler area; grep each dropped name in `src/` → zero.
6. Delete `docs/scheduler-rebuild/`.
7. PR body: rows and columns removed, final scheduler-area line count vs. the 17,822 starting point.

---

## WHAT CHANGED SINCE THE OCT 6 VERSION

- Decisions 14–17 added (Oct 7): Evidence is the only source for cards and training, through one `qualificationsOnDate` function; those checks are reminders, not blocks; admins create every open shift (with a spot count); released shifts and time-off conflicts go to Needs you instead of auto re-posting.
- S1: staff see only published shifts and only their own (plus assigned clients and homes, plus open shifts); notification types fixed; swap partner can respond; fake call-out events stopped (Oct 12 trace).
- S3/S4: training, CPR, qualification and license checks moved from Block to Warn; old qualification paths re-pointed and deleted; new shift fields `open_spots`, `is_training_shift`, `trainer_staff_id`, `involves_driving`; setting `repost_callouts_automatically`.
- S7: Needs you reminders with Add a shift / Add open shifts; change tracking after publish with Got it.
- S9: billable only with an approved note for that code (Oct 12 trace found sent-back and other-code notes counted).
- S12–S13: phone screens match the Staff Phone Demo (My shifts / Open shifts / Requests).
- Coordination: don't run S4 or S14 at the same time as the medications rebuild's M5.
- Gap review (Decisions 18–25): rules for every contract code with screens only for codes agencies use; `billing-mode.ts` for quarter-hour vs daily and DSI/SEE tiers; the HHS/PPS overnight rule kept and moved to `client_days`; asleep time as a contract rule; overlap exceptions; DCFS/DJJYS exclusions; SL and respite limits; relationship-based CMP/CMS/SLN; MTP, nursing, respite, SJD, EPR and TFB rules; LPS removed; on-call, hold over, fill by text with outreach, close a program day, partial give-up, notice period, auto-approve setting, printable schedules, slot time windows and sleep windows, live coverage from day cards, hospital sitter, vehicles, breaks, punch exceptions and payroll export, run-out dates, reminders and no-clock-in alerts, relief check, EVV reason codes. 2:1 unchanged (Decision 19).

---

## KICKOFF MESSAGES (paste into Claude Code)

**Part A, tonight, in a second session beside the Clients rebuild:**

> (If you attached this file instead of pushing it: "Create branch `scheduler-rebuild-a` from latest main, save the attached file as `docs/scheduler-rebuild/RUNBOOK.md`, commit and push. Then…")
>
> Read `docs/scheduler-rebuild/RUNBOOK.md` on branch `scheduler-rebuild-a` and run **Part A (S1–S3)** exactly as written: one subagent and one PR per prompt into `scheduler-rebuild-a`, merging each only when every check passes, stopping on a blocker. Another session is running the Clients rebuild at the same time, so touch no client files. When done, open the `scheduler-rebuild-a` → `staging` PR with the summary table. I'm asleep; don't wait for me.

**Part B, after the Clients rebuild and Part A are merged to `main`:**

> Read `docs/scheduler-rebuild/RUNBOOK.md` (copy it from `scheduler-rebuild-a` if it isn't on main) and run **Part B (S4–S14)** exactly as written on a new integration branch `scheduler-rebuild-b` from latest main: one subagent and one PR per prompt, merging each only when every check passes, stopping on a blocker. Do not run S15. When done, open the `scheduler-rebuild-b` → `staging` PR with the summary table. I'm asleep; don't wait for me.

**S15, only after Part B is on `main` and checked:**

> Read `docs/scheduler-rebuild/RUNBOOK.md` and run S15 exactly as written. Run S15.
