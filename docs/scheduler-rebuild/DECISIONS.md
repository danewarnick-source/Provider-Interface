# Scheduler & Notes: owner decisions (current as of Oct 22, 2026)

These are settled. Later prompts don't reopen them. This file replaces the Decisions list in RUNBOOK.md.

## Scheduling
1. RHS home shifts and van/program shifts have no client (`team_id` set). 1:1 shifts name the client.
2. The week starts Sunday. All date math is America/Denver via `src/lib/scheduler/time.ts`.
3. Minimum staff age: 16; 18 to drive a client or for DCFS/DJJYS clients; 21 for HHS/PPS.
4. **Rule strength is an agency choice per rule:** Off / Warn / Require a reason / Block.
   - Contract rules can't be Off.
   - Double-booking always blocks.
   - Cards default to Warn.
   - Evidence is the only source for cards and training.
5. The app never creates open shifts on its own. Admins create them. Needs you suggests them.
6. Open shifts go to everyone qualified at once. Per home, first claim wins or an approver picks. Quiet hours with an urgent window.
7. Unfilled: escalate lead → on-call → owner, then hold over whoever's last hold-over was longest ago, recorded with a reason.
8. New hires work paired shifts until their Evidence items are done and a lead signs off per home. No named-trainer "training shift".
9. Overnight pay is set per home: pay every hour / a sleep rate / exclude sleep on 24h+ shifts.
10. Hours cap is agency-set only.
11. Needs you is its own page.
12. Cost per home is visible only to owners and anyone with `financial_reports`.
13. 2:1 without a rights modification is a block.
14. There's no DSI daily-hour cap. Its rule is removed.
15. Coverage:
    - When every resident is away (Away times), those hours need no staff. Partial absence doesn't lower coverage.
    - Whole-house "no staff needed" templates stay.
16. RHS 1:1 enhanced staffing (4+ h/day) needs a Form 930. It's its own shift naming the client, and doesn't count toward house coverage.
17. Van runs:
    - One van run is one driver shift (DSG with MTP).
    - The van's riders are that driver's note group. Non-drivers run an on-site group.
    - Routes are edited on the van card.
    - A route can't save over its seats or over a 1.00 staff ratio load.
18. Driver file (license, driving record, insurance; §1.30(2)) is an Evidence item. Without it, staff aren't offered van shifts but can be assigned with a reminder.
19. Payroll export, EVV export, SMS, printing and Excel import are out for now.

## Notes
20. Staff write their own notes. Nectar only writes the combined daily note for the lead, marked as a draft. It never drafts staff notes.
21. RHS:
    - Every staff member writes a section per client home during their shift: a box per picked goal, plus Other support.
    - A group activity (2+ clients) counts for everyone tagged.
    - The house log never counts for a client.
22. DSG:
    - One shared "what the group did" box per van group, plus a required "how did X respond" per rider, with an optional goal tag.
    - DSG start and end time is an agency setting, default Arrived → Heading home. The other choice is pickup → drop-off, shown with a DSPD caution.
    - Van taps are always the MTP record.
23. Minimums are agency-wide. Defaults:
    - RHS: 20 words per client per shift.
    - DSG: 20 for the shared box, 12 per response.
24. Clock-out is blocked until every section meets the minimum. Staff may give a listed reason, or a supervisor (timesheets:edit) overrides with a reason.
25. The site lead reviews by noon the next day: Approve / Edit summary / Send back with a reason. Fixes keep the original.
26. Review notes replaces the Daily Logs page.
27. There's no separate Attendance page:
    - absence days go on the home page;
    - hours vs Worksheet go on the program page.
28. Overnight entries split at midnight onto the next day.
