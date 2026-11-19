# B6 plan: Rotations

Status: **built** (Nov 19, 2026; branch claude/busy-cray-w323d6, see PROGRESS.md). Dane: yes to all 9 questions. Spec: `docs/demos/scheduler.html` › Rotations (tabs per place, the 4-week preview, `dlgRot`). Step text: PART-B.md › B6.

## 1. Job
The week builds itself from each home's and client's usual pattern, so the scheduler only handles what's different.

## 2. What's there today
- **`recurring_shift_patterns`:** **0 rows.** It's built on a weekday mask, so it can't express cycles like 2-2-3 or 5 on / 2 off.
- **`scheduled_shifts.pattern_line_id`, `is_recurring`, `recurrence_rule`, `recurrence_end_date`:** all unused (0 rows set).
- **`recurrence.ts`:** used only by its own test.
- **Copy week** (B4) is the only way to fill a week today.
- **`scheduler-tick`** runs every 5 minutes on production, so it can keep weeks filled.

## 3. The change
**Scheduler › Rotations** (`/dashboard/scheduler/rotations`): one tab per home and per client *(question 7)*, each with a count of its lines.

**A rotation line** = who + pattern + time slot + cycle start:
- **Who:** a team member, or **Open** (an open shift every time) *(question 8)*.
- **Pattern** *(question 6)*: 5 on / 2 off · 2-2-3 · 4 on / 4 off · 4 on / 3 off · Set weekdays (e.g. Mon–Fri, Mon/Wed/Fri) · Every other weekend · Custom cycle (e.g. 6 on / 1 off).
- **Slot:** a B2 shift type (Day 7a–3p, Evening, Awake night, …) or a custom time, plus the service code. Client visits use the client's active codes.
- **Cycle starts:** a date. The pattern counts from there.
- **Ends:** never, or a date. Ending keeps past weeks as they were.

Each tab lists its lines, with **Edit** and **End**. **+ Add a rotation** opens the editor with a **4-week preview**: dates, hours per week, and flags (time off, over 40, card expiring), updating as you edit.

**How weeks are built** *(questions 3–5)*
- **Drafts, 4 weeks ahead, rolling.** They're built when a line is saved, and topped up daily by `scheduler-tick`.
- **Never overwrites.** Editing a generated shift by hand (drag, reassign, time) **detaches** it from its line *(question 2)*, so later changes to the line leave it alone. A day that already has a shift for that person or client is skipped.
- **Changing a line** rebuilds only the drafts still attached to it. Published shifts stay as they are; change them on the board, then Send.
- **Blocked copies become open shifts.** If the person can't take a generated shift (approved time off, expired card, over the cap), it's created as an **open** draft, shows in Needs you, and is offered at Send. Same as Copy week.
- Every generated shift runs through the rule engine. No rules of its own.

**On the board:** generated shifts look like any other draft. The drawer shows "From rotation: Maria · 5 on / 2 off" with **Open rotation**.

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Rotations (menu / board link) | Opens Rotations | Hidden without `scheduling` view | First place's tab |
| Place tab | Shows that place's lines | — | Lines + 4-week summary |
| + Add a rotation | Editor, Who first | Hidden without `scheduling` edit | Editor with live preview |
| Editor fields | Update the preview | — | Dates, hours and flags for 4 weeks |
| Save rotation | Saves; builds drafts 4 weeks ahead through the rule engine | Disabled until who, pattern, slot and start are set | "Rotation saved · N shifts drafted" |
| Edit (line) | Editor with current values | — | On save: "N drafts updated; hand-edited shifts left alone" |
| End (line) | Asks the end date | — | "Rotation ends Dec 1; past weeks unchanged" |
| Drawer › Open rotation | Opens that line | Shown only on a generated, still-attached shift | Rotations, line open |
| Copy this week instead | Opens B4 Copy week | — | Copy week dialog |

## 5. Data
**Reuse the empty `recurring_shift_patterns` as the rotation-line table** *(question 1)*. Add:
- `team_id` (home), so a line is for a home or a client;
- `service_code`;
- `shift_type`;
- `cycle int[]`: on/off day counts, e.g. `{5,2}` or `{2,2,3,2,2,3}`; set weekdays keeps using `weekday_mask`;
- `cycle_start` (date).

Its existing columns stay in use: staff, client, times, `crosses_midnight`, effective from/until, `active`, `name`.

**`scheduled_shifts.pattern_line_id`** gets a foreign key to it. A hand edit sets it to null (detach).

**RLS:** org-scoped. Schedulers read and write; staff don't need it.

**Phase B (after merge, with OK):** drop `recurring_shift_patterns.location_id`, `service_code_id` and the unused `scheduled_shifts` columns `is_recurring`, `recurrence_rule`, `recurrence_end_date` (all empty). PART-B had these waiting for B20; it's cheaper now.

## 6. Delete
- `recurrence.ts` and its test (only the test uses it).
- Any writer of `is_recurring` / `recurrence_*` (grep shows none).

## 7. Done when (Dane on the Vercel preview)
1. Add a **2-2-3** line for someone at a home. The preview shows the right days, and 4 weeks of drafts appear on the board on those days.
2. Add a client line **Mon/Wed 4p–8p SLH**. Drafts appear on Mondays and Wednesdays.
3. Drag one generated shift to another day, then change the line's time. The dragged shift stays where you put it; the others move.
4. Give the person approved time off on a generated day. That day's copy is an **open** draft and shows in Needs you.
5. **End** the line from a date. Drafts after it disappear (cancelled, kept on record); earlier weeks stay.

## 8. Out of scope
- Van lines (B8 is postponed).
- Coverage templates and "no staff needed" (B7).
- The phone (B12+).

## Questions for Dane
1. **Reuse the empty `recurring_shift_patterns`** (add home, service code, shift type, cycle, cycle start) instead of a new table? *Recommended: yes.*
2. **A hand-edited generated shift detaches** from its line, so later line edits leave it alone? *Recommended: yes.*
3. **Drafts 4 weeks ahead, rolling,** built on save and topped up daily by `scheduler-tick`? *Recommended: yes.*
4. **Changing a line only rebuilds unpublished drafts.** Published shifts stay until you change them on the board and Send? *Recommended: yes.*
5. **Blocked generated shifts** (time off, expired card, cap) become **open** drafts, shown in Needs you and offered at Send? *Recommended: yes.*
6. **Patterns offered:** 5/2, 2-2-3, 4/4, 4/3, set weekdays, every other weekend, custom cycle? *Recommended: yes.*
7. **Client lines too** (e.g. SLH Mon/Wed 4p–8p), not just homes? Most of True North's work is client visits. *Recommended: yes.*
8. **Open lines** (no person) that create an open shift every time? *Recommended: yes.*
9. **Do the Phase B cleanup of the old recurrence columns now** (after merge) instead of waiting for B20? They're all empty. *Recommended: yes.*
