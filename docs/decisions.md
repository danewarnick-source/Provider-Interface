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
