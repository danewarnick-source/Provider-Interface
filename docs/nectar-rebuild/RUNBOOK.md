# Nectar and Knowledge Base Rebuild — Runbook (N1–N6 now · N7 and N8 later)

_Written Oct 12, 2026 from the "Nectar and Knowledge Base Rebuild Plan" (Claude Docs) and the "Nectar and Knowledge Base Demo" (Design canvas), with Jeff's decisions from that evening._

Owner: Jeff (Dane Warnick). Repo: danewarnick-source/Provider-Interface. Live Supabase project: dhrrukdcigiiqksibdfb.

This rebuild turns the Knowledge base into the agency's one policy library and makes Nectar one engine that answers only from what the asker is allowed to see, with a checked source on every answer.

- **N1–N6** touch no client or scheduler code, so they can run **at the same time as** the Clients rebuild and Scheduler Part A.
- **N7** waits until the Clients rebuild and Scheduler Part B are on `main`.
- **N8** removes old tables. It runs only when Jeff's message says "Run N8".

---

## DECISIONS (Jeff, Oct 12, 2026; build exactly to these)

1. **One library.** The Knowledge base holds agency-wide documents only, in four groups: Agency policies, Procedures and forms, State rules, Reference. Client documents (PCSP, BSP, HRC approvals) stay on the client profile and are uploaded once, there.
2. **Statuses.** Each library document is Draft, Published or Archived, with a version number, an owner and a next-review date. Nectar and staff see only Published. Archive, never delete.
3. **Required policies checklist** with 10 slots from DHHS91172: §1.17(a) Personnel policies, §1.17(b) Job descriptions, §1.18(1) Staff and supervisor duties, §1.18(2),(7) Transportation and driving record (only if the agency provides transportation), §1.18(3) Grievances, §1.18(4) Emergencies, health decline and death, §1.18(5) Personal finances (only if the agency manages clients' money), §1.18(6) Behavior supports (R539-4), §1.21 Human rights plan, §1.23 Health and medication. Each slot shows Missing, Draft, Published or Past review.
4. **Mark as reviewed, not sign-off assignments.** Each published policy has one "Mark as reviewed" button for the people it's for. It saves a dated record (person, policy, version, date). A new version asks those people again. No assignment lists, no due dates.
5. **Who it's for: two options only.** "All team members" (default) or "Only the people I check" (a checkbox next to each team member's name). Only those people see it, are asked to review it, and get Nectar answers from it. No positions, homes or groups.
6. **State rules are loaded by PI once for every agency** (read-only, kept current by the PI team). Agencies don't upload the contract.
7. **Staff see the state rules.** Staff Nectar searches: published library documents meant for them, the state rules, and the plans, must-knows and medication lists of clients assigned to them. Never other clients, pay, hours, other staff or billing.
8. **No answer without a source.** If nothing the asker may see matches, Nectar says "I couldn't find that in your agency's documents" and logs the question. Every answer lists its sources; PI checks every cited section ID before showing the answer.
9. **Questions tab** (admin): unanswered questions and thumbs-down answers, with the asker's name. Two actions only: **Add to library** (opens a new draft policy prefilled with the question and resolves it) and **Mark resolved**. No "assigned to".
10. **AI settings:** Nectar on/off for the agency, plus on/off per feature (Ask, shift note help, PCSP reading, summary drafts). Every answer and draft is labeled as AI.
11. **Requirements pipeline goes.** The old requirement extraction, draft jobs and approvals code is removed; its 1,768 rows are archived and dropped in N8.
12. **Billing Nectar, Financial Nectar, exec Steve and exec articles are left alone.**
13. **Reviews count as policy training later.** In N7, review records also show in Evidence as §1.8(4)(P) policy training. Not before, because the scheduler rebuild is changing Evidence reads now.

---

## HOW TO RUN THIS (read first, Claude Code)

You are running unattended. Jeff will say which steps to run ("N1–N6", "N7" or "Run N8").

1. Read `CLAUDE.md` first and obey it. Then read this whole file once.
2. Integration branch: `nectar-rebuild`. If it exists on origin, check it out; otherwise create it from latest `main`. Make sure this file is at `docs/nectar-rebuild/RUNBOOK.md`.
   - **N7:** first confirm with `git log origin/main` that the Clients rebuild and Scheduler Part B are merged to `main`. If not, stop and say so. Then rebase `nectar-rebuild` on `main` (or start `nectar-rebuild-n7` from `main` if N1–N6 already merged).
   - Supabase: confirm you can apply migrations to live `dhrrukdcigiiqksibdfb`. If you can't, still write each migration file, mark it `NOT APPLIED` in the PR body, and continue only if the prompt's code doesn't depend on it; otherwise stop.
3. For each prompt, in order:
   a. Start a **fresh subagent**. Give it the Decisions, the Standard Rules and that prompt, verbatim.
   b. It works on branch `nectar-rebuild/nN-<short-name>` cut from the current tip of `nectar-rebuild`.
   c. Before finishing it must pass: `npm run build` (commit the regenerated `src/routeTree.gen.ts`), `npx tsc --noEmit` with **no new errors vs. the start of the prompt** (record both counts), `npm run test:unit`, and the prompt's "Done when". Skip e2e.
   d. Open a PR into `nectar-rebuild` titled `Nectar rebuild NN: <name>`. Body: what changed, files added and deleted, line counts before → after for touched files, migrations applied, test results, anything skipped.
   e. If every check passes, **squash-merge it into `nectar-rebuild`** and continue.
   f. If a check fails and two honest attempts within the prompt's scope don't fix it: leave the PR open, put `BLOCKED: <reason>` at the top of its body, and **stop the run**.
4. At the end (or a stop), open one PR from `nectar-rebuild` → `staging` titled `Nectar and Knowledge base rebuild (N1–N6)`. Body: a table of the step PRs with status, every migration applied, and a "Check on staging" click-through list.
5. Never merge anything into `staging` or `main` yourself. Jeff does.
6. **Clean slate after every PR:** the subagent returns only a ≤ 10-line report (PR link, merged yes/no, checks, migrations, files added/deleted, anything blocked). Append it to `docs/nectar-rebuild/PROGRESS.md` and commit. If interrupted, read PROGRESS.md and continue from the first prompt not marked merged. Don't read diffs yourself; start a small subagent if you need a fact.
7. **Running beside the Clients rebuild and Scheduler Part A (N1–N6):**
   - Touch **nothing** under `src/lib/clients/`, `src/components/clients/`, `src/lib/scheduler/`, `src/lib/scheduling/`, `src/components/scheduler/`, `src/components/scheduling/`, `src/components/schedule-preview/`, any client or scheduler route, `src/components/evv/punch-pad.tsx`, or any medications/eMAR file (the meds rebuild deletes `emar-nectar.functions.ts` and `components/workspace/emar-nectar-panel.tsx`; leave them).
   - Don't change the Evidence tables or `src/lib/team-members/readiness.ts`, `eligibility.functions.ts`, `staff-qualifications.functions.ts`.
   - `src/routes/dashboard.tsx` is shared: only N6 edits it, and only the lines named there.
   - If `src/integrations/supabase/types.ts` conflicts, regenerate it from the live schema; never hand-merge.
   - The Scheduler runbook lists `lib/nectar-staff.functions.ts` as a reader of `scheduled_shifts` it will re-point in Part B. When N5 replaces that file, keep **all** shift reads for Nectar in one small file, `src/lib/nectar/context/shifts.ts`, so the scheduler has one place to update. Note this in the N5 PR body.

---

## STANDARD RULES (every prompt)

- Read CLAUDE.md first. Never read or write the `role` column. Never PostgREST-embed organization_members↔profiles (two queries, join in JS).
- **Database:** every change is a migration in `supabase/migrations/` named for what it does, applied to live. N1–N7 are **additive only** (new tables/columns, backfills, functions, RLS, relaxing NOT NULL). No drops, renames or type changes before N8. Regenerate `types.ts` after any migration. Confirm a column exists live before relying on it (older migrations may not match live).
- **No hard deletes** of documents, versions, reviews or questions. Use `archived_at` / a status.
- **No PHI** in code, tests, fixtures, logs or PR text. Never log prompts, answers or document text to the console or server logs; log IDs only. Nothing Nectar-related in `localStorage`.
- **Organization:** Nectar logic in `src/lib/nectar/` (subfolders `engine/`, `context/`, `library/`); Knowledge base UI in `src/components/knowledge/`; Nectar UI in `src/components/nectar/`. No barrel `index.ts` files. `git mv` to keep history.
- **Size limits:** route files ≤ 80 lines, components ≤ 250, lib files ≤ 300. Split before merging.
- **Delete what's unused** in the same PR: grep every removed export and confirm zero imports. No commented-out code, no "legacy" copies.
- **Writes go through server functions.** Admin library and Nectar admin actions: `requireCategory(..., "agency_settings", "edit")` for writes and `"view"` for reads, plus agency-wide scope. "Mark as reviewed" and Ask: any active member of the org, checked by membership on the server. Every Nectar server function checks: signed in, active member of the org, org has the `nectar` feature (one key everywhere; remove the `nectar_infusion` check), the per-feature AI setting is on, and the per-org rate limit (`nectar-rate-limit.server.ts`), passing `orgId`.
- **Bedrock:** all model and embedding calls go through `src/lib/ai-bedrock.server.ts`. Embeddings use size 1024 (Titan v2).
- **Tests:** every new or changed lib file gets a `*.test.ts` next to it, added to the `test:unit` list in package.json.
- **Wording:** plain English; "team member" and "client"; "§" hints only where the plan shows them. Label Nectar output "Nectar · AI assistant".
- **Match the demo.** The "Nectar and Knowledge Base Demo" canvas is the reference for layout, wording and behavior of every screen in N4 and N6.

---

## N1 — Safety fixes (no redesign)

1. **Route guards:** `/dashboard/help`, `/dashboard/hub/knowledge` and `/dashboard/nectar-docs` require admin level (`RequireLevel min="admin"`) in addition to the feature gate. Staff opening them by URL are sent to `/dashboard/ask-nectar`.
2. **Server guards:**
   - `lib/nectar-documents.functions.ts` `ingestDocument`: check admin membership **before** uploading to storage. Drop the `clientId` autofill path from the Knowledge base flow (the call to `applyExtractedFieldsToClient` runs only when the caller is an admin and the upload came from a client profile; leave the client path's behavior otherwise unchanged).
   - Stop running client-field extraction (`document-extraction.ts`) on Knowledge base uploads (owner_kind `company` or `state`).
   - `queryDocuments`, `getDocument`, `listAuthoritativeSources`: add a server-side membership check as a second layer to RLS.
   - `lib/ai-coach.functions.ts`: add the membership + `nectar` feature + per-feature setting (once N3 adds it; until then feature only) + rate limit (pass `orgId` to `callAI`). **Server side only; no change to function names, inputs or outputs**, because `punch-pad.tsx` calls them.
   - In `draftShiftNote`, delete the "write a general baseline-support narrative" fallback (around line 216): with no goals and no described activity, return a message asking the staff member to describe what they did. Never invent activities.
3. **Admin help (`lib/nectar-help.functions.ts`):** remove "NEVER say I'm not sure" and "Lead with the DIRECT ANSWER" (lines ~649–652) and the reference to the retired "Authoritative Sources" screen (line ~669). Compute the org-wide counts (lines ~403–462) only for agency-wide admins.
4. **Browser storage:** remove `hive.nectar.helpHistory` and any other Nectar question history from `localStorage` (`routes/dashboard.help.tsx`). Add a one-time cleanup that deletes the old key on load.
5. **Polling:** inside `draft-jobs-driver.tsx` (not `dashboard.tsx`, which is shared), make the 5-second `getActiveDraftJobs` polling run only for agency-wide admins and only while a job exists. N2 deletes the provider entirely and removes its mount from `dashboard.tsx` then.
6. **Deep links:** the AI-chosen link in admin help is checked against a list of real routes before it's shown; remove the hack that sends any `$clientId` link to `/dashboard/billing`.

**Done when:** a staff test user gets redirected from the three admin pages; a staff call to `ingestDocument` is refused before anything is written to storage; `ai-coach` functions refuse a non-member and respect the rate limit; no Nectar key in `localStorage` after a question; unit tests cover each guard.

## N2 — Cleanup (no visible change except removed dead pages)

1. Delete the redirect routes `dashboard.authoritative-sources.tsx` and `dashboard.policies.tsx` and every link to them.
2. Delete dead components and libraries (confirm zero imports first): `components/nectar/agency-sources-panel.tsx`, `authorized-codes-panel.tsx`, `nectar-rail.tsx`, `requirement-tracking-editor.tsx`, `source-citation-chip.tsx`; `lib/nectar/index.ts` (barrel), `lib/nectar-compliance.ts`, `nectar-held-timesheets.functions.ts`, `nectar-schedule-actions.functions.ts`, `nectar-schedule-parse.functions.ts`.
3. Remove the requirements pipeline: the unused exports in `authoritative-sources.functions.ts` (`updatePolicyConfig`, `setSourceIgnoreState`, `listRequirements`, `upsertRequirement`, `deleteRequirement`, `setRequirementReviewStatus`, `setRequirementVerificationType`, `verifyRequirement`, `listRequirementAttestations`, `explainRequirement`, `startRequirementsDraft`), the draft-job driver and header pill, `nectar-draft-tick.server.ts` and its route `routes/api/public/hooks/nectar-draft-tick.ts`, the unused functions in `nectar-engine.functions.ts` and `nectar-approvals.functions.ts`, `getExtractedFields`. Keep anything still imported by a live screen (report what stayed and why). Remove the `DraftJobsProvider` mount and pill from `routes/dashboard.tsx` (those lines only).
   - If `/dashboard/hive-exec/approvals` only shows requirement approvals, remove it and its exec-nav entry.
4. Delete the broken `lib/vector-search.functions.ts` (1536-size embeddings) and its callers' buttons on the compliance desk, or re-point them to size 1024 if they're used by a live screen (report which).
5. Data fixes (migration): set `is_authoritative_source = false` on the client PCSP row currently flagged as an agency source (`owner_kind = 'client'`). Mark all `nectar_requirements` rows `archived` (or `review_status = 'removed'`) without deleting.
6. Remove the 17 tour anchors in `lib/nectar/tour-anchors.ts` that match no `data-tour` element, and the hand-written navigation map in the help prompt; build the map from the real nav arrays instead (import them, don't copy).

**Done when:** `npx knip` (or grep) shows no references to any deleted file or export; the app builds; every remaining Nectar screen opens; PR body lists every deleted file with line counts.

## N3 — Library data (additive migration and library logic)

`nectar_documents` already has `version`, `parent_document_id`, `superseded_by`, `superseded_at`, `requires_acknowledgment`, `policy_assigned_users`, `archived_at`. Reuse them; confirm live first.

1. **Migration, `nectar_documents`:** add `library_status text check in ('draft','published','archived') default 'draft'`, `library_group text check in ('agency','procedures','state','reference')`, `required_slot text`, `owner_name text`, `review_due date`, `audience_all boolean default true`. Who it's for = `audience_all` true, or false with `policy_assigned_users` holding the checked people's user IDs. Backfill: existing company documents → `library_group` from `authoritative_kind` (provider_policy → agency, tool_template → procedures, others → reference), `library_status = 'published'`, `review_due = created_at + 1 year`.
2. **New table `required_policy_slots`** (id text, code, label, applies_when text null in ('transport','finances')) seeded with the 10 slots in Decision 3, plus agency settings `provides_transportation boolean default true` and `manages_client_money boolean default false` (on `organizations` or the existing org settings table; confirm which exists live).
3. **New table `state_rule_documents`** (no organization; title, effective_from, raw_text, version, published_at, archived_at) readable by any authenticated active org member, writable only by `hive_executives`. Seed it by copying the existing DHHS91172 Scope of Work text from the live `nectar_documents` row where `authoritative_kind = 'state_sow'` (do not move or delete the original). Fix the 50,000-character cut: if the stored text is truncated, re-extract from its storage file.
4. **New table `knowledge_sections`** (id, organization_id null for state rules, document_id null, state_document_id null, client_id null, version, heading, body, position, tsv tsvector generated from heading + body, embedding vector(1024), created_at). Indexes: GIN on tsv, ivfflat or hnsw on embedding, btree on (organization_id, document_id). RLS: a section is readable exactly when its source is readable (library doc published + audience includes the user, or state rule, or client doc the user can see via `access_can_see_client`).
5. **New table `nectar_questions`** (id, organization_id, asked_by user id, asker_name, scope text 'admin'|'staff', client_ids uuid[], question, answer, cited_section_ids uuid[], found boolean, feedback text null 'up'|'down', status 'open'|'resolved', created_at, resolved_at, resolved_by). RLS: insert by any member for themselves; read and update by agency-wide admins; a member can read their own.
6. **Agency AI settings:** `nectar_settings` jsonb on the org (or a small table) with `enabled`, `ask`, `note_help`, `pcsp_reading`, `summary_drafts`, all default true.
7. **`policy_signatures`:** confirm its NOT NULL columns live. "Mark as reviewed" writes one row: document_id, document_version, user_id, signer_full_name, signed_at, attestation_statement "I have reviewed this version.", consent_accepted true, content_hash of the version text. Relax NOT NULL on `typed_signature` and any column a simple review can't fill.
8. **Library logic (`src/lib/nectar/library/`):**
   - `sections.ts`: split a document into sections by its headings (Markdown `#` lines, numbered headings like "4.2", or lines in Title Case on their own); fall back to ~1,200-character chunks on paragraph breaks. Pure function, tested.
   - `index.server.ts`: on publish, write `knowledge_sections` rows for that version with embeddings; on archive or new version, remove the old version's sections from search (keep rows, flag them). Runs inside the publish server function so search is current the moment it's published.
   - `uploads.functions.ts`: uploads go straight to the `nectar-documents` storage bucket with a signed upload URL (no base64 in the request). A file with no readable text gets `parse_status = 'no_text'` and the UI shows "No readable text" instead of "parsed".
   - `library.functions.ts`: list (grouped), get (with versions and review counts), create draft, save draft, publish, publish new version (old version kept with `superseded_by`), archive, set who it's for, required-slot status, mark as reviewed, review matrix, staff record.
   - Fix the type mapping bug: "Policy / procedure" uploads must land as `library_group = 'agency'`, not `document_type = 'other'` with nothing else.

**Done when:** migration applied; types regenerated; unit tests cover section splitting, slot status (Missing / Draft / Published / Past review, transport and finances toggles), audience filtering (all vs checked people), new version resets reviews, mark-as-reviewed is idempotent per version; RLS tested with an admin, a staff member in the audience and one outside it.

## N4 — Knowledge base screens (admin)

Route `/dashboard/hub/knowledge` (≤ 80 lines) renders `components/knowledge/knowledge-page.tsx`. Replace the old `components/pages/knowledge-page.tsx` and `components/nectar/authoritative-source-drop.tsx` and delete them (and `lib/knowledge-page.lock.test.ts`, replaced by new tests). Match the demo:

1. Header "Knowledge base" with one line under it and a **New document** button. Three tabs:
   - **Library:** four groups; each row shows name, required-slot label, version, status chip, owner, next review, "N of M reviewed" (M = the people it's for). Click a row to open it.
   - **Required policies:** "X of Y required policies published and current", the two agency toggles ("We provide transportation", "We manage clients' personal money"), and one row per slot: code, label, status chip, document name, **Open** or **Add** (Add opens New document prefilled with the slot).
   - **Reviews:** a table of team members × published policies; each cell "Reviewed Oct 3" / "Needs review" / "Not for them". Click a name for their printable record (policy, current version, reviewed date or "Not reviewed yet", Print button using a print stylesheet).
2. **New document:** name, group, "Fills a required policy" (or None), text box (heading on its own line, blank line between sections) **or** file upload (PDF, Word, text). Saves as Draft.
3. **Document view:** title, status chip, meta line (group · version · owner · next review · slot), note for drafts / past review / state rules, the sections, and a side panel with **Versions**, **Who it's for** (two radio options; checkboxes for each active team member under the second; warning if none checked) and **Reviewed vN: X of M** with each person's status. Actions: Publish (draft), Edit draft, Publish new version (edit text or upload a new file; old version archived, everyone it's for asked again), Archive.
4. State rules show in the State rules group, read-only, labeled "Loaded by PI for every agency". In exec `/dashboard/hive-exec/knowledge`, add a small "State rules" section for `hive_executives` to upload or replace a state rule document (new version), which re-indexes its sections.
5. Remove "Company policies" from the Agency file (`components/agency-documents/company-policies-tab.tsx` and its functions in `lib/agency-policies.functions.ts`); the `agency_policies` table has 0 rows. Replace the tab with a link to the Knowledge base.
6. Delete `components/pages/nectar-docs-page.tsx`'s **company** upload path only. Leave the `/dashboard/nectar-docs` route itself in place (a client card links to it; N7 removes it).

**Done when:** every action in the list above works against live data in the True North Supports test org; unit tests for each server function's guard; the old knowledge page files are deleted.

## N5 — One Nectar engine

1. `src/lib/nectar/engine/ask.functions.ts` exports one server function `askNectar({ question, view: 'admin' | 'staff' })`. Steps:
   - Guards (Standard Rules), including the `ask` AI setting.
   - **Scope** from access, never from the request: admin view = agency-wide admins only; staff view = the caller's own scope. Context loaders in `src/lib/nectar/context/`: `library.ts` (published docs whose audience includes the caller), `state.ts` (state rules), `clients.ts` (assigned clients via `clients_for_staff` for staff, all clients for agency-wide admins: plan goals, special directions/must-knows, medication list from `client_medications`), `shifts.ts` (the caller's own published shifts; the **only** file that reads `scheduled_shifts`), `agency.ts` (admin only: required-slot status, review matrix counts, org counts).
   - **Pay and hours** questions from staff get the fixed refusal ("Nectar doesn't answer pay or hours questions. Ask your supervisor or the office.") without a model call.
   - **Search** `knowledge_sections` the caller may read with both full-text (tsv) and embeddings; merge and keep the top 8. Client plan fields and medications are passed as small labeled facts with their own IDs.
   - **Model call** with the trust layer (`lib/nectar-trust.ts`): sources wrapped as untrusted data, instruction to answer only from them and cite their IDs in `[S:<id>]` form, to say it couldn't find it otherwise, and never to add facts not in the sources.
   - **Check citations:** strip any cited ID not in the set sent; if no valid citation remains, replace the answer with "I couldn't find that in your agency's documents." Return `{ answer, sources: [{ id, documentTitle, heading, version, kind }], found }`.
   - **Log** every question to `nectar_questions` (found false → shows in Questions as open).
   - `feedbackNectar({ questionId, value })`: thumbs up/down; down sets status open so it appears in Questions.
2. Delete the old stacks after re-pointing callers: `askNectarHelp` (`lib/nectar-help.functions.ts`), `askNectarStaff` (`lib/nectar-staff.functions.ts`, `nectar-staff-scope.ts`, `nectar-staff-errors.ts`). Keep `escalateHelpToHive` / `getHelpTicketStatus` (move them to `lib/nectar/support.functions.ts`).
3. Do **not** change `answerProceduralQuestion` in `ai-coach.functions.ts` (punch-pad uses it); N7 points it at the engine.

**Done when:** unit tests with mocked Bedrock cover: staff can't get an answer from an unassigned client, a policy not meant for them, or a draft; staff can get one from the state rules; invalid citations are stripped; no-match returns the fixed message and logs `found = false`; pay question returns the refusal with no model call. PR body notes `context/shifts.ts` for the scheduler.

## N6 — Nectar screens

1. **Admin `/dashboard/help`** → `components/nectar/admin/nectar-page.tsx`, three tabs matching the demo:
   - **Ask:** chat; each answer labeled "Nectar · AI assistant" with its source chips (click opens the document in the Knowledge base, or the Required policies tab for agency facts) and thumbs up/down; suggested questions; the "Guide me" and "Ask the PI team" actions kept.
   - **Questions (N open):** filters Open / Resolved / All; each card shows the kind ("No answer found" / "Marked not helpful"), asker, when, the question, Nectar's answer if any, **Add to library** and **Mark resolved** / Reopen.
   - **AI settings:** Nectar on for the agency, and per feature (Ask, Shift note help, PCSP reading, Summary drafts) with one line each. Writes require `agency_settings:edit`.
2. **Staff `/dashboard/ask-nectar`** (keep the route) → `components/nectar/staff/` with two tabs at the top of the page (no change to the staff bottom tabs):
   - **Ask:** intro line ("Nectar is an AI assistant. It answers from your agency's policies, the state contract and the plans of the people you support..."), chat, source chips (open the policy or plan read-only), thumbs, and a **Mark "<policy>" as reviewed** button in an answer that cites a policy they haven't reviewed.
   - **Policies (N):** every published policy meant for them with "Needs review · vN" or "Reviewed Oct 3 · vN"; opening one shows its sections and the **Mark as reviewed** button (or "You reviewed version N on <date>").
   - Replace `components/staff-mobile/ask-nectar-staff.tsx` and delete it.
3. Replace the old typed-signature page `routes/sign-policy.$documentId.tsx` with a redirect to the staff Policies tab for that document (or delete it if nothing links to it).
4. `routes/dashboard.tsx` (shared file; only these lines): the header search sends free-text questions to the right Ask (already does; confirm), and the admin Nectar nav item shows the open Questions count. Nothing else in that file.
5. Nectar on/off: when the agency turns Nectar or Ask off, both Ask screens show "Ask is turned off for your agency" and the nav items stay.

**Done when:** the click-through in the demo works on staging data: ask, cite, thumbs down → Questions, Add to library → draft, publish → staff sees "Needs review" → Mark as reviewed → admin Reviews updates; a policy set to one person is invisible to others and to their Nectar answers.

---

# LATER

## N7 — Hook up the rest (only after the Clients rebuild and Scheduler Part B are on `main`)

1. Index client documents uploaded on the client profile (PCSP, behavior support plan, HRC approvals, other plans) into `knowledge_sections` with `client_id`, readable only by people who can see that client. Read medications live from the rebuilt meds tables. A BSP is uploaded once, on the client profile.
2. Point `answerProceduralQuestion` (clock-out "ask a question") and the client-profile Nectar (`components/clients/nectar-ask.tsx` or its replacement) at `askNectar`; delete the old prompts.
3. Show policy reviews in Evidence as policy training (§1.8(4)(P)) and on the Team Members profile; no new upload, the review row is the record.
4. Move AI settings into Settings. Remove `/dashboard/nectar-docs` and its client link if the client rebuild replaced it.
5. Optional, only if Jeff asks: upload a whole policy manual and let Nectar suggest splitting it into policies by heading, each mapped to a required slot, for the admin to confirm.

## N8 — Removals (ONLY when Jeff says "Run N8", after N1–N7 are on `main` and checked)

Phase B migration. Before dropping each table, grep `src/` and `supabase/functions/` for its name; drop it only if no remaining code reads it, and list any kept table with the reader that keeps it. Candidates: `agency_policies`, `nectar_compliance_rules`, `nectar_compliance_rule_history`, `nectar_compliance_flags`, `nectar_rate_state`, `nectar_requirement_mappings`, `nectar_requirement_approval_events`, `nectar_attestations`, `nectar_draft_jobs`; export `nectar_requirements` to a storage CSV, then drop it; drop the `nectar_extracted_fields` rows created by Knowledge uploads (company/state owner) only. Regenerate types; grep each dropped name in `src/` → zero.

---

## Changelog

- Oct 12, 2026: first version.
