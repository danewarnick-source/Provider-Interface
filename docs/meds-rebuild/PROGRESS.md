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
