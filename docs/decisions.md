# Owner decisions

One dated line per decision Dane makes, newest last. A fresh session reads this so it doesn't re-ask or guess differently. Area-specific lists still apply: `docs/scheduler-rebuild/DECISIONS.md` (scheduler).

- 2026-11-13: Admin side first. The edge is saving agencies time and money: review records, nudge staff about missing or late work, pull audit packets easily.
- 2026-11-13: Simplify everything. Fewest files and tables possible; every rebuild deletes what it replaces; cut what DHHS91172 doesn't need. Extra "run the business" features come later.
- 2026-11-13: Every feature gets a working demo with fake data first. Dane approves the demo before the real build, and the build matches it.
- 2026-11-13: Each feature is checked against competitors (Connecteam, AxisCare, Therap, and others) as a gauge only, and against DHHS91172 / DSPD / Medicaid HCBS rules.
- 2026-11-13: Work goes tab by tab through the admin side, starting with the Scheduler (Part B, from B1/B2).
- 2026-11-13: Demos are standalone pages with fake data, shared as private claude.ai links. Each approved demo is saved in `docs/demos/`.
- 2026-11-13: Re-check the Oct 22 scheduler demo against competitors and DHHS91172 (a keep/add/cut list for Dane) before building B3.
- 2026-11-13: The Nectar rebuild (#484) waits until we reach the Nectar tab. Denim (#469) stays open as a reference for the look; it gets redone later.
- 2026-11-13: Scheduler adds (from the re-check, `docs/scheduler-rebuild/RECHECK.md`): late/missed clock-in alerts, an authorization-units view over the whole authorization period, host homes (HHS), and offline clock-in.
- 2026-11-13: Scheduler cuts: Messages (B11) moves to Phase 2; the Scheduling readiness page (B10) folds into Find staff; vans/day program (B8, B15) wait until a customer runs DSG; the House log (B19) is cut.
- 2026-11-13: Keep the Part B build order. The additions slot into the steps they belong to: late alerts → B5 Needs you and B14 phone; units view → B3 board and the client card; HHS → a new step after B7 (home page); offline → B14.
- 2026-11-13: Host homes in the scheduler: the host lives with the Person and is never scheduled. The scheduler shows only (1) agency staff visits, as ordinary visits under the Person, and (2) host-away coverage: the admin records the host's days away, then either adds coverage shifts or records that the Person stays somewhere else. The per-day "can this day bill" grid (present + host note + overnight) moves to notes review (B16–B17), with its missing-note alerts.
- 2026-11-13: One source of truth, platform-wide. Every fact is entered and stored in one place, almost always Clients or Team members, sometimes Settings (agency setup: homes, rules, pay). Every other tab reads it and keeps no copy. Each tab's rebuild starts by listing the facts it shows, their owner, and any copies to delete. Rules and the known duplicates are in `docs/SOURCE_OF_TRUTH.md`.
- 2026-11-13: Homes (group homes and host homes) live in Settings as agency setup. A client points to their home from Clients; the client doesn't own it.
- 2026-11-13: The host is the host home's lead. A host home is a home in Settings with the host as its lead (`teams.manager_id`); the client's Home (`clients.team_id`) says who lives there. The free-text host name in Finances goes, and Daily Logs stops working out the host from Positions; both read the home.
- 2026-11-13: Scheduler demo approved (v2, with host-away coverage). Saved as `docs/demos/scheduler.html`; PART-B.md's top section lists the step changes.
- 2026-11-13: Every PR targets `main` directly. No integration branches or stacked PRs; related changes can share one PR.
