# Clients polish — progress

## Notes for the run
- PR #457 (clients-rebuild → staging) was **already merged on Oct 6, 2026**. No open "Production:" PR exists for clients-rebuild, so pushes to clients-rebuild do not auto-sync to staging. The polish PRs land on clients-rebuild; shipping them needs a new clients-rebuild → staging PR later (the user decides).
- **Runbook updated (Oct 7, 2026):** the run is now C1 → C10, and **no e2e (Playwright) tests** are run, added or fixed. Checks are build, tsc and unit tests vs. the baseline, plus a "Check on staging" click-through list at the end of every PR body. The e2e baseline below is kept for reference only and is not a merge gate. (run-e2e.sh removed.)
- Prompt files: all five are in this folder (C1-C2 updated no-e2e version; C3-C4, C5-C6, C7-C10 added Oct 7, 2026).

## Baseline (clients-rebuild @ d14b63ff, Oct 7, 2026)
- `npx tsc --noEmit`: **203** errors (none under src/components/clients or src/lib/clients).
- `npm run test:unit`: 1843 tests, **5 failing**:
  - lambda-build-target.test.ts › Lambda build path does not collide with Vercel or build:aws › deploy-aws.yml updates matching Lambda before S3 --delete, then CloudFront
  - nectar-onboarding.test.ts › NECTAR onboarding — agency setup gate, no Home wizard › keeps the company documents hub as optional storage, not a SOW gate
  - notification-bell.test.ts › Admin notification bell › keeps the Admin-only mount and the chrome conditions that clip in-tree panels
  - org-subscription-activate.test.ts › confirm and webhook share the upsert › confirmCheckout upserts via activateSubscriptionFromCheckout
  - sow-index.test.ts › SOW index › builds about 300 rows from catalog + perimeters + standing + codes
- _E2E (reference only, not a gate):_
- E2E roster (20 tests): **3 failing**
  - clients-staff-roster.spec.ts:176 › 4. Team Members list loads; staff profile shows role at a glance
  - clients-staff-roster.spec.ts:671 › Caseload lives on the profile; /dashboard/assignments redirects
  - clients-staff-roster.spec.ts:852 › Access levels screenshots › access presets, bulk access dropdown, and profile scope save
  - (clients-profile-sections.spec.ts and clients-pcsp-review.spec.ts pass when warm.)
- E2E staff go-live (6): **0 failing**
- E2E daily logs (6): **4 failing** — daily-logs.spec.ts:65 (1. list does not crash), :86 (2. empty caseload message), :101 (3. compose UI / Close does not save), :134 (4. client picker binds a client)
- E2E 1056 (12): **12 failing** — all 7 in client-1056-billing.spec.ts (:65, :100, :159, :196, :239, :264, :295) and all 5 in punch-pad-gps.spec.ts (:112, :155, :168, :188, :199)

## Steps

### C1 — Shared layout, header and side menu — MERGED
- PR #458 (https://github.com/danewarnick-source/Provider-Interface/pull/458), squash-merged into clients-rebuild as 02d9d9c6.
- Checks: build passes (routeTree unchanged); tsc 203 (= baseline); unit 1856 tests, only the 5 baseline failures (13 new tests). E2E not run (runbook). Re-verified tsc/unit before merge.
- Migrations: none.
- Added 10: cards/section-card.tsx, cards/card-parts.tsx, cards/row-menu.tsx, profile-shell/tones.ts, header-pills.tsx, plans/pcsp-upload-button.tsx, activity/office-note-composer.tsx, activity/add-note-button.tsx, lib/clients/profile-header.ts (+ .test.ts). Deleted: cards/card-shell.tsx (CardShell, HexMarker, GroupHeader, Row, fmtDate); SkeletonCard, StrategiesTitle removed. Zero remaining imports.
- Client-area lines 37,295 → 38,167 (+872; 737 in new files).
- Blockers: none. Note: e2e/clients-new-client-pcsp.spec.ts:146 expects a link named "Import" (now "Import clients"); e2e not maintained per runbook, and C7 removes Import anyway.

### C2 — Clients list page — MERGED
- PR #459 (https://github.com/danewarnick-source/Provider-Interface/pull/459), squash-merged as 432a227e.
- Checks: build passes; tsc 203 (= baseline); unit 1868 tests, only the 5 baseline failures (12 new). E2E not run. Re-verified before merge.
- Migrations: none.
- Added 3: list/list-shortcut.tsx, lib/clients/list-display.ts (+ .test.ts). Deleted 0. Removed exports rowNeedsAttention, CodeBadges (zero imports). needsAttention now only in Smart Import.
- Client-area lines 38,167 → 38,680 (+513).
- Blockers: none. Note: list makes one extra best-effort read of the preferred_name custom field for "Goes by".

### C3 — Overview and Profile sections — MERGED
- PR #460 (https://github.com/danewarnick-source/Provider-Interface/pull/460), squash-merged as d9d90d9d.
- Checks: build passes; tsc 203 (= baseline); unit 1889 tests, only the 5 baseline failures. E2E not run. Re-verified before merge.
- Migrations applied to dhrrukdcigiiqksibdfb: 20261007120000_clients_about_me_summary.sql (client_about_me table, RLS like client_plans); 20261007120100_clients_about_me_strip_pcsp_blocks.sql (UPDATE, 1 row, hand-written text kept). Types regenerated. Nothing NEEDS JEFF.
- Added 13 code files (lib/clients/about-me*.ts, evv.ts, details/about-card.tsx, about-editor.tsx, agency-notes.tsx, use-about-me.ts, evv-note.tsx, detail-tile.tsx, profile/use-home-pin.ts + tests). Deleted: aboutMeLines, PCSP-review About rows, whenText (no files; client-photo-card.tsx kept, used by workspace/about-tab.tsx).
- Client-area lines 38,680 → 39,970 (+1,290).
- Blockers: none. Notes: client_about_me FKs have no ON DELETE (C10 is soft-delete only, so fine).

### C4 — Plans section and PCSP review — MERGED
- PR #461 (https://github.com/danewarnick-source/Provider-Interface/pull/461), squash-merged as 26d87e95.
- Checks: build passes; tsc 203 (= baseline); unit 1917 tests, only the 5 baseline failures. E2E not run. Re-verified before merge.
- Migration applied: 20261007130000_clients_goals_other_needs_kind.sql (client_goals.kind text default 'goal', check goal/other_need). Types regenerated (adds kind only). Nothing NEEDS JEFF.
- Added 20 files incl. lib/clients/pcsp-status.ts (one plan-year wording for Plans card, Overview, header tile, list Next due) and support-strategies.ts (+ tests); summary editor moved to src/components/summaries/ and reused as a profile side panel. Deleted: strategy-coverage.ts.
- Client-area lines 39,970 → 41,238. dashboard.summaries.tsx 1057 → 444; client-specific-training-card.tsx 895 → 645.
- Size: plans.ts 301 (+3, old file lightly touched; reported). Already oversized: training.functions.ts 1381, client-specific-training-card.tsx 645, dashboard.summaries.tsx 444.
- Blockers: none. Non-goal supports stored under one "Other needs in the PCSP" goal row (kind='other_need').

### C5 — Client file and Evidence — MERGED
- PR #462 (https://github.com/danewarnick-source/Provider-Interface/pull/462), squash-merged as 9dae38e0.
- Checks: build passes; tsc 203 (= baseline); unit 1937 tests, only the 5 baseline failures (26 new). E2E not run. Re-verified before merge.
- Migration applied: 20261007140000_evidence_client_packs.sql (evidence_client_packs table, RLS like evidence_items; evidence_items.added_by_hand, .description). 0 rows affected. Nothing NEEDS JEFF.
- Added 17 (lib/clients/file-packs.ts, file-rows.ts + tests, file-packs.server.ts, file-evidence.functions.ts, evidence/store.server.ts, items.server.ts, 9 components under profile/file/). Deleted 5: file-required.ts (+test, REQUIRED_DOCS), required-documents-card.tsx, document-upload-dialog.tsx, file-documents.functions.ts. evidence.functions.ts 1,398 → 896.
- Catalog: medical/dental exams, guardian papers, optional 1056 copy, PPS residence pack, housemate discussion in RHS pack; § cites checked against docs/compliance/dhhs91172/Requirements.json (several fixed).
- Client-area lines 41,238 → 42,938.
- Blockers: none. Follow-ups: packs re-sync to code changes when an owner/admin opens the Client file (others see it computed live); the agency Evidence grid doesn't read the new "optional" flag yet (1056 copy may show missing there); catalog.ts 1,643 → 1,737 (already oversized).

### C6 — Contacts, Health, Services, Money, Team, Activity — MERGED
- PR #463 (https://github.com/danewarnick-source/Provider-Interface/pull/463), squash-merged as d171bb13.
- Checks: build passes; tsc 203 (= baseline); unit 1956 tests, only the 5 baseline failures. E2E not run. Re-verified before merge.
- Migration applied: 20261007150000_clients_authorization_history_keeps_1056.sql (nullable 1056 number/approved date/units columns on client_billing_code_rate_history; history trigger also copies them and fires on their change). 0 rows. Nothing NEEDS JEFF. Side effect on main (shared DB): a 1056-number/units-only edit now also writes a history row.
- Renew bug fixed: renewal reused the single client+code row and lost the old 1056 number/date/units; now kept in history, renewal must start after the old end date (tested). "Past authorizations" reads history.
- Added 24 (lib/clients/activity.ts, authorization-renewal.ts, health-tiles.ts + tests; section headers/cards). Deleted 11 (shifts/daily-logs/incidents/office-notes panels, activity record-dialog, contact-row, care-card, authorization-row, authorizations-card, team-codes-card, code-scope-popover).
- Client-area lines 42,938 → 44,219.
- Blockers: none. Notes: Team saves per person (Save team / Undo removed); office notes keep lock + edit-only visibility; 1056 review "Confirm" → "Save authorizations from the 1056".

### C7 — Remove Smart Import, one Add client, spreadsheet templates — MERGED
- PR #464 (https://github.com/danewarnick-source/Provider-Interface/pull/464), squash-merged as d2a48fba.
- Checks: build passes (routeTree regenerated); tsc 203 (= baseline); unit 1963 tests, only the 5 baseline failures. E2E not run. Re-verified before merge.
- Migrations applied: none. **PHASE B (apply only after this reaches main):** supabase/migrations/20261007160000_smart_import_phase_b_discard_drafts_and_reminders.sql — sets discarded_at on the 1 open client draft and unschedules the smart-import-reminders pg_cron job (production main still runs Smart Import until then). No DELETE.
- Deleted 32 files (17,346 lines): all Smart Import routes/components (incl. timesheet and daily-note wizards), lib/smart-import*, reminders hook + chip, import-validation, clients/import-template.ts, lifecycle.functions.ts, client-needs-attention.tsx, Company Migration page, Smart Import e2e spec. Net −16,655 lines repo-wide.
- Added 15: shared lib/spreadsheet-import/ + components/spreadsheet-import/, lib/clients/import-sheet*.ts (+test), add-client-start.tsx, import-clients-dialog.tsx, import-client-row.tsx, use-import-clients.ts, team-members import-columns/import-template/import-member-row.
- Client-area lines 44,219 → 44,939 (+720, new spreadsheet import).
- Blockers: none. Follow-ups: team member template drift fixed (Supervisor, Worker type added; Job title removed); import_merge_flags still written by document upload but nothing resolves them; hireTeamMemberInternal keeps an unused "smart_import" branch; one open employee draft left as is.

### C8 — Fill from PCSP fills everything — MERGED
- PR #465 (https://github.com/danewarnick-source/Provider-Interface/pull/465), squash-merged as 06cd70b0.
- Checks: build passes; tsc 203 (= baseline); unit 1980 tests, only the 5 baseline failures. E2E not run. Re-verified before merge (incl. storage-path org/folder checks on every server download).
- Migration applied: 20261007170000_clients_pcsp_read_log.sql (pcsp_read_log, no PHI; RLS: org admins read, members insert own). Nothing NEEDS JEFF.
- Add client from PCSP and Plans upload both write only via confirm-write.ts (profile blanks, SC + providers, plan year, goals/supports, codes with units); addClientFromPcsp saves client + plan in one server call (not one DB transaction: if the plan save fails the client is kept and the screen links to Plans). About draft started, approval required. PCSP filed on the Evidence "Current PCSP on file" row.
- "Four tries" findings: base64 PDF in the request body hit host size limits (~3.4 MB+) → now uploads straight to client-documents storage; errors were a brief toast / bare 500 → now on-screen reason + Try again; provider-name match used one name and missed "L.L.C." → both names, case/punctuation/LLC/Inc-insensitive (tested). Server time limit is host config (not raised); durations now logged.
- Added 17 (agency-match.ts, read-report.ts, confirm-profile.ts + tests, file-pcsp.server.ts, create.server.ts, create-from-pcsp.functions.ts, evidence/record-upload.server.ts, migration…). Deleted 0; removed pcspBytes, norm, ourAgencyMatcher.
- Client-area lines 44,939 → 46,297.
- Blockers: none.

### C9 — Optional full setup, hide what doesn't apply — MERGED
- PR #466 (https://github.com/danewarnick-source/Provider-Interface/pull/466), squash-merged as bd2e48e3.
- Checks: build passes; tsc 203 (= baseline); unit 1994 tests, only the 5 baseline failures. E2E not run. Re-verified before merge.
- Migration applied: 20261007180000_clients_support_scope.sql (client_support_scope, RLS like client_about_me). 0 rows. Nothing NEEDS JEFF.
- "Admitted" → "Start date" (label only; UI grep clean). All three add-client paths land on "Finish setting up"; clients added before this get no banner.
- Added 17 (lib/clients/support-scope*.ts, client-setup.ts + tests, health/diet-card.tsx, 12 files under profile/setup/). Deleted 1: health/swallowing-card.tsx (merged into Diet and swallowing).
- Client-area lines 46,297 → 47,978.
- Blockers: none. Judgment calls for Jeff: "No" on BSP hides the BSP card even for BC1–BC3 clients; "No" on advance directive doesn't hide it if a DNR/POLST is recorded; new Needs attention item "Signed DNR / POLST form missing".
