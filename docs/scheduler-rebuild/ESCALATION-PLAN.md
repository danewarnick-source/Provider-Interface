# Plan: escalation ladder and hold-overs

Status: **waiting for Dane's answers and approval** (Nov 19, 2026). Settled rule: Decision 7, "Unfilled: escalate lead → on-call → owner, then hold over whoever's last hold-over was longest ago, recorded with a reason." Spec: `docs/demos/scheduler.html` (Settings › Open shifts › "When nobody picks it up" and "Hold-over record"; Needs you › **Start escalation**).

## 1. Job
When a shift is about to start with nobody on it, the platform asks the right people in order, so the office doesn't phone down a list. If nobody can come, it fairly asks someone already there to stay, and keeps the record.

## 2. What's there today
- **B2 settings saved, nothing uses them:** three wait times (`escalation_waits`, default 15 / 15 / 10 min), "Ask someone to stay" (`holdover_ask`), and "Staff can see the hold-over list" (`holdover_visible`).
- **`callout_escalation_events`** (callout, step, channel, outcome, target, detail). Only the shift page writes it, by hand, for call-outs.
- **No hold-over record anywhere.**
- **B5's late-alert hook** (`scheduler-late-alerts`) and its job file are built, but the **job is not turned on**.
- **On-call** is a B2 shift type (`oncall`): a person on an on-call shift covering that time.

## 3. The change
**When it starts** *(question 1)*
- **Automatically**, when a published open shift is within the **urgent window** (B2 setting, default 4 h before start) and still open. That includes the open shift a call-out leaves behind.
- **By hand:** **Start escalation** on a Needs you row (call-out, open shift).

**The ladder.** Each step sends a push ("Can you cover Thu 3p–11p? Tap to take it"; code, day and time, no client names), then waits its B2 minutes before the next:
1. **The home's lead** (`teams.manager_id`). Skipped for a client visit with no home *(question 3)*.
2. **On-call:** whoever has an on-call shift covering that time. Skipped if none.
3. **The owner(s).**
4. **Hold-over**, only if "Ask someone to stay" is on *(question 6)*. Ask the people whose shift ends when the open one starts (same home or client), one at a time, the one whose last hold-over was **longest ago** first. **Stay** extends their shift through the rule engine (16 h in a row, rest and overtime still warn, ask for a reason or block, per your Settings). It's saved as a hold-over with the reason.
5. **Nobody:** the Needs you row turns into "No one available. Escalation finished" for the owner.

It **stops** the moment the shift has a person (someone took it, was assigned, or stayed).

**Answering.** The person asked sees a card on **My Schedule**: "Can you cover Thu 3p–11p at Maple House?" with **Take it** / **Can't** (or **Stay until 11p** / **Can't** for a hold-over) *(question 7)*. Take it assigns at once through the rule engine; Can't moves the ladder to the next person right away.

**Where you see it**
- **Needs you:** the row shows the step it's on, e.g. "Asked Maria (lead) 2:41 PM · on-call next at 2:56", with **Stop escalation**.
- **Shift drawer:** "Who's been asked" lists every step with its time and answer.
- **Settings › Open shifts:** the **Hold-over record** shows who stayed, when, and how many times this month, next-up first. Staff see it only if "Staff can see the hold-over list" is on (the phone view comes with B13).

**One background job for the scheduler** *(question 4)*. The not-yet-enabled `scheduler-late-alerts` hook is renamed `scheduler-tick` and does both jobs: late-clock-in nudges, and moving each escalation forward when its wait is up. Still one job every 5 minutes on the production site; still not turned on until question 8.

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Needs you › Start escalation | Starts at the first available step | Hidden when it's already running or the shift has a person | "Asked Maria (lead)"; the row shows the step |
| Needs you › Stop escalation | Stops it; logged | Shown only while running | "Escalation stopped" |
| Drawer › Who's been asked | (list) | Shown when anyone was asked | Each step: who, when, answer |
| My Schedule › Take it | Assigns through the rule engine | Hidden if someone else took it first ("Already covered") | "It's yours" |
| My Schedule › Stay until … | Extends the shift; records the hold-over | Same | "Thanks. Your shift now ends at 11p" |
| My Schedule › Can't | Next step now | — | Card leaves |
| Settings › Hold-over record | (list) | — | Next-up first |

## 5. Data
- **Escalation steps reuse `callout_escalation_events`.** Add `scheduled_shift_id` and make `callout_id` optional, so an escalation can start without a call-out. Reason: one record of who was asked, whether or not a call-out started it.
- **Hold-overs reuse B4's `shift_changes`** *(question 5)*. Add two columns: `kind` ('edit' / 'holdover') and `reason`. A hold-over is a change to a published shift (its end moves), so it's already recorded there. The fairness list ("held over longest ago") reads those rows.
- **No new tables.** One migration (columns, safe for `main`).
- **The job file is renamed** to point at `scheduler-tick` (still not applied).

## 6. Delete
- The shift page's hand-written escalation logging (`dashboard.shift.$shiftId.tsx` ~406–514). It goes through the same server function.
- The `scheduler-late-alerts` route name (renamed, not kept).

## 7. Done when (Dane on the Vercel preview, with the job on, or using Start escalation)
1. A published open shift starting in 2 h, at a home with a lead: **Start escalation** → the lead gets the push; Needs you shows "Asked <lead>".
2. The lead taps **Can't** → on-call is asked (or the owner if nobody's on call); the drawer lists both.
3. The owner taps **Take it** → the shift is theirs, and the escalation stops.
4. With "Ask someone to stay" on and nobody taking it, the person whose shift ends at that start is asked to stay. **Stay** extends their shift, and the Hold-over record shows them at the bottom (asked last next time).
5. **Stop escalation** stops it, and nobody else is asked.

## 8. Out of scope
- SMS or phone calls (push and in-app only).
- The phone rebuild (B12–B14). The cards live on My Schedule for now.

## Questions for Dane
1. **Start automatically** when an open shift is inside the urgent window (B2 setting, default 4 h), **plus** a Start escalation button? *Recommended: yes.*
2. **Which shifts:** every open shift that needs a person (home shifts and 1:1 client visits), not only homes? Most of True North's shifts are client visits. *Recommended: yes, all.*
3. **No home, no lead step:** for a client visit with no home, skip straight to on-call, then the owner? *Recommended: yes.*
4. **One scheduler job:** rename the not-yet-enabled late-alerts hook to `scheduler-tick` and let it run both late alerts and escalations? *Recommended: yes.*
5. **Hold-over record:** store it as a shift change marked "hold-over" with a reason (2 new columns on `shift_changes`), not a new table? *Recommended: yes.*
6. **Hold-over pick:** ask only people whose shift ends right when the open one starts (same home or client), longest-ago first, one at a time; staying still goes through the 16-hour, rest and overtime rules? *Recommended: yes.*
7. **Answering on My Schedule** (Take it / Stay / Can't) until the phone rebuild? *Recommended: yes.*
8. **Turning the job on (after this merges):** I'd test the live site with one call made from inside the database, so the secret never leaves the vault. If it's accepted, I turn the job on. If not, I'll walk you through adding the secret to the AWS settings. OK to run that one test call? *Recommended: yes.*
