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

## N3 — Library data

N3 Library data — PR https://github.com/danewarnick-source/Provider-Interface/pull/476 — merged: yes (a6c4b5fd01308f9f9a5cb75c4adeec29cb1e4a73)
Checks: build ✓ · tsc 205→205 (same errors) · unit 1781 tests, same 5 pre-existing failures as START (1659) · PR checks: Vercel ✓ (~21 min to deploy), Preview Comments ✓, sandbox ✓, production PR skipped · Done when ✓ (unit tests cover everything listed; live RLS check rolled back, 0 rows left: owner sees drafts, in-audience member sees published only, outside member sees nothing, state rule readable by any member, second review of a version refused)
Migrations (byte-identical to live): 20261013221151 slots (10 rows; 2 org toggles) · 221232 library columns (6 TNS company docs backfilled published, 1 procedures/5 reference, review date +1 yr) · 221418 ALTER POLICY: members see library docs only when published and meant for them (no rows changed) · 221613 state_rule_documents (SOW copied, 259,223 chars, not cut) · 221630 knowledge_sections · 221643 nectar_questions · 221650 nectar_settings (all on) · 221702 typed_signature nullable + one review per version; types.ts regenerated from live
Files: +51 −0 (8 migrations, 20 modules in lib/nectar/library, 23 tests); guard.ts 64→132, guard.server.ts 70→91, rate-limit 153→179, ai-coach.functions 147→153, ai-bedrock.server 621→623, nectar-help.functions 772→772 (1 line)
Also done: guard checks AI settings (note helpers = note_help; clock-out question and admin help = ask); embeddings get their own rate limit (old one: 4/min per agency); "Policy / procedure" uploads now filed as agency; web capture no longer cut at 50,000 chars
Decisions: reviews cover Agency policies + Procedures and forms only; agency_settings is owner-only, so library admin = owners; MCP waits for approval on DROP POLICY, so ALTER POLICY used
Blocked / skipped: none blocked. Not in search yet: the SOW (needs a hive exec to index it; N4) and the 6 backfilled docs (indexed on first publish or refreshKnowledgeSearch). Old Knowledge page not touched (525 lines)
For N4–N6: library.functions.ts exports listLibrary, getLibraryDocument, createLibraryDraft (resolvesQuestionId), saveLibraryDraft, publishLibraryDocument, publishLibraryVersion, archiveLibraryDocument, setLibraryAudience, getRequiredPolicies, setRequiredPolicyAnswers, getReviewMatrix, getStaffReviewRecord, getPolicyForReview, markPolicyReviewed, refreshKnowledgeSearch; uploads.functions.ts exports createLibraryUploadUrl; N4 exec uses indexStateRuleVersion; N5 calls requireNectarOrg(ctx,{orgId,feature:"ask"}) and needs a server-side write for thumbs up/down (only admins can update nectar_questions)
Orchestrator re-check of merged tip a6c4b5fd0: build ✓ · tsc 205 · unit 1781 tests, same 5 pre-existing failures · live nectar_documents read policy: rows without library_group (all rows main's code creates) read as before; admins still see all.
