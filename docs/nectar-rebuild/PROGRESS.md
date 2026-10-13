# Nectar rebuild progress

One short report per prompt, newest last.

## N1 — Safety fixes

N1 Safety fixes — PR https://github.com/danewarnick-source/Provider-Interface/pull/474 — merged: yes (66b356852a5539a5687bea44083341a4e6fed49f)
Checks: build ✓ · tsc 210→210 · unit 1639 tests, 5 failing (all pre-existing, the same 5 as START) · PR checks: Vercel ✓, Preview Comments ✓, sandbox ✓, production PR skipped · Done when ✓ (unit tests plus live SQL checks that rolled back; the team-member redirect click-through is listed under "Check on staging")
Migrations: none
Files: +29 −0 (13 new modules: engine/guard + guard.server, coach-notes/assist/incidents/model, note-activity; library/ingest + ingest.server, extracted-fields; help-links, browser-storage, draft-jobs-poll; plus 16 test files). ai-coach.functions.ts 729→159 lines, nectar-documents.functions.ts 488→275
Blocked / skipped: none. Left out on purpose: Billing Nectar's own localStorage keys (Decision 12); draftVarianceJustification kept with its guard (no callers, candidate for N2); per-feature AI settings wait for N3. With Nectar off, the clock-out note check falls back to the 30-word check instead of blocking (no current agency affected)
Orchestrator re-check of merged tip 66b356852: build ✓ · tsc 210 · unit 1639 tests, same 5 pre-existing failures.

## N2 — Cleanup

N2 Cleanup — PR https://github.com/danewarnick-source/Provider-Interface/pull/475 — merged: yes (69f575f108f26387e9fbe81d03d1f148ecb78446)
Checks: build ✓ · tsc 210→205 (0 new; the 5 gone were in deleted files) · unit 1659 tests, 5 failing (all pre-existing, same 5 as START) · PR checks: Vercel ✓, Preview Comments ✓, sandbox ✓, production PR skipped · Done when ✓ (grep: 0 refs to the 25 deleted files and 118 removed exports; build ✓; 14 Nectar screens render 200 via the built server handler, signed out with dummy env, click-through under "Check on staging"; PR lists every deleted file with line counts)
Migrations: 20261013155722_nectar_unflag_client_pcsp_source_and_archive_requirements (1 client PCSP row unflagged; all 1,768 nectar_requirements rows set to review_status 'removed', previous status kept in metadata.archived); types.ts regenerated from live (tsc unchanged)
Files: +9 −25 (deleted: authoritative-sources/policies/hive-exec approvals routes, draft-tick hook, draft-jobs driver/pill/poll, 5 dead Nectar components, nectar-engine, nectar-approvals, vector-search, held-timesheets, schedule-actions/parse, barrel, compliance shim, 3 orphans; added: lib/nectar/nav-map.ts, migration, 7 tests). authoritative-sources.functions.ts 2333→267 lines
Blocked / skipped: none blocked. Vector search deleted rather than re-pointed (0 of 48 timesheets ever embedded; 1024 would need a column type change). Help nav map reads dashboard.tsx's nav arrays via a ?raw import of the file, since that shared file may change only on the DraftJobs lines. compliance-desk.tsx (2,389 lines) not split. Also removed draftVarianceJustification (no callers, N1's note) and the exec extraction.approve capability.
Orchestrator re-check of merged tip 69f575f10: build ✓ · tsc 205 · unit 1659 tests, same 5 pre-existing failures · live: 1,768 requirements kept (all 'removed'), 0 client docs flagged as sources.
