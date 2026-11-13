# B3 plan: the board

Status: **built** (Nov 13, 2026), waiting for Dane on the preview. Dane: yes to all 7 questions. Spec: `docs/demos/scheduler.html` › Office › Scheduler. The step text is in PART-B.md (B3) plus the Nov 13 changes at the top of that file.

## 1. Job
The scheduler sees the week at a glance and fixes it in place: add, move, copy, reassign, open or cancel a shift. Every change is checked by the rule engine and can be undone.

## 2. What's there today (Nov 13 inventory)
- `src/routes/dashboard.scheduler.tsx`, **2,029 lines**, has three tabs:
  - **Schedule:** one week grid per service code, an Add shift dialog, a shift side panel and Publish.
  - **Day Program:** sessions and attendance. There are **0 sessions live**.
  - **Staff view:** a preview of a staff member's week.
- Around the board it also shows:
  - the Nectar bar (draft shifts, auto-fill, repeat, Excel import);
  - a Requests panel (time off, swaps);
  - an Open shifts panel (approve claims);
  - a solo-lapse dialog.
- **Missing:** no Find staff screen, no "best fit first" ranking, no drag and drop, no undo, and no way to cancel or restore a shift (only a hard delete).
- **Server side (from B1):** `saveShift` (needs a client; no team shifts or open spots), `publishWeek`, `applyRepeat` (copy week), `claimOpenShift` / `decideClaim`, `applyDrafts` (assign). Each one runs the rule engine (`shift-guard.server.ts`).
- **Live data:** 210 shifts in the last 60 days, 0 team (home) shifts, 0 cancelled shifts.

## 3. The screen (matches the demo)
**Header**
- Week dates, the published/changes-not-sent pill, and **Add shift**.
- **Copy week** and **Send changes** are B4; until then they stay as they are today.

**Stat tiles (clickable)**
- Scheduled hours (opens hours by place).
- Open shifts (opens the list).
- Coverage gaps *(question 3)*.
- People over 40 h (opens their shifts).

**Toolbar**
- Week / Month.
- View: Homes & programs / Team members / Clients.
- Filter chips: Everything, each home, Community, Host homes.

**The grid**
- **Homes & programs:** one row per home, with coverage gaps shown as red bars *(question 3)*.
- **Team members:** one row per person, with an hours meter, time off and unavailable days, and **+** to add a shift locked to that person. Open shifts get their own row at the top.
- **Clients:** one row per client. Above the grid is the **Authorizations panel**: authorized, used + scheduled, left, standard week, and the outlook *(question 5)*. Host home clients show "With host · not scheduled".
- **Chips:** time, code, name. Flags show as "! reminder" or "✕ block". Dashed means draft, a gold edge means changed since publish, red means open. 1:1 shifts say "1:1 · <client>". There are no van chips (B8 is postponed).

**Shift drawer**
- Details, the checks for this shift (from the rule engine), and "Who's been asked" for open shifts.
- Buttons: **Edit day, place or time**, **Give it to someone else**, **Make it open**, **Cancel shift** (or **Restore**).

**Add shift**
- 1. Day → 2. Where → 3. Time (shift types from B2 Settings) → 4. Who, ranked best fit first with reasons, or **Leave it open** with a number of spots (1–3).
- A "Needs a reason" finding asks for the reason, which is saved on the shift.

**Find staff**
- The ranked list, with Nectar's pick at the top.
- A "Can't" row shows why, with an **Evidence ›** link.
- **Offer to N qualified instead** runs the existing open-shift offer.

**Drag and drop**
- Drag a chip to another day or person to move it.
- Alt-drag to copy it.
- Drag an edge to change its time.
- Each drop runs the rule engine; a block snaps the chip back and shows the reason.

**Undo**
- Every change made on the board shows a toast with **Undo**. Undo reverses the last change (move back, cancel what was added, restore what was cancelled, reassign what was opened).

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Add shift | Opens Add shift, Day = today | Hidden without `scheduling` edit | Drawer, step 1 |
| + (team member row) | Add shift locked to that person, first free slot | Same | "For Ava" card; Where lists only Ava's places |
| + (home or client cell) | Add shift for that place and day | Same | Drawer, step 3 |
| Add shift › Save | Saves through the rule engine | Disabled while a Block finding is shown; disabled until a reason is typed for "Needs a reason" | "Shift added" + Undo; chip appears (draft or changed) |
| Leave it open › Add N open shifts and offer | Creates N open shifts, offers them to qualified staff | — | "Offered to N qualified" + Undo |
| Stat tile: Open shifts | Opens the open-shift list | — | List with Find staff / Open |
| Stat tile: Coverage gaps | Opens the gap list *(q3)* | Hidden if no home has coverage needs | List with Handle it |
| Stat tile: Over 40 h | Opens people over 40 with their shifts | — | List |
| Chip | Opens the shift drawer | — | Drawer with checks |
| Edit day, place or time | Add shift in edit mode | Hidden on a cancelled shift | "Shift saved" + Undo |
| Give it to someone else / Find staff | Ranked list | — | Ranked candidates |
| Find staff › Assign | Assigns through the rule engine | "Can't" rows have no button | "Assigned to Ava" + Undo |
| Find staff › Assign with a reason | Shows a reason box, then assigns | Assign disabled until a reason is typed | Same |
| Offer to N qualified | Existing open-shift offer | Hidden when 0 qualified | "Offered to N" |
| Make it open | Removes staff; shift stays and is offered | Hidden on open shifts | "Shift is open" + Undo |
| Cancel shift | Sets status cancelled (kept on record) | Hidden when already cancelled | "Shift cancelled" + Undo; chip greyed |
| Restore | Back to its last status | Shown only when cancelled | "Shift restored" |
| Drag / Alt-drag / edge drag | Move / copy / retime through the rule engine | Not on cancelled shifts or for viewers | "Moved" + Undo, or snaps back with the reason |
| Undo (toast) | Reverses the last change | Gone after 10 s or another change | "Undone" |
| Authorizations panel | Read-only | Clients view only | — |
| Evidence › | Opens that person's Evidence | Shown only on card or training reasons | Evidence tab |

## 5. Data and server work
- **`saveShift`** accepts a home (team) shift with no client, and `open_spots`. Columns exist live (`team_id`, `open_spots`); no migration.
- **New `cancelShift` / `restoreShift`.** They set `status = 'cancelled'` and `cancelled_at`, and keep the row. This replaces the hard `deleteShift` for board use *(question 4)*.
- **New pure `rankStaff()`** in `src/lib/scheduler/`, with unit tests. It ranks by findings from `evaluateShift` (ok → warn → reminder → needs a reason → can't), then by fewest hours this week. Reasons are the findings' text. It has no rules of its own.
- **New pure `authOutlook()`** with tests, for the Authorizations panel *(question 5)*.
- **Undo** lives in the browser only (a list of the inverse calls). No table.
- **Drag and drop** uses `@dnd-kit/core`, which is already installed.
- **Route file ≤ 80 lines.** Components go in `src/components/scheduler/board/`, with no file over 250 lines.

## 6. Delete (in this PR)
- `dashboard.scheduler.tsx`'s grid, add dialog, side panel and Staff view tab. The route becomes the board shell.
- `solo-lapse-dialog.tsx` (replaced by the new-hire and card rules from B1/B2).
- `nectar-bar.tsx`, `repeat-shifts-dialog`, `import-schedule-dialog` *(question 2)*.
- **Day Program tab** and `use-day-program-data.tsx` *(question 1)*. The tables stay.
- `deleteShift` (board use) → `cancelShift` *(question 4)*.
- **Not deleted, even though PART-B listed them:**
  - **`homes-teams-board.tsx`** is the only place a home can be created. It stays until a Settings › Homes step replaces it *(question 6)*.
  - **`requests-panel.tsx` and `open-shifts-panel.tsx`** stay on the board until Needs you (B5) replaces them, so approvals don't disappear for a step *(question 7)*.

## 7. Done when (Dane on the Vercel preview)
1. Click the Open shifts tile: the list shows; Find staff on one ranks people with reasons.
2. On the Team members view, **+** on a row opens Add shift locked to that person.
3. Drag a shift onto someone with approved time off: it's refused or asks for a reason, per your Settings.
4. Alt-drag a shift: a copy appears; Undo removes it.
5. Make a shift open, then Undo: the person is back.
6. Cancel a shift: it greys out and stays; Restore brings it back.
7. Clients view: the Authorizations panel shows each client's outlook.
8. The route file is ≤ 80 lines.

## 8. Out of scope
- Publish and Copy week (B4), Needs you (B5), Rotations (B6).
- Home pages and coverage needs (B7), host-away (B7b).
- Phone screens (B12–B14).

## Questions for Dane
1. **Day Program tab:** 0 sessions live and B8 is postponed. Remove the tab now and keep the data tables? *Recommended: yes.*
2. **The Nectar bar** (draft a week, auto-fill open shifts, repeat, Excel import): Excel import is out (Decision 19), and repeat becomes Rotations (B6). Remove the bar now? Find staff keeps "Nectar's pick". *Recommended: yes.*
3. **Coverage gaps need each home's staffing needs.** Today they live on the old `locations` table (`location_coverage_requirements`), a duplicate source. True North has 0 home shifts. Hide the coverage-gaps tile and the red bars until B7 moves coverage needs onto the home? *Recommended: yes.*
4. **Delete vs cancel:** the board would only ever cancel (kept on record, restorable), never hard-delete a shift. OK for draft shifts that were never published too? *Recommended: yes, cancel everything; nothing is hard-deleted.*
5. **Authorizations panel "used":** count units from clock-ins (`evv_timesheets`, per-entry quarter hours via `computeEntryUnits`) plus this week's schedule. "Standard week" = the average of the next 4 weeks scheduled, until Rotations (B6). OK?
6. **Homes & Teams board** (the only place to create a home): keep it for now and move it into Settings › Homes as its own step after B3? *Recommended: yes.*
7. **Requests and Open shifts panels:** keep them on the board until Needs you (B5) replaces them? *Recommended: yes.*
