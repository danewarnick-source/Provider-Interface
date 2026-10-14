# Meds rebuild progress

One short report per prompt, newest last.

## M1 — Repairs, data and rules — MERGED
- PR https://github.com/danewarnick-source/Provider-Interface/pull/478 squash-merged into meds-rebuild (fc2f1629). Branch name `meds-rebuild-m1-repairs-data-rules`: git can't create `meds-rebuild/…` while a `meds-rebuild` branch exists.
- 10 migrations applied live (20261014000100–0900): relaxed emar_logs status check, new client_medications/emar_logs/incident_reports columns, client_medication_changes + medication_month_reviews, can_log_client_meds, dose INSERT rules, PHI-scoped reads, logged-dose lock trigger, log_medication_dose fn (PRN lock + client_request_id). Types regenerated (also pulled in unrelated live drift).
- Added src/lib/medications/ reference, med-rules, dose-status, meds-write, meds-actions, meds.functions, with 5 test files. Deleted saveEmarLog (nothing called it).
- Policies changed with ALTER POLICY + rename because DROP POLICY hangs through MCP. The administered dedupe index covers only source='emar', since main's shift screen stamps doses with shift start. Widen it in M6.
- tsc 203 → 203; build passes; unit tests 2275/2280 pass. The 5 failures also fail on the base branch (lambda-build-target, nectar-onboarding, notification-bell, org-subscription-activate, sow-index).
- Left for later: one-statement pill count and training check (M5), addendum permissions (M3).

## M2 — Medications tab and form — MERGED
- PR https://github.com/danewarnick-source/Provider-Interface/pull/480 squash-merged into meds-rebuild (bf091fb2); checks green.
- No migrations needed (M1 columns covered it). Uploads go through guarded server functions to `<orgId>/<clientId>/medications/`, which matches the bucket's agency-folder rules (the runbook said `medications/<client_id>/`).
- Added in src/lib/medications/: med-display, med-form, med-history, import-map, med-files(.functions), med-list-pdf, each with tests. Added 13 UI files under health/medications/; rewrote medications-card.tsx.
- Deleted mar-emar-tab, emar-chart, emar-ops-panel, emar-nectar-panel, medications-manager, emar-nectar.functions, medications.functions (incl. the unguarded parseMedicationsAI), the /dashboard/emar and /dashboard/admin/emar-audit routes, setRefillStatus, logMedicationTransfer, upsertClientMedication, and logShiftChangeCount (its only caller was deleted). Zero references remain.
- "Fill from label photo" skipped: document-extraction.ts sends only raw text to Bedrock.
- Self-admin flag removed from UI/writes. Support summary comes from how_taken; import maps support level per medication. care-data still returns the old flags (M4).
- tsc 203 → 203; build passes; unit tests 2311/2316, same 5 base failures.

## M3 — MAR tab, printout and monthly review — MERGED
- PR https://github.com/danewarnick-source/Provider-Interface/pull/481 squash-merged into meds-rebuild (31e8b2ec); checks green.
- Migrations applied live: 20261014001000_meds_m3_addendum_rules (correction reason; edit_medical or the logger within 24h; insert-only addenda) and 20261014001100_meds_m3_month_review_lock (review status/reopen columns + insert-only medication_month_review_events). Types regenerated.
- Added src/lib/medications/: mar.functions (getMarMonth, printMarMonth, signOffMarMonth, reopenMarMonth), mar-data, mar-grid, mar-cells, mar-month, mar-review, mar-pdf(-layout,-rows), med-guard.server, with tests. UI: mar-tab, mar-grid-table, mar-dose-sheet, mar-signoff, use-mar.
- Sign-off builds the PDF on the server, stores it at <orgId>/<clientId>/medications/ as a mar_month client document, and serves it through a short-lived signed link.
- Deleted hhs-mar-overview-calendar and its HHS hub tab (now a link to Health → MAR), normalizeEmarStatus, EMAR_STATUS_LABELS, and that tab's e2e test. Zero references remain.
- Skipped the Documentation → Medications unsigned-months link (that area isn't on this branch). PDF content is tested; nobody has looked at how it renders.
- tsc 203 → 203; build passes; unit tests 2336/2341, same 5 base failures.

## M4 — Staff see the medications (read-only) — MERGED
- PR https://github.com/danewarnick-source/Provider-Interface/pull/482 squash-merged into meds-rebuild (609065da); checks green.
- No migrations. Live RLS on client_medications is can_access_client_phi. Checked on live as a real staff member in a rolled-back transaction: 0 rows unassigned, 5 rows when assigned.
- Added src/lib/medications/staff-meds.ts (+test), src/components/medications/meds-read-only-list.tsx and meds-read-only-item.tsx. The list is used on the shift screen, the quick-info sheet (new there) and the staff workspace client page (About tab).
- care-data returns the new fields for active, not paused meds, and no longer returns scheduled_time, self_admin_med_support* or CareFlags. training.functions adds route, what it's for, side effects, signs of a bad reaction, PRN rules and psychotropic use; versioning unchanged.
- The shift screen's MAR panel lost its inline med details. Its dose logging and StaffMedicationsPanel remain for M5.
- tsc 203 → 203; build passes; unit tests 2344/2349, same 5 base failures.

## M5 — One Give meds component for staff — MERGED
- PR https://github.com/danewarnick-source/Provider-Interface/pull/485 squash-merged into meds-rebuild (f3b461c2); checks green.
- 5 migrations applied live (20261014001200–1600): witness/count columns + med_witness_confirmations, med_training_status, log_medication_dose rewrite (dose and one-statement pill decrement saved together, unclamped, server-read expected count, time-taken limits, approved training only, witness confirmed by their own sign-in), PRN follow-ups (prn_followup_due notification type + 5-minute pg_cron job), tighter logged-dose lock. Two first versions broke on live (controlled-dose write, admin review update). Both were fixed within minutes and re-verified in a rolled-back transaction.
- Added give-meds/ (10 files). It's used on the workspace MAR tab, the shift screen, the clock-out Meds item (?tab=emar; a due follow-up is a reminder) and the HHS daily note. logMedicationPass moved to src/lib/medications/give-meds.functions.ts and reads how_taken.
- Deleted staff-medications-panel, daily-note-meds-block, shift-med-due-check, use-shift-med-due-status, med-attestation, emar-status. logShiftChangeCount was already deleted in M2. Zero references remain.
- Decision for Jeff: no agency has medication training set up live, so staff can still log doses (training_checked='not_set_up'). Admins see "Set up medication training in Evidence".
- Not done: the MAR PDF prints only the count before the dose; nobody has looked at the screens in a browser.
- tsc 203 → 203; build passes; unit tests 2385/2390, same 5 base failures.
