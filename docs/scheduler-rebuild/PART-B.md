# Scheduler & Notes rebuild — Part B (B1–B20)

Replaces Part B (S4–S15) of `docs/scheduler-rebuild/RUNBOOK.md`. Part A (S1–S3) is merged and stays as it is.
Owner: Dane. Written Oct 22, 2026 from two demos and the decisions in `docs/scheduler-rebuild/DECISIONS.md`.

**Kickoff line:** "Read CLAUDE.md, then `docs/scheduler-rebuild/PART-B.md`, `DECISIONS.md` and `PROGRESS.md`. Continue from the first prompt not marked merged. Post the plan and behavior table and wait."

**The spec is two demos** (open them in a browser; every button works):
- `docs/demos/scheduler.html`: top bar **Office** / **Team member phone**.
- `docs/demos/daily-notes.html`: top bar **Staff phone** / **Office**.

**Rules for this runbook:**
- One prompt = one screen or flow = one PR into `staging`, branched from `main`.
- If it's not in the demos or this file, it isn't built. Ask instead. The one exception is B3's drag to move, copy and resize, which Dane kept.
- Demo data (Maple House, Riley, Van 1) is made up. Build on real tables.
- **Not in Part B:**
  - host homes (HHS)
  - billing outputs and the 520 (`day_program_billable_v` and `hhs_daily_records_v` keep working unchanged)
  - payroll export and EVV export
  - SMS
  - printing
  - Excel import

---

## B1 — Foundations (no new screen)
1. **Job:** the scheduler and staff can't save, publish or clock into a shift the contract or the agency's rules forbid, and every later prompt has the columns it needs.
2. **Flow:** save shift, publish, clock in.
3. **Reference:** `src/lib/scheduler/rules.ts` (Part A).
4. **Behaviors:**
   - Saving, publishing, claiming and clocking in all run `rules.ts`.
   - A block finding stops the action and shows its one-line reason.
   - A warn finding shows and lets the action continue.
   - Each rule's strength comes from the agency's setting (Off / Warn / Require a reason / Block). Contract rules can't be set to Off, and double-booking always blocks.
   - Cards default to Warn.
   - Delete the DSI-over-6-hours rule and its tests. The SOW has no DSI daily cap.
   - Van shifts:
     - Staff under 18 are blocked (§1.5(1)).
     - Staff with no driver file on record get a reminder and are never offered the shift.
5. **Done when:**
   - Saving a shift for a team member on the client's do-not-schedule list is refused, and the reason shows.
   - A punch made from a scheduled shift is linked to that shift.
   - Assigning a 17-year-old to a van shift is refused.
   - Assigning someone with no driver file to a van shift saves, with a reminder.
   - `rules-warn.test.ts` has no DSI-hours case.
   - A grep for `job_code` and `from('locations')` in `src/` returns only types.
6. **Data:** additive migrations.
   - `teams`: `kind` (rhs_home / day_program / other), `site_lead_id`, `licensed_capacity`.
   - `scheduled_shifts`: `team_id` (client_id becomes nullable; one of the two is required), `open_spots`, `confirmed_at`, `cancelled_at`, `pattern_line_id`, `van_route_id`. A 1:1 shift sets both `team_id` and `client_id`.
   - `evv_timesheets.scheduled_shift_id`.
   - `client_billing_codes`: `worksheet_weekly_hours`, `worksheet_absence_days`, `ratio`.
   - The driver file is a new Evidence requirement: license, driving record and insurance (§1.30(2)).
   - Readers that must keep working: punch pad, client workspace clock-in, the `use-today-shift*` hooks, Form 520, progress summaries.
7. **Delete:**
   - the `dsi_over_6h` rule and its tests;
   - `client-codes.functions.ts`, `eligibility.functions.ts`, `required-qualifications.functions.ts`, after re-pointing their callers to `rules.ts`.
8. **Out of scope:** any screen.

## B2 — Settings
1. **Job:** the owner sets the agency's rules once, and changes them only where one home or program differs.
2. **Screen:** Settings (Office › Settings).
3. **Reference:** `scheduler.html` › Office › Settings, every section, including **Settings for <home>** opened from a home page.
4. **Behaviors:**
   - Every control saves on change and shows a toast naming what was saved.
   - Per-home overrides show only what differs from the agency default, with **Use agency default**.
   - Rule strength per rule: Off / Warn / Require a reason / Block. Contract rules have no Off.
   - Sections:
     - Shift types
     - Offering open shifts: offered to everyone qualified at once; per home, first claim or an approver picks; quiet hours and an urgent window.
     - When nobody picks it up: lead → on-call → owner, then the fairest hold-over, with the record.
     - Approvals per home
     - New hires: paired shifts until Evidence is done and a lead signs off per home
     - Overnight pay per home: pay every hour, a sleep rate, or exclude sleep on 24h+ shifts
     - Overtime, Holidays, Differentials, Who sees what, Notifications
     - Hours cap: agency-set only
5. **Done when:**
   - Changing Cards to Block makes an expired-card assignment refuse.
   - Setting Maple House's overnight pay to "sleep rate" shows only that override on Maple's settings.
   - Setting Maple's open shifts to "an approver picks" makes a claim there wait in Needs you.
   - Contract rules show no Off choice.
6. **Data:** `org_shift_behavior_settings.rule_settings` (exists) plus the columns or child tables these sections need. Per-home overrides are keyed by `teams.id`. Propose the schema in the plan.
7. **Delete:** any older scheduler settings UI and its readers.
8. **Out of scope:** Note settings (B18).

## B3 — The board
1. **Job:** the scheduler sees the week at a glance and fixes it in place.
2. **Screen:** Office › Scheduler (board), with its shift drawer, **Add a shift**, and **Find staff**.
3. **Reference:** `scheduler.html` › Office › Scheduler.
4. **Behaviors:**
   - Week and Month views.
   - Views: Homes & programs / Team members / Clients, with filters.
   - Stat tiles are clickable: open shifts, coverage gaps, over 40 h.
   - Clicking a chip opens the drawer: checks, who's been asked, Edit, Give it to someone else, Make it open, Cancel shift (Restore).
   - **+** on a team member's row opens Add a shift **locked to that person**.
   - Add a shift: Day → Where → Time → Who, ranked best fit first, with reasons; or leave it open with a number of spots.
   - Find staff: the ranked list; a "Require a reason" finding asks for the reason.
   - **Drag** a chip to another day or person to move it, **Alt-drag** to copy it, or drag an edge to change its time. Each drop runs `rules.ts`; a block snaps it back with the reason.
   - Van shifts show "Van 1 · 4 riders" with DSG + MTP.
   - 1:1 shifts show "1:1 · <client>".
   - **Undo** after any change.
5. **Done when:**
   - Clicking the coverage-gaps tile filters to the gaps.
   - **+** on Ava's row opens Add a shift with Ava locked.
   - Dragging a shift onto someone who's off is refused, and the reason shows.
   - Alt-dragging copies a shift.
   - Make it open, then Undo, restores the shift.
   - The route file is ≤ 80 lines.
6. **Data:** `scheduled_shifts` (owner `src/lib/scheduler/`). Rankings and checks come from `rules.ts` only.
7. **Delete:** `src/routes/dashboard.scheduler.tsx` (2,021 lines; keep pieces only by moving them), `homes-teams-board.tsx`, `open-shifts-panel.tsx`, `requests-panel.tsx`, `solo-lapse-dialog.tsx` (if unused), `nectar-bar.tsx` (if unused).
8. **Out of scope:** Publish and Copy week (B4), Needs you (B5).

## B4 — Publish and Copy week
1. **Job:** nothing broken reaches staff, and next week starts from this one.
2. **Flow:** the **Publish** and **Copy week** dialogs on the board.
3. **Reference:** `scheduler.html` › Scheduler › Publish / Copy week.
4. **Behaviors:**
   - Publish lists blocks first; Publish stays disabled until they're fixed.
   - Warnings need a reason, which is saved.
   - Open shifts are offered at publish.
   - Only team members whose shifts changed are notified.
   - Edits to a published shift stay "Changed · not sent" until **Send changes**; the team member taps **Got it**.
   - Copy week never overwrites a shift someone edited by hand.
5. **Done when:**
   - A week with a ratio block can't be published.
   - After Find staff → assign, it publishes.
   - Only changed staff get a notification.
   - Copying a week lands on the same weekdays.
6. **Data:** `scheduled_shifts`, `notifications`, plus a shift-changes record (before/after, sent, acknowledged).
7. **Delete:** `repeat-shifts-dialog.tsx`, `repeat.functions.ts`, `repeat-project.ts`, `recurrence.ts` (after B6), and the old publish path in `scheduler.functions.ts`.
8. **Out of scope:** rotations (B6).

## B5 — Needs you
1. **Job:** the scheduler only handles what the schedule can't settle itself.
2. **Screen:** Office › Needs you (its own page), plus the banner and count on the board.
3. **Reference:** `scheduler.html` › Needs you.
4. **Behaviors:** one card per item, most urgent first, with its fix buttons and a filter by kind. The kinds:
   - coverage gap
   - short staffed (ratio)
   - van without a driver: Find a driver / Offer to drivers / Move riders, limited by the other van's seats
   - 1:1 not covered
   - open visit
   - call-out
   - claim
   - swap
   - partial give-away
   - time off
   - punch fix
   - card expiring or expired
   - 1056 running low
   - overtime
   
   Also: **Start escalation**, which runs the ladder and then the hold-over pick with history, and **No staff needed…**, which saves a one-time or template exception with a reason. The app never creates an open shift by itself.
5. **Done when:**
   - Approving time off over a scheduled shift adds a card with Make it open / Find staff.
   - Van 2 with no driver shows its card, and Offer reaches drivers only.
   - Start escalation logs who was asked and the hold-over.
   - "No staff needed" removes the gap and keeps the reason.
6. **Data:** computed from the owner tables. Escalation and hold-over history and coverage exceptions get one table each (propose them in the plan).
7. **Delete:** any tray or panel version.
8. **Out of scope:** SMS.

## B6 — Rotations
1. **Job:** the week builds itself from each home's, program's and client's usual pattern.
2. **Screen:** Office › Rotations.
3. **Reference:** `scheduler.html` › Rotations (tabs per place, the 4-week preview).
4. **Behaviors:**
   - Add or edit a rotation line: who, pattern (5 on 2 off, 2-2-3, 4 on 3 off, set days), slot, start day.
   - The preview updates as you edit.
   - Drafts are built 4 weeks ahead and never overwrite a shift someone edited.
5. **Done when:**
   - A 2-2-3 line generates the right days for 8 weeks.
   - Editing a hand-moved shift's line leaves that shift alone.
   - Van lines create van shifts.
6. **Data:** pattern and pattern-line tables (propose them in the plan); `scheduled_shifts.pattern_line_id`.
7. **Delete:** `recurrence.ts` and its writers, `is_recurring` / `recurrence_*` writers (the columns drop in B20).
8. **Out of scope:** the board.

## B7 — Home page (RHS)
1. **Job:** a lead sees whether a home is covered and staffed to the Worksheet, and each resident's week.
2. **Screen:** a home page, opened from a home's name on the board.
3. **Reference:** `scheduler.html` › click **Maple House**, and **Cedar House** for Away times.
4. **Behaviors:**
   - Coverage by the hour, per day. A red stretch opens the gap dialog. **+ Add shift**.
   - Coverage templates: Insert into schedule / Remove.
   - Residents:
     - each one's info and absence days used of the Worksheet number;
     - Away times, with **+ Add away time** (days, time, where, details) and **Remove**;
     - when every resident is away, those hours need no staff.
   - Worksheet staffing hours: Worksheet vs scheduled with staff vs still open (§1.33).
   - 1:1 enhanced staffing: chips per day. The 1:1 shift names the client, doesn't count toward coverage, and needs a Form 930 on file (§21.3(4)).
5. **Done when:**
   - Adding Away times so both Cedar residents are out 9–3 weekdays turns those hours grey.
   - Saturday's open 1:1 shows red and appears in Needs you.
   - The Worksheet panel shows "short" until the open shifts fill.
   - Absence days show "x of y".
6. **Data:**
   - coverage needs, keyed by `teams` (reuse `location_coverage_requirements` re-keyed to `team_id`, or replace it; say which in the plan);
   - Away times (one owner table);
   - absence days from `client_absences` and `client_billing_codes.worksheet_absence_days`;
   - Form 930 from client approvals.
7. **Delete:** `src/routes/dashboard.homes.$teamId.tsx` (698 lines) and `homes-teams-board.tsx`; `/dashboard/homes` redirects.
8. **Out of scope:** host homes.

## B8 — Day program page and van routes
1. **Job:** the program lead sees who drives which van and who rides, and keeps routes right.
2. **Screen:** the day program page, opened from **Lehi Day Program** on the board.
3. **Reference:** `scheduler.html` › click **Lehi Day Program**.
4. **Behaviors:**
   - A card per van: vehicle, seats used, usual driver, ratio load, the driver per weekday (chips open the shift), and riders in pickup order.
   - **✎ Edit route** opens the editor:
     - vehicle;
     - usual driver (only staff 18+ with a driver file);
     - drag or ↑↓ to reorder riders;
     - pickup time and place per stop;
     - Remove sends the rider to the on-site group;
     - Add rider lists day program clients not on a van.
   - **Save route** is disabled, with the reason, when riders exceed seats or the ratio load is over 1.00.
   - The on-site group card, the weekly ratio table, and the "What the driver's taps record" list.
   - Hours vs Worksheet per client this month, with "Talk to the SC" past 0.75 h off (§7.6).
5. **Done when:**
   - Adding a 6th rider to a 5-seat vehicle disables Save, with the reason.
   - Reordering and saving changes the pickup order on the driver's phone.
   - Removing a rider puts them in the on-site group.
   - A non-driver isn't listed as usual driver.
6. **Data:** `vehicles`, plus new van route and stop tables (propose them; one owner each); `day_program_sessions` and `day_program_attendance` as the existing owners.
7. **Delete:** the old Day Program tab code, `day-program.functions.ts` leftovers, `day_program_transport` writers (rows merge into attendance).
8. **Out of scope:** the van run on the phone (B15).

## B9 — Time
1. **Job:** the scheduler approves punch fixes without chasing anyone.
2. **Screen:** Office › Time.
3. **Reference:** `scheduler.html` › Time (punches only).
4. **Behaviors:**
   - This week's punches, linked to their shifts.
   - Fix requests from team members, each with **Approve fix** or **Ask for more detail**.
   - The original punch and the fix both stay on record.
5. **Done when:**
   - Approving Dev's fix sets his clock-out.
   - The original time still shows in the history.
   - A punch with no shift shows as unscheduled.
6. **Data:** `evv_timesheets` (owner).
7. **Delete:** `src/routes/dashboard.timeclock.tsx` if it only duplicates this screen (check first).
8. **Out of scope:** payroll and EVV export, the History tab.

## B10 — Scheduling readiness
1. **Job:** the scheduler sees why someone can or can't be offered shifts, without editing anything here.
2. **Screen:** Office › Scheduling readiness.
3. **Reference:** `scheduler.html` › Scheduling readiness.
4. **Behaviors:**
   - Read only.
   - A matrix of cards (including Driver file) and person-specific training, with "Can be offered shifts at".
   - **Open in Evidence** per person.
5. **Done when:**
   - A team member with an expired card shows it in red with the date.
   - Open in Evidence lands on their Evidence row.
6. **Data:** `evidence_items` / `evidence_files` only, through `qualificationsOnDate`.
7. **Delete:** nothing.
8. **Out of scope:** editing cards.

## B11 — Messages
1. **Job:** each house's team talks in one place, not in personal texts.
2. **Screen:** Office › Messages.
3. **Reference:** `scheduler.html` › Messages.
4. **Behaviors:**
   - One channel per home or program.
   - Post a message; it shows for that home's team.
   - No client information in pushes.
5. **Done when:**
   - Priya's message in the Lehi channel shows for Lehi staff only.
6. **Data:** a new channel-messages table, one row per message (propose it).
7. **Delete:** nothing.
8. **Out of scope:** SMS.

## B12 — Phone: Today, Schedule, Open shifts
1. **Job:** a team member knows where to be, confirms it, and picks up hours without calling the office.
2. **Screen:** the team member phone, tabs Today / Schedule / Open shifts.
3. **Reference:** `scheduler.html` › Team member phone (try Ava, Leo, Theo, Priya).
4. **Behaviors:**
   - Today:
     - the next or current shift, with who else is on;
     - Confirm, Clock in, Details, Can't make it (with reason chips);
     - a van shift lists the riders; a 1:1 shift names the client;
     - card-expiring alerts.
   - Schedule: Week / Month, and **Confirm all**.
   - Open shifts: only ones this team member passes `rules.ts` for, with a pay estimate. **Take it** / **Pass**.
5. **Done when:**
   - Confirm sets confirmed.
   - Can't make it puts the shift in Needs you.
   - Taking an open shift creates a claim.
   - A non-driver never sees an open van shift.
6. **Data:** `scheduled_shifts`, `shift_callouts`.
7. **Delete:** `src/routes/dashboard.schedule.tsx`'s old body (919 lines; the route becomes ≤ 80).
8. **Out of scope:** notes and clock-out (B14, B15).

## B13 — Phone: Requests and Me
1. **Job:** a team member handles time off, availability, swaps and their own punches from the phone.
2. **Screen:** phone tabs Requests and Me.
3. **Reference:** `scheduler.html` › Team member phone › Requests, Me.
4. **Behaviors:**
   - Requests:
     - time off (lists the affected shifts before sending);
     - availability (days off, every other weekend, max hours);
     - give away part of a shift;
     - swap (only coworkers who pass `rules.ts`; the coworker accepts first).
   - Me:
     - cards with Upload;
     - punches with **Fix it** (sent to the lead);
     - notification settings: reminder lead time, quiet hours, digest.
5. **Done when:**
   - A time-off request shows in Needs you.
   - Marking Tuesdays unavailable greys them on the board.
   - A partial give-away shows only the uncovered part as open.
6. **Data:** `time_off_requests`, `shift_swap_requests`, a staff availability table (propose it).
7. **Delete:** `request-time-off-dialog.tsx`, `request-swap-dialog.tsx`.
8. **Out of scope:** everything else on the phone.

## B14 — Phone: RHS notes and clock-out
1. **Job:** before leaving, a home's staff member writes about every resident they supported, so leads don't chase notes later.
2. **Screen:** the phone during an RHS shift: Who's home, My notes, Group activities, House log, Before you clock out, and Sent back to you.
3. **Reference:** `daily-notes.html` › Staff phone › Sara, then Johnny.
4. **Behaviors:**
   - Who's home: Home / Away part of the day / Absence day. An absence day needs a reason and counts against the plan year. It also marks the client absent at their day program.
   - My notes: a section per resident home during the shift.
     - Tapping a goal opens a box for it, plus Other support.
     - A live word count against the agency minimum.
     - Autosave.
   - Group activity: 2+ residents and the minimum words. It counts for everyone tagged.
   - House log: one box. It never counts for a client.
   - Before you clock out lists everyone under the minimum or with an empty goal box. Each gets:
     - Go to section;
     - **I didn't support <name>** (Asleep my whole shift / With family or a visitor / Refused support / Another staff supported them);
     - **Supervisor override**, with a required reason from someone with timesheets:edit, saved to the audit log.
   - Sent back to you: **Fix entry** edits the text and sends it to the lead. The original is kept.
   - Entries after midnight file to the next day.
5. **Done when:**
   - Clock out is refused while Riley's section has 12 of 20 words.
   - Picking a goal with an empty box blocks clock-out until it's filled or unpicked.
   - A group activity tagged to Riley and Sam satisfies both.
   - Marking Jo's absence day shows her absent at Lehi.
   - A supervisor override needs a reason and shows on the timesheet.
   - A sent-back entry fixed on the phone returns to the lead with the original kept.
6. **Data:**
   - entries are `daily_logs` rows: add the entry kind (goal / other / group / house), the shift, the goal from `client_goals`, sent-back fields, and original text;
   - the client's day status is one owner table for RHS days (propose it; absences also write `client_absences`);
   - minimums are read from B18.
7. **Delete:** `daily-log-missing*` if replaced, and any clock-out note gate in the punch pad that this replaces.
8. **Out of scope:** AI. Nectar never drafts staff notes.

## B15 — Phone: DSG van run and notes
1. **Job:** a driver runs the route and writes the day's notes without extra steps, and every MTP and DSG record fills itself in.
2. **Screen:** the phone during a van shift: My van today, My notes, Before you clock out.
3. **Reference:** `daily-notes.html` › Staff phone › Priya.
4. **Behaviors:**
   - Steps Pickups → Program → Drop-offs, with taps:
     - **Picked up**: MTP pickup place and time; marks present.
     - **Not coming**: reason required; absent, no note owed, skips the drop-off.
     - **Arrived at <program / outing>**: MTP drop-off for everyone. By default it starts DSG.
     - **Heading home**: MTP pickup. By default it ends DSG.
     - **Dropped off**: MTP drop-off.
   - The DSG start and end follow the agency setting (B18).
   - A rider moved from another van shows why.
   - Notes:
     - one shared "What did the group do today?" box (minimum 20);
     - "How did <name> respond?" per rider (minimum 12), with an optional goal tag.
   - Clock-out needs the shared box, every response, and every drop-off. Supervisor override as in B14.
5. **Done when:**
   - Arrived is disabled until every stop is picked up or marked not coming.
   - A not-coming rider owes no note.
   - Hazel's daily note shows DSG times from Arrived and Heading home, and her van record shows all four legs.
   - With the setting on pickup→drop-off, her times change to the van times.
   - Clock-out is refused until Casey's response has 12 words.
6. **Data:** `day_program_attendance` (+ pickup and drop-off place and time per leg, driver, van route); `daily_logs` (kinds dsg_shared and dsg_response).
7. **Delete:** the S10-era Arrived/Left roster code, if any exists.
8. **Out of scope:** DSG/DSP code picking and billing.

## B16 — Review notes
1. **Job:** the site lead checks yesterday's notes for their home or program by noon without opening each one.
2. **Screen:** Review notes, which replaces the Daily Logs page at `/dashboard/daily-logs`.
3. **Reference:** `daily-notes.html` › Office › Review notes.
4. **Behaviors:**
   - Day tabs: yesterday "due noon" / today "still open".
   - A table per home or program: Client, Code, Writes the note (Everyone on shift, or the van group's driver), Written by, Entries, Status (Ready / Missing info / Sent back / Approved / Day still open / Absent), and **Open**.
   - **Approve N ready** per place.
   - At a program, the van groups with day-of moves.
   - Only the site lead (`teams.site_lead_id`) and owners and admins see a place.
5. **Done when:**
   - A note with a missing start time shows Missing info and isn't counted in Approve N ready.
   - Approve all approves only the Ready ones.
   - A scoped manager sees only their homes.
   - The old Daily Logs page is gone and its links go here.
6. **Data:** status is computed in one lib function from the B14/B15 tables.
7. **Delete:** `src/routes/dashboard.daily-logs.tsx` (1,333 lines). Update its links in `dashboard.tsx`, `dashboard.index.tsx`, `staff-bottom-tabs.tsx`, `nectar-pay-period-card.tsx`, `team-members/overview.ts`, `nectar-help.functions.ts`, `tour-anchors.ts`.
8. **Out of scope:** the daily note page (B17).

## B17 — The daily note
1. **Job:** the lead reads one note per client per day, fixes or sends back what's thin, and approves it.
2. **Screen:** a client's daily note, opened from Review notes and from the client's Activity & notes.
3. **Reference:** `daily-notes.html` › Office › Daily note.
4. **Behaviors:**
   - **How <client> was supported:** Nectar combines every entry (goal boxes, other support, group activities; at day programs, the shared activity plus that client's response) into one summary. Marked as a draft. **Edit** saves the lead's version and keeps the entries unchanged.
   - Signed entries in time order, each with **Send back to <staff>**, which needs a reason (chips or your own).
   - For context, "Around the house / program that day" shows the house or program log.
   - At day programs, the van record (both legs).
   - Contract check: the §21.3(9) or §7.3(6) fields, plus MTP §13.3(3), each ✓ or !.
   - **Approve as <site lead>** shows only when every check passes.
5. **Done when:**
   - Riley's Wednesday note combines Sara's and Johnny's entries and lists both as staff.
   - Edit and save keeps the original entries.
   - Send back removes the note from Ready until the staff member fixes it.
   - Approve locks it, and later changes are amendments.
   - A note with no entries can't be approved.
6. **Data:** one row per client per day per code holds the summary, the edit and the approval (propose where; reuse a table if one fits). Nectar runs through the existing Bedrock path and never invents content.
7. **Delete:** nothing beyond B16.
8. **Out of scope:** billing.

## B18 — Note settings
1. **Job:** the owner sets note rules once for the whole agency.
2. **Screen:** Note settings (Office).
3. **Reference:** `daily-notes.html` › Office › Note settings.
4. **Behaviors:**
   - Homes: words per client per shift (default 20).
   - Day programs: words per client response (default 12); the shared box uses the homes number.
   - DSG times: **Arrived → Heading home** (default) or **Van pickup → drop-off**, with the DSPD caution.
   - **Save minimums** shows a toast; values under 5 are refused with the reason.
5. **Done when:**
   - Changing the homes minimum to 30 changes the next shift's clock-out check.
   - Switching DSG times changes the times on daily notes for days after the change.
6. **Data:** agency settings (same owner as B2).
7. **Delete:** nothing.
8. **Out of scope:** per-home minimums.

## B19 — House log
1. **Job:** a lead sees chores and upkeep without mixing them into client notes.
2. **Screen:** Office › House log.
3. **Reference:** `daily-notes.html` › Office › House log.
4. **Behaviors:** day tabs, and a list per home or program of house-log entries, signed and timed. Read only.
5. **Done when:**
   - Sara's "Mopped the kitchen" shows under Maple House on Wednesday and in no client's note.
6. **Data:** `daily_logs` rows of kind house (B14).
7. **Delete:** nothing.
8. **Out of scope:** editing.

## B20 — Removals (only when Dane says "Run B20", after B1–B19 are on `main` and checked)
Drop what B1–B19 replaced:
- `scheduled_shifts.job_code`, `code_id`, `location_id`, `is_recurring`, `recurrence_*`, `claim_requested_by`, `is_awake_overnight`
- `locations`, `location_coverage_requirements` (if replaced), `day_program_transport`
- the never-published SLH drafts

Grep `pg_policies` and functions first. Never `CASCADE`. Keep anything under 7-year retention.
