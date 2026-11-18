# B5 plan: Needs you

Status: **waiting for Dane's answers and approval** (Nov 18, 2026). Spec: `docs/demos/scheduler.html` › Office › Needs you (`needsItems`). Step text: PART-B.md › B5, plus the Nov 13 re-check (late and missed clock-ins and the 1056 outlook go here).

## 1. Job
The scheduler handles only what the schedule can't settle on its own, in one list, most urgent first, with the fix button on each row.

## 2. What's there today
Items needing a person are spread across five places:
- **Requests panel** on the board (`requests-panel.tsx`, 336 lines): time off and swaps. Approvals run as **browser-side** database calls (`requests.ts`, 347 lines) with no server check. It doesn't show "partner accepted, needs your OK".
- **Open shifts panel** on the board (`open-shifts-panel.tsx`, 154 lines): claims waiting for approval (`decideClaim`, Owner or agency-wide Admin only).
- **Call-outs** (`shift_callouts`): written from the shift page, shown only as bell notifications. Nothing walks the escalation ladder; there's no hold-over record.
- **Punch fixes** (`evv_timesheets.review_status = 'needs_review'`): approved in Documentation › Records.
- **Late clock-ins and missed visits:** nothing computes them, and **no background job exists that could send a nudge** (the only hooks are billing, Gmail and Nectar).
- **Cards expiring, 1056 outlook, overtime:** computed for the board or Team members (`authOutlook`, `staffHours`, `evidenceAttention`), never listed as to-dos.
- `getActionNeeded` (`workflow.functions.ts`) has **no callers**.

## 3. The change
**One page:** Scheduler › **Needs you** (`/dashboard/scheduler/needs`), plus a banner on the board: "N things need you · 2 call-outs · 1 claim …" with **Open Needs you**, and a count on the scheduler's menu item.

One server function loads everything, and one pure function builds the list (with tests). Each row has a tag, where and when, why, and its action buttons. Filter chips by kind. Most urgent first.

| Kind | Comes from | Actions |
|---|---|---|
| **Call-out** | `shift_callouts` (open) | **Find staff** (B3's ranked list) · **Done** (records acknowledgement) |
| **Late clock-in** (≥ 10 min past the start, published, has a person, no clock-in linked) | `scheduled_shifts` + `evv_timesheets.scheduled_shift_id` | **Call** (shows the number) · **Find cover** · **Ask them to fix their punch** *(question 2)* |
| **Missed visit** (ended, no clock-in) | same | **Call** · **Ask them to fix their punch** · **Didn't happen** (cancels the shift with a reason; kept on record) |
| **Open shift / 1:1 not covered** (this week and next) | `scheduled_shifts` | **Find staff** · **Offer** / **Offer again** |
| **Claim waiting** | `scheduled_shifts.claim_requested_by` | **Approve** · **Not this time** (existing `decideClaim`) |
| **Swap waiting** (partner accepted) | `shift_swap_requests` | **Approve swap** (through the rule engine) · **Deny** |
| **Time off** | `time_off_requests` (pending) | **Approve** · **Not approved**. If it lands on scheduled shifts, the row says how many, and approving adds an "uncovered after time off" row for each with **Make it open** / **Find staff** (the demo) *(question 6)* |
| **Punch fix** | `evv_timesheets` needing review | **Approve fix** · **Ask for more detail** (the same function as Documentation › Records) *(question 5)* |
| **Card expiring** (≤ 14 days) / **expired**, with shifts after the date | Evidence, through `qualificationsOnDate` | **Open in Evidence** · **Send a reminder** |
| **1056: Watch / Act now** | `authOutlook()` | **See authorizations** (board Clients view) |
| **Overtime** (over the agency threshold this week) | `staffHours()` | **See their shifts** (opens the list with Give it to someone else) |

**Server, not browser.** Time-off and swap approvals move into server functions that check `scheduling` edit and the home's approval setting from B2 (who approves swaps or time off: the lead or the owner) *(question 7)*, then write through the user's own login.

**Late alerts in the background** *(question 1)*. A new job runs every 5 minutes against the **production** site (not the old staging host), at a new hook route. It sends:
- the staff member a push at +10 minutes ("You're 10 minutes past the start of your 2p shift. Clock in, or tap Can't make it");
- the home's lead or the scheduler a notice at +30 minutes.

Each notice is sent once. The minutes come from B2 settings.

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Board banner › Open Needs you | Opens the page | Banner says "Nothing needs you" when empty | Needs you |
| Filter chip (All · Call-out · Claim · …) | Filters the list (kept in the URL) | — | Filtered list |
| Find staff / Find cover | B3's Find staff drawer | — | Ranked list |
| Offer / Offer again | Existing offer | Hidden when 0 qualified | "Offered to N" |
| Done (call-out) | Marks it acknowledged | — | Row leaves |
| Call | Shows the person's phone as selectable text | — | Number shown |
| Ask them to fix their punch | Sends the staff member a notice to submit a correction | Sent once per shift (then "Asked at 2:41 PM") | Toast "Asked Nora to fix her punch" |
| Didn't happen | Reason dialog, then cancels the shift (kept on record) | — | Row leaves; shift greyed on the board |
| Approve / Not this time (claim) | `decideClaim` | Disabled with the reason for people who can't approve claims (Owner or agency-wide Admin) | Row leaves; claimant notified |
| Approve swap / Deny | Server swap approval through the rule engine | Disabled when you aren't the approver for that home (B2 setting) | Row leaves; both notified |
| Approve / Not approved (time off) | Server decision | Same | Row leaves; person notified; uncovered rows added |
| Make it open | B3 Make it open | — | Shift opens; row becomes an open-shift row |
| Approve fix / Ask for more detail | Shared punch-review function | Without `timesheets` edit | Row leaves |
| Open in Evidence | Opens the person's Evidence | — | Evidence tab |
| Send a reminder | Notice to the person to upload the card | Once a day | Toast "Reminder sent" |
| See authorizations | Board › Clients view | — | Authorizations panel |
| See their shifts | The over-40 list drawer | — | Their shifts |

## 5. Data
- **No new tables.** Everything is computed from the owner tables.
- The background nudges need a record of what was already sent, so they aren't sent twice. That's the `notifications` row itself (type + `related_id` = the shift), checked before sending.
- **One new background job** (`pg_cron`) and **one new hook route** on the production site *(question 1)*. The existing jobs aren't touched.

## 6. Delete
- `requests-panel.tsx` and the admin mode of `open-shifts-panel.tsx` (the staff mode stays for My Schedule).
- The browser-side approval functions in `requests.ts` (`decideTimeOff`, `approveSwap`, `denySwap`), replaced by server functions.
- `getActionNeeded` (no callers).

## 7. Done when (Dane on the Vercel preview)
1. The board banner shows the count; Open Needs you lists items, most urgent first.
2. A staff call-out shows as a Call-out row; Find staff ranks cover.
3. A published shift that started 10+ minutes ago with no clock-in shows as **Late clock-in**; after it ends with no clock-in, **Missed visit**.
4. Approving time off over a scheduled shift adds a row with **Make it open** / **Find staff**.
5. A swap the partner accepted shows **Approve swap**, and approving it reassigns the shift.
6. A claim shows **Approve** / **Not this time** (Owner or agency-wide Admin).
7. Someone whose CPR expires in 10 days with shifts after that shows **Card expiring** with **Open in Evidence**.
8. The Requests and Open shifts panels are gone from the board.

## 8. Out of scope
- **Escalation ladder and hold-over picks** ("Start escalation"): they need the background job plus a hold-over record *(question 3)*.
- **Partial give-aways:** no table exists; the phone requests step (B13) creates them *(question 4)*.
- **Coverage gaps and "No staff needed"** (B7), **van without a driver** (postponed), **host away** (B7b).
- The 1056 "Draft a request to the SC" (Nectar), SMS.

## Questions for Dane
1. **The late-clock-in nudge needs a background job.** Add a new job every 5 minutes that calls the **production** site (providerinterface.com), at a new hook route, to send the +10-minute staff push and the +30-minute lead notice? The 4 existing jobs on the old staging host aren't touched. *Recommended: yes. Without it, late clock-ins only show when someone opens Needs you.*
2. **"They worked it: add the punch"** would be an admin entering clock times, and how admin time edits are stored is an open owner decision (CLAUDE.md). For now, Needs you offers **Ask them to fix their punch**: the staff member submits a correction, which comes back here as a Punch fix to approve. OK? *Recommended: yes.*
3. **Escalation ladder + hold-over** (lead → on-call → owner, then hold over whoever's last hold-over was longest ago): put this in its own step after B5? It needs the background job and a new hold-over record. *Recommended: yes, its own step.*
4. **Partial give-aways:** they come with the phone requests step (B13), since nothing creates them yet? *Recommended: yes.*
5. **Punch fixes** show in both Needs you and Documentation › Records, using one shared approve function (the same data and action, two doors)? *Recommended: yes.*
6. **Time off over scheduled shifts:** approving doesn't open the shifts automatically; it adds a row per shift with **Make it open** / **Find staff** (as in the demo)? *Recommended: yes.*
7. **Who can approve:** follow B2's per-home approval settings (swaps by the lead, time off by the owner, and so on). Claims stay with the Owner or an agency-wide Admin, as today. Leads see only their homes' rows. *Recommended: yes.*
