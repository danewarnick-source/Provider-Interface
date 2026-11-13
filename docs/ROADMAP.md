# Roadmap: where we are and what's next

Read this before planning or building anything. Update it at the end of every session ("update the roadmap and decisions, then commit"). Owner decisions are in `docs/decisions.md`.

**Next up:** Scheduler. (1) Refresh B1 (#498) and B2 (#499) onto `main`; Dane tests B2 Settings on the preview. (2) Re-check done (`docs/scheduler-rebuild/RECHECK.md`; Dane's picks in `docs/decisions.md`). Updated demo (v1, Nov 13) is a private link: https://claude.ai/artifact/UePkDdre3r7jbpeV6NbrUM. Read it with the Artifact tool's `read` action; it is the working copy. Next: Dane's changes → he approves → save it over `docs/demos/scheduler.html` → update PART-B.md → B3.

## The vision (Dane, Nov 13, 2026)
- **One platform for Utah DSPD providers, built for the admin side first.** Staff screens exist to feed admins clean records.
- **What makes us different:** we save companies time and money. The platform reviews the paperwork, tells staff when something is missing or late, and pulls exactly what's needed at audit time.
- **As simple as possible.** The fewest code files and database tables that still do the job. Every rebuild deletes the old system it replaces, and anything the scope of work (DHHS91172) doesn't need is cut.
- **Phase 1: what the scope of work requires.** Phase 2: features that help agencies run better, added later.
- **Two checks on every feature:**
  1. **Competitors** (Connecteam, AxisCare, Therap, and similar care platforms): what do users love or need that we're missing? These are a gauge only; we never copy their look or names.
  2. **Rules** (DHHS91172, DSPD, Medicaid HCBS): what does the contract require that the feature must enforce, remind about, or produce for an audit?
- **Every feature is a demo first.** The demo works from start to finish with fake data, every button does something, and it remembers changes while you click around. Dane tests it and asks for changes. Once he approves, it's saved in `docs/demos/` and the real build must match it.

## How each tab gets done
1. **Audit:** what the tab does today, which tables and files it uses, and what's dead or duplicated.
2. **Compare:** competitors and contract rules, written as a short "keep / add / cut" list.
3. **Demo:** a clickable page with fake data. Dane revises it until he approves.
4. **Build:** small PRs straight into `main`, each one deleting what it replaces. No more than 2 PRs waiting for Dane at once.
5. **Live:** Dane merges. Update the scoreboard and move to the next tab.

## Admin tabs
Status: `audit` → `demo` → `demo approved` → `building` → `live` (✅ = rebuilt before this roadmap and live).

| Tab | Status | Notes |
|---|---|---|
| Team Members | ✅ live | Rebuilt Sept 28–30. Re-check against competitors later. |
| Clients | ✅ live | Rebuilt Oct 6–22 (incl. Meds, progress summaries). |
| **Scheduler** | **building (Part B)** | Demo: `docs/demos/scheduler.html`, `docs/demos/daily-notes.html`. Plan: `docs/scheduler-rebuild/PART-B.md` (B1–B20). B1 #498 and B2 #499 open, both 13 commits behind `main`; their DB changes went live Oct 23. B3–B20 not started. |
| Daily Logs | not started | Part B (B16–B19) rebuilds notes; decide whether this tab merges into it. The host home "can this day bill" grid and missing-note alerts belong here (moved out of the scheduler Nov 13). |
| Evidence | not started | |
| Summaries | not started | |
| Documentation | not started | |
| Finances | not started | |
| Training | not started | |
| Inbox | not started | |
| Settings | not started | |
| Nectar + Knowledge base | built, not live | PR #484 (N1–N6) points at retired `staging`, 99 commits behind `main`. Its DB changes went live Oct 13–14. Rescue it when we reach this tab: rebase onto `main`, retarget, test, merge. |
| Human Rights Committee | not started | |
| Home | not started | Do last; it summarizes the other tabs. |

## Other loose ends
- **Denim design system (PR #469):** 314 commits behind `main`. Kept open as a reference for the look; redo it later.
- **Phase B cleanup files waiting for Dane's OK:** see `supabase/migrations/*_b_*.sql` not yet in live history.
- **Known defects and open owner questions:** see the "Don't decide these" list in `CLAUDE.md`.

## Scoreboard (lower is better)
| Date | Tables (public) | Code files in `src/` | Lines in `src/` |
|---|---|---|---|
| 2026-11-13 | 274 | 1,773 | 376,664 |
