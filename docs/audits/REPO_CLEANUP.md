# HIVE repo cleanup audit

**Type:** Read-only. No application code, routes, queries, or behavior were changed. This file is the only deliverable.

**Date:** 2026-08-27.
**Tree:** `origin/main` at `6b3db5bc` (merge of PR **#167**). PRs **#165**, **#166**, and **#167** are all merged. There were no open PRs at audit time.

**Sep 1 context:** Tuesday 2026-09-01 agency test for True North Supports (HHS, SLN, SLH, SEI, DSI). Operational punch list lives in `GO_LIVE.md` (PR #166). This document answers a different question: **what is dead, what is dual, and what is scary-but-load-bearing** — without proposing a rewrite.

**Method:** Current `src/routes/` + `src/routeTree.gen.ts` (what the app actually mounts), `STAFF_NAV` / `ADMIN_NAV` / `EXEC_NAV`, inbound `Link`/`navigate`/`redirect` grep, and an import-graph pass over `src/` (basename never mentioned outside the file = orphaned). June docs (`LAUNCH_READINESS_AUDIT.md`, `FEATURE_INVENTORY.md`, `ROUTE_MAP.md`, `docs/platform-qa-map.md`) were treated as hypotheses and **re-checked**. Several of them are stale.

**Rule used throughout:** never recommend deleting a route file the router still mounts. A page can be unused *by testers* and still be a live URL. Redirect stubs exist specifically so old bookmarks do not 404.
