# B7 plan: group home page (RHS)

Status: **built, scope A (full)** (Nov 19, 2026; branch claude/busy-cray-w323d6, not pushed; see PROGRESS.md). Dane: A, and yes to questions 2–7. Residents' away times are in: new table `client_away_times` (owned by Clients), edited on the client's profile and from the home page's Residents card (same function), and when every resident of a home is away those hours need no staff. Spec: `docs/demos/scheduler.html` › click a home on the board (`vPlace`, `covDay`, `dlgGap`). Step text: PART-B.md › B7.

## 1. Job
A lead sees whether a group home is covered and staffed to its Worksheet, fixes gaps in place, and the board's coverage-gaps tile comes back.

## 2. What's there today (live, Nov 19)
- **Staffing needs** live on the home (`location_coverage_requirements.team_id`, edited in Settings › Homes). **0 rows.**
- **Nothing computes coverage** (needed vs scheduled per hour). The board's coverage tile and gap bars are not built (`board-toolbar.tsx`, `board-rows.tsx` say "waits for B7").
- **Away times** (day program, job, school): **no table.**
- **"No staff needed" times / templates:** **no table.**
- **Absence days:** `client_absences` exists (**0 rows**). `client_billing_codes.worksheet_absence_days` and `worksheet_weekly_hours` exist but have **no editor and 0 values**.
- **Form 930:** **not stored anywhere.** The rule engine's "4+ h/day of RHS 1:1 needs a Form 930" rule can never fire, because `hasForm930` and the shift's 1:1 ratio are never filled in.
- **Live:** 3 group homes (all agencies), 3 residents, **0 home shifts**. True North has 1 RHS resident.

## 3. The change (recommended scope B; see question 1)
**The home page:** `/dashboard/scheduler/homes/<home>`, opened from a home's name on the board. It has a **Set up this home** link to Settings › Homes; the Settings page stays as it is.
1. **Coverage by the hour, this week.** For each day, a 24-hour bar: green = covered, red = short, grey = not needed.
   - **Needed** = the home's staffing needs, minus "no staff needed" blocks.
   - **Scheduled** = shifts at the home whose shift type counts toward coverage. 1:1 segments and on-call don't count.
   - A red stretch opens the **gap dialog**: **Add a shift for this time** (B3's Add shift, prefilled), or **No staff needed…** (why, a required explanation, and "just this day" or "every week").
2. **No staff needed:** the home's weekly blocks and one-time blocks, each with its reason, plus **+ New block** and **Remove**.
3. **Residents:** each with their codes, absence days **x of y** this plan year (absences vs the Worksheet number), and a link to the client.
4. **Worksheet staffing hours:** the residents' RHS Worksheet weekly hours vs hours scheduled with staff vs still open. Shows "Short N h" until the open shifts fill (§1.33).
5. **1:1 enhanced staffing:** per day, chips for RHS 1:1 shifts naming a resident. They show "Form 930 on file until <date>" or **"No Form 930"** (§21.3(4)).

**The board:** the **Coverage gaps** tile returns (clickable, lists the gaps), and the Homes view shows red "No one 3p–7p ›" bars that open the same gap dialog.

**Needs you:** **Coverage gap** rows, with Add a shift / Find staff on the open shift / No staff needed.

**Clients › Services & billing:** each RHS authorization card gets **Worksheet weekly hours** and **Absence days per year**, next to Ratio *(question 3)*.

**Form 930** *(question 5)*: uploaded as a client document of type **Form 930**, with start and end dates. The rule engine reads it. A 4+ hour RHS 1:1 day without a current Form 930 is then caught by the existing contract rule (Warn / Reason / Block per your Settings).

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Home name (board) | Opens the home page | — | Home page |
| Set up this home | Opens Settings › Homes for it | Hidden without Settings view | Settings page |
| Red stretch / "No one 3p–7p ›" | Gap dialog | — | Dialog |
| Add a shift for this time | B3 Add shift, prefilled | Hidden without `scheduling` edit | Add shift drawer |
| No staff needed… › Save | Saves a 0-staff block with the reason | Disabled until a reason is typed | "No staff needed 9a–3p saved"; the bar turns grey |
| + New block / Remove (no staff needed) | Edit or remove a weekly block | Hidden without `scheduling` edit | "Saved" / "Removed" + Undo |
| Resident name | Opens the client | — | Client profile |
| 1:1 chip | Opens the shift drawer | — | Drawer |
| Coverage gaps tile (board) | Lists gaps with Handle it | Hidden when no home has staffing needs | Gap list |
| Authorization › Worksheet weekly hours / Absence days | Save on blur | Read-only without Billing edit | "Worksheet saved" |

## 5. Data
- **"No staff needed" = a staffing-need row of 0 staff with a reason** *(question 2)*, either weekly or for one date. Adds one column, `on_date`, to `location_coverage_requirements` (null = weekly). Reason goes in `notes`, required for 0-staff rows. **No new table.**
- **Worksheet weekly hours and absence days:** existing `client_billing_codes` columns, now editable.
- **Absence days used:** computed from `client_absences` in the plan year.
- **Form 930:** an existing client document type plus dates (no new table). The rule engine fills `hasForm930`, and marks a shift 1:1 when it's an RHS shift at a home that names a resident.
- Coverage math is a pure, tested function. Nothing is stored.

## 6. Delete
- The "waits for B7" stubs in `board-toolbar.tsx` and `board-rows.tsx`.
- The stale "no source table yet" note in `rule-context.server.ts` (absences and 930 now have sources).

## 7. Done when (Dane on the Vercel preview, using a test group home)
1. Add a staffing need (every day, 3p–11p, 2 staff) and one shift. The home page shows red where it's short, and the board's Coverage gaps tile counts it.
2. Click the red stretch → **No staff needed** "Day program Mon–Fri 9a–3p", every week → those hours turn grey everywhere.
3. On a resident's RHS authorization, set Worksheet 40 h/week and 12 absence days → the home page shows "Short N h" and "0 of 12".
4. A 4-hour 1:1 RHS shift for a resident with no Form 930 → flagged per your Settings. Upload a Form 930 → the flag clears.

## 8. Out of scope
- Per-resident away times *(question 1)*.
- Host homes (B7b).
- Vans and the day program (postponed).

## Questions for Dane
1. **Scope:** True North has 1 group-home resident and no home shifts. Pick one:
   - **A. Full B7**, including each resident's recurring away times (a new table) that grey out hours when everyone's away.
   - **B. Lighter (recommended):** everything above, but **no per-resident away times**. You cover "everyone's at day program 9–3" with a **No staff needed** block instead. That's one less table and one less editor.
   - **C. Postpone B7** until a group-home customer needs it, like the vans, and go to B7b (host-away).
2. **"No staff needed"** stored as 0-staff staffing-need rows (weekly or one date) with a required reason, instead of a new table? *Recommended: yes.*
3. **Worksheet weekly hours and absence days** edited on the client's RHS authorization card, next to Ratio (Clients owns them)? *Recommended: yes.*
4. **Absence days used** = days in `client_absences` this plan year, shown as "x of y"? *Recommended: yes.*
5. **Form 930** = a client document of type "Form 930" with start and end dates, which the scheduler's existing 1:1 rule reads? *Recommended: yes.*
6. **The home page** lives under the scheduler (opened from the board), and Settings › Homes stays the setup page, linked both ways? *Recommended: yes.*
7. **Coverage gaps return** on the board (tile + red bars) and in Needs you? *Recommended: yes.*
