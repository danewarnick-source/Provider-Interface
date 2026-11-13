# Scheduler re-check (Nov 13, 2026): keep / add / cut

The Oct 22 demo (`docs/demos/scheduler.html`) was checked against competitors and DHHS91172 before B3. Dane's answers are recorded in `docs/decisions.md`.

## Sources
- **Competitors:** Connecteam, AxisCare, Therap, HHAeXchange, ShiftCare, AlayaCare and Ankota. Based on search summaries of vendor help pages and Capterra/G2 listings; the full pages couldn't be fetched from the session.
- **Contract:** the DHHS91172 scope of work text in `state_rule_documents` (live). It covers:
  - EVV (§1.12): Companion, Homemaker, Respite except RP4/RP5/RPS, Supported Living, Personal Assistance.
  - Form 930 before enhanced staffing (4+ h/day of 1:1 in RHS).
  - 25 "prior to providing" training/qualification gates and 75 staffing-ratio mentions.
  - HHS on-call after-hours support.
- **Live data:** True North bills HHS 6, DSI 5, SEI 2, SLH 2, SLN 2, RHS 1, DSG 0.

## Keep (competitors and the contract agree)
- Board views by staff, client and home; drag to move, copy and resize (B3).
- Draft → publish with notifications; copy week (B4). Competitors' users love both.
- Rotations, i.e. recurring weeks (B6). Competitors' top complaint is clumsy edits to one occurrence of a recurring shift, so editing one week must be easy.
- Open shifts to qualified staff, claims, swaps, partial give-aways and time off from the phone (B12, B13). Users love these the most.
- Rule engine with Warn / Reason / Block (B1, B2): double-booking, ratios, Form 930, 2:1, ages, qualifications "prior to providing", overtime.
- Needs you (B5): one place for everything that needs a person. This is our "save the admin time" core.
- Cost per home (owner only).

## Add (gaps)
1. **Late / missed clock-in alerts.** Not in the demo. Competitors' users rate this highly, and it is exactly "notify staff when things aren't complete." For example: no clock-in 10 minutes after the start → nudge the staff member; 30 minutes → a Needs you card for the lead.
2. **Authorization units across the whole schedule.** The demo only has a "1056 running low" card. Show scheduled vs authorized units per client and code for the full authorization period, not a short window. HCBS buyers expect this.
3. **Host homes (HHS).** Our biggest service, and Part B leaves it out. Hosts never clock in, but the admin needs to see, per host home: daily notes and overnight confirmations done or missing, staff visits into the home, and missing-day nudges.
4. **Offline clock-in on the phone** (queue the punch and send it when signal returns). Therap's users value this in community settings. Possibly part of B14.

## Cut or merge (simplify)
1. **B11 Messages → move to Phase 2.** It needs a new table and a chat system. Competitors' users complain about noisy notifications. House chat is a "run the business" feature, not a contract need.
2. **B10 Scheduling readiness page → fold into Find staff.** A read-only matrix that copies the Evidence tab. Show the reason ("CPR expired Oct 2") right where you pick staff, with a link to Evidence. One less page.
3. **B8 and B15 (day program, van routes, DSG van notes) → move later.** No current customer bills DSG. Build them when an agency that runs a day program signs on.
4. **B19 House log → check whether it's needed.** It never counts toward a client (Decision 21). If nothing in the contract requires it, cut it.

## Still out (Decision 19, unchanged unless Dane says otherwise)
Payroll export, EVV export, SMS, printing and Excel import. Competitors treat payroll export as baseline; it goes on the roadmap as Phase 2.
