# Clients Rebuild — Overnight Runbook (prompts 1–11) + Prompt 12 (morning)

Owner: Jeff (Dane Warnick). Repo: danewarnick-source/Provider-Interface. Live Supabase project: dhrrukdcigiiqksibdfb (NEVER refrpqrxpjeqmygxgekp).
Plan of record: "Clients Tab Simplification Plan" (Claude Docs). Clickable reference: "Clients Rebuild Demo" (canvas: Client list, Add a client, Client profile).

---

## HOW TO RUN THIS (read first, Claude Code)

You are running unattended overnight. Work through **Prompts 1 → 11 in order**. **Do not run Prompt 12** (it drops tables and runs only after Jeff reviews in the morning).

1. Read `CLAUDE.md` first and obey it. Then read this whole file once.
2. Integration branch `clients-rebuild`: if it exists on origin, check it out; otherwise create it from latest `main`. Make sure `docs/clients-rebuild/` on it holds this file (`RUNBOOK.md`) and the two reference files `pcsp-layout.ts` and `pcsp-parser.ts` (if Jeff attached them to this session, commit them there now). Push it.
   - Supabase: confirm you can apply migrations to live `dhrrukdcigiiqksibdfb` (Supabase MCP or CLI). If you can't, still write each migration file, mark it `NOT APPLIED` in the PR body, and continue only if the prompt's code doesn't depend on it; otherwise stop.
3. For each prompt N (1 → 11):
   a. Start a **fresh subagent** for the prompt (keep your own context small). Give it: the Standard Rules below + Prompt N, verbatim.
   b. It works on branch `clients-rebuild/pN-<short-name>` cut from the current tip of `clients-rebuild`.
   c. Before finishing, it must pass: `npm run build` (and commit the regenerated `src/routeTree.gen.ts`), `npx tsc --noEmit` with **no new errors vs. the start of the prompt** (record the count before and after), `npm run test:unit`, and the prompt's own "Done when" checks. Run the e2e configs named in the prompt if any.
   d. Open a PR `clients-rebuild/pN-…` → `clients-rebuild` titled `Clients rebuild PN: <name>`. The PR body lists: what changed, files added/deleted, line counts before → after for every touched file, migrations applied, test results, and anything skipped.
   e. If every check passes, **merge that PR into `clients-rebuild`** (squash) and continue to N+1.
   f. If a check fails and you can't fix it within the prompt's scope after two honest attempts: leave the PR open, write `BLOCKED: <reason>` at the top of its body, and **stop the run**. Do not start later prompts on top of a broken step.
4. After Prompt 11 (or a stop), open one PR `clients-rebuild` → `staging` titled `Clients rebuild (P1–P11)`. Body: a table of the 11 step PRs with status, total line count before → after for the client area, every migration applied to live, and a "Check in the morning" list (screens to click through on staging).
5. Never merge anything into `staging` or `main` yourself. Jeff merges in the morning.
5a. **Clean slate after every PR (context hygiene).** Treat each prompt as if the session was cleared:
   - Do all of a prompt's work inside its subagent. The subagent starts with only the Standard Rules + that prompt + the repo; it does not receive earlier prompts' conversations.
   - When the subagent finishes, it returns **only** a ≤ 10-line report: PR number and link, merged yes/no, checks passed, migrations applied, files added/deleted counts, anything blocked. Nothing else (no diffs, no logs).
   - You (the coordinator) keep only those short reports. Don't read diffs or big files yourself; if you need a fact, start a small subagent to look it up.
   - Before starting the next prompt, `git fetch` and start from the current tip of `clients-rebuild` so nothing from the last subagent's working state carries over.
   - Append each short report to `docs/clients-rebuild/PROGRESS.md` on `clients-rebuild` (commit it). If the run is interrupted or a new session picks it up, read PROGRESS.md and continue from the first prompt not marked merged.
6. Delete docs/clients-rebuild/pcsp-*.ts reference copies in Prompt 5 once the real files are in `src/lib/clients/pcsp/` (keep RUNBOOK.md until Prompt 12, which deletes it).

---

## STANDARD RULES (every prompt)

- Read CLAUDE.md first. Never read or write the `role` column. Never PostgREST-embed organization_members↔profiles (two queries, join in JS).
- **Database**: every change is a migration file in `supabase/migrations/` named for what it does, applied to live `dhrrukdcigiiqksibdfb`. Prompts 1–11 are **additive only** (new tables/columns, backfills, functions, RLS, constraints that main still satisfies). **No drops, renames or type changes** before Prompt 12 — the live DB is shared with production `main`. Regenerate `src/integrations/supabase/types.ts` from the live schema after any migration.
- **No hard deletes** of clients or client records anywhere (7-year Medicaid retention). Use `archived_at`/`ended_on`/status.
- **No PHI** in code, tests, fixtures, logs or PR text. Test fixtures use made-up people.
- **Organization**: client code lives in `src/lib/clients/` and `src/components/clients/` (subfolders below). No barrel `index.ts` files. Use `git mv` when moving so history is kept.
- **Size limits**: route files ≤ 80 lines, components ≤ 250, lib files ≤ 300. Split before merging if over. (Existing oversized files you don't touch are reported, not split.)
- **Delete what's unused**: when a prompt replaces something, delete the old file/function/component/route/test/type in the same PR. Before finishing, grep for every removed export and confirm zero imports remain. No commented-out code, no "legacy" copies, no unused props.
- **Writes go through server functions** that call `assertCanManageClient` (from Prompt 1). No direct browser `supabase.from(...).insert/update/delete` on client tables.
- **Dates**: date-only values (`YYYY-MM-DD`) are parsed as local dates via `src/lib/clients/dates.ts` (Prompt 1). Never `new Date("YYYY-MM-DD")`.
- **Tests**: every new or changed lib file gets a `*.test.ts` next to it, added to the `test:unit` list in package.json. Update e2e mocks (`e2e/helpers/mock-hive.ts` and fixtures) when routes or data shapes change.
- **Wording** in UI: "client", "team member", plain English, no SOW citations in UI text except small "§" hints the plan specifies.
- **Don't break** these consumers of client data (re-point them when data moves): EVV punch pad (`components/evv/punch-pad.tsx`), scheduler (`use-scheduler-data`, `scheduler.functions.ts`, `use-schedule-preview`), staff caseload (`hooks/use-caseload.tsx`, `routes/dashboard.shift.$shiftId.tsx`, `components/staff-mobile/client-quick-info-sheet.tsx`), billing/520 (`dashboard.billing.form520.tsx`), Utah EVV export, progress summaries, eMAR (`components/workspace/mar-emar-tab.tsx`), client-specific trainings, face sheet (`lib/client-face-sheet.functions.ts`), Nectar (`nectar-help.functions.ts`, `nectar-staff.functions.ts`), incidents, homes board.

---

## PROMPT 1 — Safety fixes (no redesign)

**Goal:** saves really save, people only do what their access allows, dates are right. Nothing looks different.

1. `src/lib/clients/guards.server.ts` — `assertCanManageClient({ supabase, actorId, organizationId, clientId?, action })`, modeled on `src/lib/team-members/guards.server.ts`. Actions → categories (via `requireCategory` in `src/lib/access/require.ts`):
   `view`→clients:view · `edit`/`create`/`discharge`/`import`→clients:edit · `view_medical`→client_medical:view · `edit_medical`→client_medical:edit · `edit_billing`→billing:edit · `edit_hrc`→hrc:edit · `edit_funds`→billing:edit · `edit_loans`→loans:edit.
   If the actor's scope isn't agency-wide, also require `access_can_see_client(_org, _client, _viewer)`. Always confirm the client belongs to `organizationId`. Unit tests for each rule.
2. `src/lib/clients/dates.ts` — `parseLocalDate`, `formatDate`, `ageOn`, `daysUntil`. Replace UTC parsing at: `components/clients/profile-tab.tsx` (age ~:664, PCSP warning ~:1322), `components/workspace/about-tab.tsx` (~:38), `hooks/use-client-budget.tsx` (~:50) and its use in `billing-codes-detail.tsx` (~:79–81), `components/clients/client-file-tab.tsx` `formatDue` (~:25). Test with TZ=America/Denver.
3. Silent saves: every client update must confirm a row changed (`.select('id')` and throw "You don't have permission to change this" if empty). Move the browser-side writes in `components/clients/profile-tab.tsx`, `routes/dashboard.clients.$clientId.tsx`, `routes/dashboard.clients.tsx` (add client), `components/clients/billing-codes-detail.tsx`, `components/clients/client-budget-panel.tsx`, `routes/dashboard.hrc.tsx`, `routes/dashboard.pba-ledger.tsx`, `routes/dashboard.billing.$clientId.tsx`, photo and face-sheet cards into server functions in `src/lib/clients/*.functions.ts` that call the guard. (Keep current UI; only the write path changes.)
4. Profile load: `routes/dashboard.clients.$clientId.tsx` (~:273) must filter by the current organization.
5. Page checks: add guards to `routes/dashboard.billing.$clientId.tsx` (billing:view), `routes/dashboard.client-training.$clientId.tsx` (clients:view or assigned staff), `routes/dashboard.workspace.$clientId.tsx` and `routes/dashboard.hhs-hub.$clientId.tsx` (assigned staff or clients:view), the Clients sidebar link and `routes/dashboard.hub.clients.tsx` (clients:view). PBA ledger: billing:view everywhere (hub tab and page). Smart Import in client mode: clients:edit (not staff records).
6. Hide the three cards whose tables don't exist on live (`client_healthcare_providers`, `rhs_hospitalization_days`, `rhs_evacuation_drills`): remove those cards and their dead functions (`lib/client-healthcare-providers.functions.ts`, `components/clients/healthcare-providers-card.tsx`, the RHS hospital/drill card code). Their replacements arrive in Prompts 3 and 8.
7. Smart Import: remove every use of the dropped `unfiled_items` table (`smart-import-commit.functions.ts` ~:1386, `smart-import-review.functions.ts` ~:79, ~:668). Undo-import: use `created_at` instead of the non-existent `clients.updated_at` (`smart-import-history.functions.ts` ~:137, ~:256).
8. Delete unused: `components/clients/field-state-line.tsx`, `components/clients/intake-progress.tsx`, `components/clients/index.ts`, the orphaned `routes/dashboard.client-billing-codes.tsx` (make it a 1-line redirect to the client profile's Billing tab), the duplicate "Import CSV" button on the list (keep one "Import").

**Done when:** a scoped manager without clients:edit gets a clear error instead of "Saved"; view-only users see no Edit buttons; `grep -rn "unfiled_items" src` and `grep -rn "new Date(\"" src/components/clients src/lib/clients` are empty; build/tsc/unit tests pass.

---

## PROMPT 2 — Move into folders (no visible change)

**Goal:** every client file in two folders with one job each. App behaves exactly the same.

1. Create `src/lib/clients/` and `src/components/clients/{list,add,profile,dialogs,shared}/`.
2. `git mv` (update all imports):
   - lib → `src/lib/clients/`: `client-file.ts`(+test, +`.functions.ts`) → `file.ts`/`file.functions.ts`; `client-profile-fields.ts` → `profile-fields.ts`; `client-care-data.functions.ts` → `care-data.functions.ts`; `client-face-sheet.functions.ts` → `face-sheet.functions.ts`; `client-belongings.functions.ts` → `belongings.functions.ts`; `client-billing-fix.functions.ts` → `billing-fix.functions.ts`; `client-features.ts` → `features.ts`; `client-hr.functions.ts` → `hrc.functions.ts`; `hrc-restrictions.ts` → `hrc.ts`; `client-lifecycle.functions.ts` → `lifecycle.functions.ts`; `client-readiness.functions.ts` → `readiness.functions.ts`; `client-staff-visibility(.functions).ts` → `staff-visibility(.functions).ts`; `custom-fields.functions.ts`, `custom-field-delete.ts`(+test) → `custom-fields*.ts`; `home-pin(.functions).ts` → `home-pin(.functions).ts`; `client-loans.functions.ts`, `client-loan-pdf.ts` → `loans*.ts`; `client-budget-pdf.ts`, `client-budget-report.ts` → `budget-*.ts`; `billing-budget-parse.functions.ts` → `budget-parse.functions.ts`; `client-import-schema.ts`, `client-import-template.ts` → `import-schema.ts`, `import-template.ts`; `pcsp-goals-for-staff.ts`(+test) → `goals-for-staff.ts`; `support-strategy-coverage.ts` → `strategy-coverage.ts`; `client-report-registry.ts`, `client-report-shared.ts` → `report-*.ts`; `client-form-obligations.ts`(+test) → `form-obligations.ts`; `client-specific-training.functions.ts` → `training.functions.ts`.
   - Do **not** move `client-sign-out.ts` (it's auth, not clients) or `pi-client-billing.ts` (pricing).
   - components → `list/`: list page parts from `routes/dashboard.clients.tsx`; `add/`: `finalize-client-editor`, `dspd-codes-multiselect`, `add-codes-control`; `profile/`: `profile-tab`, `client-file-tab`, `client-documents-card`, `belongings-inventory-card`, `billing-codes-detail`, `client-budget-panel`, `caseload-editor`, `custom-fields-panel`, `client-specific-training-card`, `home-pin-card`, `home-pin-map`, `client-photo-card`, `face-sheet-button`, `face-sheet-info-card`, `nectar-ask`, `code-assigned-staff`, `visibility-toggles`, `section-panel`; `dialogs/`: `document-preview-dialog`; `shared/`: anything used by more than one subfolder.
   - hooks: `use-client-billing-codes`, `use-client-budget`, `use-client-intake-progress` → `src/components/clients/shared/hooks/`.
3. Routes: keep `dashboard.clients.index.tsx` (list) and `dashboard.clients.$clientId.tsx` (profile) as the only real pages. Turn `clients.tsx`, `clients.index.tsx`, `clients.new.tsx`, `dashboard.clients.new.tsx`, `dashboard.client-file.tsx`, `dashboard.clients.rhs-board.tsx`, `dashboard.my-client-trainings.tsx` into ≤ 10-line redirects (or delete if nothing links to them — grep first, including e2e).
4. Delete anything left with zero importers after the move (run a repo-wide import check; list each deleted file in the PR).

**Done when:** no file under `src/lib/client-*` or `src/components/clients/*.tsx` (top level) remains except the ones excluded above; build/tsc/unit/e2e roster+1056 configs pass; screens look identical.

---

## PROMPT 3 — One source per fact

**Goal:** contacts, photo, staff must-knows, insurance and service codes each live in exactly one place; every screen reads that place.

1. Migration `…_clients_contacts.sql`: table `client_contacts` (id, organization_id, client_id, role text check in ('guardian','representative','emergency','support_coordinator','primary_doctor','specialist','prescriber','dentist','psychiatrist','neurologist','other_provider'), name, relationship, phone, email, address, company, notes, is_primary bool, sort, ended_on date, created_at, created_by). RLS like `client_emergency_contacts` (org-scoped; write = clients:edit via `access_has_category`). Backfill from `client_emergency_contacts` and the `clients` columns: guardian_*, emergency_contact_*, emergency_contact_2_*, support_coordinator_* (+company), primary_care_*/pcp_*, prescriber_*/med_prescriber_*, psychiatrist_*, neurologist_*, dentist_*, specialist_*, physician_address/dentist_address; `residential_provider`/`day_program_provider` and `client_external_services` → `other_provider`. Skip empty values; de-duplicate same name+phone.
2. Migration `…_clients_single_sources.sql` (additive): add `clients.insurance text`, `clients.about_me text`. Backfill `insurance` from medical_insurance/private_insurance/medicare_number; `about_me` from preferred_activities/preferred_living; `special_directions` ← append clinical_alert/pertinent_health_notes/dietary_needs where different; `client_photo_url` ← profile_photo_url where empty.
3. `src/lib/clients/contacts.functions.ts` (list/add/update/end) and `src/lib/clients/contacts.ts` (role labels, primary-contact pickers). Re-point readers: face sheet, staff quick-info sheet, `use-caseload`, shift page, incidents guardian notice, summaries (SC email), Nectar staff (contacts), eMAR (allergies stay on clients). Photo: every reader uses `client_photo_url` (+ `client_photo_taken_on`). Must-knows: every reader uses `special_directions` only.
4. Service codes: one source = `client_billing_codes` (active rows). Add `src/lib/clients/codes.ts` with `activeCodesForClient(s)`. Re-point every reader of `clients.job_code` / `clients.authorized_dspd_codes` (list, profile header, scheduler preview, Nectar help, eMAR, EVV export) to it. Stop writing those two columns anywhere (incl. the trigger that copies codes — replace the trigger with a no-op migration that leaves columns intact for main until Prompt 12).
5. Delete: the old contact editors/cards, `face-sheet-info-card` fields that duplicate contacts, any reader of the old contact/photo/alert columns, `client_external_services` UI on the profile (data now in contacts).

**Done when:** editing a contact on the profile shows on the face sheet PDF, staff quick-info and shift page; a grep for `emergency_contact_name|guardian_phone|support_coordinator_email|profile_photo_url|clinical_alert|job_code|authorized_dspd_codes` in `src/` returns only the type file and the Prompt 12 drop list comment; tests cover the backfill mapping (as a pure function) and `activeCodesForClient`.

---

## PROMPT 4 — Plan years, goals, supports, codes

**Goal:** PCSP data in the shape DSPD uses: plan year → goals → supports → codes paid to our agency. Staff see the supports for their code.

1. Migration `…_clients_plans_goals.sql`:
   - `client_plans` (id, organization_id, client_id, start_date, end_date, activated_on, meeting_date, status check in ('upcoming','current','ended','past'), document_id → client_documents, source text ('pcsp_upload'|'manual'|'migrated'), created_at/by). Unique current per client.
   - `client_goals` (id, organization_id, client_id, plan_id, carried_from_goal_id null → client_goals, goal_text, domain, current_status, strengths, barriers, success_person, success_team, sort, status check in ('active','ended'), ended_on).
   - `client_goal_supports` (id, organization_id, goal_id, support_text, details, start_date, end_date, our_codes text[], other_providers jsonb [{code,provider}], health_needs text[], sort).
   - RLS: read = clients:view or assigned staff (existing `access_can_see_client`); write = clients:edit.
   - Backfill: for each client create one `client_plans` row (source 'migrated') from pcsp dates/plan_year when present; goals from `client_specific_trainings.goals` JSON (preferred) else `clients.pcsp_goals`; each existing goal gets one support with `our_codes` = its job_codes (or the client's active codes if none).
2. `src/lib/clients/plans.ts` (pure: `currentPlan`, `planStatusOn(date)`, `waitingDays`, `supportsForCode(goals, code)`), `plans.functions.ts` (read/write), tests.
3. Re-point to supports-by-code: punch-pad goals tracker (show the client's supports whose `our_codes` include the shift's code, grouped under their goal), host-home daily log goals, Nectar staff answers (supports for the asker's code), Nectar note draft, progress summaries (group by goal → support for that code), client-specific training (goal list). Notes store `goal_id` + `support_id` (add nullable columns to the note tables additively).
4. Each note/summary uses the plan in effect on its date (`planStatusOn`).
5. Delete: all writers of `clients.pcsp_goals` (4 places listed in the plan), `goals-for-staff.ts` if fully replaced, the goals JSON editing in the training card (training now references `client_goals`).

**Done when:** a DSI shift shows only supports listing DSI; an HHS daily log shows HHS supports; unit tests cover `supportsForCode`, `planStatusOn` (incl. the gap after end date), and the backfill mapping.

---

## PROMPT 5 — PCSP reader + review + carry-over

**Goal:** upload a USTEPS PCSP → see the plan year, goals → supports → our codes, budget and flags → confirm. Plain code, no AI by default.

1. Add the tested reader (reference copies in `docs/clients-rebuild/pcsp-layout.ts` and `docs/clients-rebuild/pcsp-parser.ts`; place at `src/lib/clients/pcsp/layout.ts` and `src/lib/clients/pcsp/parser.ts`, split to ≤ 300 lines each: `parser-goals.ts`, `parser-tables.ts`, `parser-checks.ts`). It uses `unpdf` (already a dependency) server-side. Keep its behavior: header/footer stripping, overlapped-page detection keeping the readable top, goal-title stitching across pages, two-column health-needs, our-agency filtering by organization legal name, budget/purchased-services cross-check, risks, PLAN/EPT about-me rows, last year's goals with ongoing Y/N, issues list.
2. Fixture test with a **made-up** PCSP text layout (no PHI) covering: 2 goals, multi-page support, multiple supports per goal, other-agency providers, a missing purchased-service code, an "obsolete" line, an overlapped page. Assert exact output.
3. Nectar fallback only when a section doesn't match the expected layout: send that section's text, a fixed JSON schema, and require `{value, page, quote}` per field; blank if no quote. Off by default behind an org flag.
4. `src/lib/clients/pcsp/import.functions.ts`: `readPcsp(file)` → saves the PDF to `client_documents` (type 'pcsp') and returns the parse; `confirmPcsp(parseId, edits)` → creates the new `client_plans` row (status current; previous → ended/past), goals/supports, upserts `client_billing_codes` from **our** budget lines (code, unit type, start/end, rate, annual units), adds risks to `special_directions` (marked "From PCSP"), about-me rows to `about_me`, risk/behavior/nursing non-goal supports to contacts as other providers. Guard: clients:edit.
5. Goal carry-over: match new goals to the current plan's goals using the PCSP's "Annual Review for Goals" (ongoing Y) + text similarity; propose continuing/changed/new/ended; confirmed continuing goals set `carried_from_goal_id` so progress history continues.
6. UI: `components/clients/profile/plans/pcsp-review.tsx` (≤ 250 lines; split as needed) matching the demo's review panel: plan year, activation, counts, budget for us, goals compared with last year, "things to check" list with page numbers, editable fields, Confirm. "Upload new PCSP" button in Plans.
7. Delete: old goal extraction paths that this replaces (`Upload PCSP & extract goals (NECTAR)`, "Re-extract", their server functions) and the PCSP branch of `document-extraction.ts` if unused afterward.

**Done when:** fixture test passes exactly; uploading the fixture in the preview shows the review; confirming creates plan/goals/supports/authorizations; nothing is written before Confirm.

---

## PROMPT 6 — Client list + Add client

**Goal:** the list and add form from the demo.

1. `src/lib/clients/list.functions.ts`: one call returns rows with name, photo, codes (from `codes.ts`), home, worst units-left code (from authorizations + billed units), next due item (from `file.ts`/summaries/plans), assigned staff, readiness. Server-side search (name/Medicaid/PID), filters (code, home, staff, needs attention), views active/discharged/referrals. CSV export of the filtered list.
2. `components/clients/list/*`: page, toolbar (search, code chips, home select, Needs attention), table (desktop) + cards (phone), tabs Active/Discharged with a small "Referrals" link shown only if the org has referrals. Referrals reuse the existing referrals data — fold `components/referrals/referrals-page.tsx` into this view and delete what's duplicated.
3. `src/lib/clients/create.functions.ts` + `components/clients/add/*`: one-page form — first, last, birth date, Medicaid ID (duplicate check), DSPD PID, phone, service address (geocode → home pin), Support Coordinator (→ client_contacts), guardian or own guardian (→ contacts), service codes with start/end/units or "waiting on 1056", home, geofence radius. "Fill from PCSP" uses Prompt 5's reader to prefill and tags filled fields. Imported drafts open this same form prefilled.
4. Remove: the two-path draft/intake choice, `routes/dashboard.client-intake.$clientId.tsx` (redirect to profile), `routes/dashboard.clients.pending.tsx` (redirect to list; drafts show a "Finish setup" tag), `finalize-client-editor`, `client-intake-checklist-card`, `use-client-intake-progress`, "Refresh home pins" button (geocode on save), the hub tabs Teams & homes (move to Homes route) and Funds (moves to profile Money in Prompt 10; until then link to the existing PBA page).
5. Readiness: replace the per-row intake call with the list call's readiness field.

**Done when:** list loads in one request (verify in network tab via e2e mock); duplicate Medicaid ID blocks save with a link to the existing client; e2e roster/clients specs updated and passing.

---

## PROMPT 7 — Profile shell, Overview, Profile, Contacts

**Goal:** side-menu profile like Team Members, with the first three sections.

1. `components/clients/profile/profile-shell.tsx` (side menu; sections hidden when they don't apply or the viewer lacks access), `profile-header.tsx` (photo, name, status, codes, home, plan year, SC; ⋯ menu: Face sheet PDF, Update from a document, Discharge, Reactivate). Section in URL `?section=`.
2. `src/lib/clients/readiness.ts`: the one needs-attention calculation (units pacing, documents due/missing incl. photo > 5 yrs, PCSP waiting, strategies due, summaries due, HRC reviews, finish-setup items). Replaces `RecordCompletenessBar`, `IntakeChip`, `TrainingSetupBadge`, `client-readiness-card`, `setup-checklist(-groups)`, `finish-onboarding-card` — delete all of them.
3. Overview: needs-attention cards (click → section), units left per code with today's pace marker, must-knows, coming up, team (ready alone status), last notes.
4. Profile: identity (name, DOB/age, phone, Medicaid, PID, insurance, admitted, home), photo with date taken and 5-year warning, service address + pin + geofence + **extra service locations** (UI for `client_approved_locations`, which EVV already reads), mailing address, About me, More details (custom fields — one panel, only if fields exist).
5. Contacts: one list with role filters, own-guardian note, add/edit/end.
6. Delete the old 7-tab profile code paths these replace (`profile-tab.tsx` pieces, Identity/Care plan/Operations/Compliance tab containers, custom-fields panels on other tabs, "Action required" panel).

**Done when:** the profile matches the demo for these sections; each section file ≤ 250 lines; e2e smoke opens each section.

---

## PROMPT 8 — Health and Plans

1. Migration `…_clients_health_events_absences.sql`: `client_health_events` (date, type: exam/injury/surgery/immunization/health_change/hospital, notes, document_id) and `client_absences` (from, to, reason: hospital/vacation/other, notes). RLS: client_medical view/edit.
2. Health section: must-knows, allergies, diagnoses, chronic conditions, swallowing (dysphagia + alerts), advance directive (dnr_status options None/DNR/POLST + location + notes — fold polst/palliative/hospice into this card), emergency treatment authorization, medication support level, medications link (eMAR), health events log, absences (RHS only).
3. Plans section: plan years (current/past/ended-waiting with day count; reminders at 60/30 days before end; on day 10 of waiting create a task for the office), support strategies (due = current plan `activated_on` + 30 days), goals → supports tree with "View as" code filter, progress summaries for **every** code that owes one (fix `src/lib/progress-summaries.ts` list to the cadence rules in CLAUDE.md), HRC restrictions (single editor; `/dashboard/hrc` links here), BSP upload only for BC1–3 clients.
4. Client file rules (`src/lib/clients/file.ts`): photo expires at 5 years from `client_photo_taken_on`; medical/dental exams only for RHS, PPS, HHS, SLH; belongings for HHS, PPS, RHS, SLH with no yearly renewal.
5. Delete the replaced health/plan cards and the RHS hospital/drill remnants.

**Done when:** unit tests for summary cadence per code, strategy due date, plan waiting days, file rules.

---

## PROMPT 9 — Services & billing + Client file

1. Services & billing: authorizations (code, unit type, rate, start/end, annual units, 1056 number + approved date — add columns to `client_billing_codes` additively), units used vs. left per code with pace, budget, rate history. "Remove" becomes **End** (sets end date).
2. "Fill from 1056": upgrade `budget-parse.functions.ts` to return `{value, page, quote}` per field, validate codes against the agency's approved codes, dates and whole-number units, and show the same review pattern as the PCSP before saving.
3. Client file: every required document with status/due/expiry (`client_documents.expires_on` added), upload/replace/archive (no delete), belongings inventory.
4. Delete the old billing tab containers and the "Reclaim as ours" banner if unused.

---

## PROMPT 10 — Team, Money, Activity & notes

1. Migration `…_clients_staff_exclusions_notes.sql`: `client_staff_exclusions` (client_id, staff_user_id, reason, created_by) and `client_notes` (office-only notes). RLS: clients:edit to write; notes readable by clients:edit holders only.
2. Team: assigned staff and codes (existing `staff_assignments`, single write path), ready to work alone per staff member (shared with Team Members readiness), person-specific training setup, **do-not-schedule staff** — the scheduler (`scheduler.functions.ts` conflict/assign paths) refuses to place an excluded staff member and says why.
3. Money (only for clients with PBA, or loans, or spending): PBA ledger (move from `routes/dashboard.pba-ledger.tsx` into the section; page becomes a redirect), loans (`loans.functions.ts`), spending log.
4. Activity & notes: shifts, daily notes, incidents (each row opens its record), office notes.
5. Delete the moved pages' duplicate UI and the hub Funds tab.

---

## PROMPT 11 — Discharge

1. Migration `…_clients_discharges.sql`: `client_discharges` (client_id, discharge_date, reason, initiated_by 'agency'|'person'|'dspd', notice_date, summary_document_id, summary_sent_on, created_by).
2. `discharge.functions.ts`: guided flow — date, reason, who started it, notice date (if agency-initiated, warn when < 30 days before discharge), summary (Nectar may draft from existing data; human confirms), then: end active authorizations, end staff assignments, cancel future shifts, set status discharged. Track the 7-day summary clock. Reactivate reverses status (not history).
3. Discharged clients are read-only in the profile.

---

## PROMPT 12 — Cleanup (MORNING ONLY, after P1–P11 are merged to `main` and checked)

Phase B drops, applied to live only after the rebuild is on production:
1. Drop tables: `client_meals`, `client_meal_support`, `client_nutrition_config`, `client_recipes`, `client_recipe_ingredients`, `client_shopping_items`, `client_meal_plans`, `client_meal_actuals`, `client_intake_completion`, `client_emergency_contacts`. Confirm each has 0 rows or was fully copied (compare counts) first.
2. Drop `clients` columns marked Merge/Move/Cut in the plan doc (contacts, providers, insurance trio, codes pair, pcsp_goals, pcsp dates/plan_year, physical description, the sensitive/unused list, meal/shopping, hhs_monthly_support_hours, rights_restrictions, hr_applicable, court_orders, grievance_*, personal_belongings_inventory, bsp_status, roommates, housing_voucher, residential_provider, day_program_provider, immunizations, staff_ratio after copying to client_ratios, profile_photo_url, clinical_alert, pertinent_health_notes, dietary_needs, polst/palliative/hospice/dnr_applicable, intake_date, level_of_need, disability_category after confirming no reader).
3. Drop the code-copy trigger/function and any functions only they used.
4. Regenerate types; run `npx knip` (no install needed) and delete every unused file/export it reports in the client area; grep for each dropped column name in `src/` → zero.
5. Delete `docs/clients-rebuild/`.
6. PR body: rows/columns removed, final client-area line count vs. the 21,700 starting point.

---

## KICKOFF MESSAGE (paste into Claude Code)

> (If you attached the three files instead of pushing them: "Create branch `clients-rebuild` from latest main, save the attached files to `docs/clients-rebuild/` (the runbook as `RUNBOOK.md`), commit and push. Then…")
>
> Read `docs/clients-rebuild/RUNBOOK.md` on branch `clients-rebuild` and execute it exactly as written: Prompts 1–11, one subagent and one PR per prompt into the `clients-rebuild` integration branch, merging each only when every check passes, stopping on a blocker. Do not run Prompt 12. When done, open the `clients-rebuild` → `staging` PR with the summary table. I'm asleep; don't wait for me.
