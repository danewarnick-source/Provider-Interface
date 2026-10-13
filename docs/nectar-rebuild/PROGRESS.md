# Nectar rebuild progress

One short report per prompt, newest last.

## N1 — Safety fixes

N1 Safety fixes — PR https://github.com/danewarnick-source/Provider-Interface/pull/474 — merged: yes (66b356852a5539a5687bea44083341a4e6fed49f)
Checks: build ✓ · tsc 210→210 · unit 1639 tests, 5 failing (all pre-existing, the same 5 as START) · PR checks: Vercel ✓, Preview Comments ✓, sandbox ✓, production PR skipped · Done when ✓ (unit tests plus live SQL checks that rolled back; the team-member redirect click-through is listed under "Check on staging")
Migrations: none
Files: +29 −0 (13 new modules: engine/guard + guard.server, coach-notes/assist/incidents/model, note-activity; library/ingest + ingest.server, extracted-fields; help-links, browser-storage, draft-jobs-poll; plus 16 test files). ai-coach.functions.ts 729→159 lines, nectar-documents.functions.ts 488→275
Blocked / skipped: none. Left out on purpose: Billing Nectar's own localStorage keys (Decision 12); draftVarianceJustification kept with its guard (no callers, candidate for N2); per-feature AI settings wait for N3. With Nectar off, the clock-out note check falls back to the 30-word check instead of blocking (no current agency affected)
Orchestrator re-check of merged tip 66b356852: build ✓ · tsc 210 · unit 1639 tests, same 5 pre-existing failures.
