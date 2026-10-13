# Client Medications Rebuild — Runbook (M1–M5, then M6 after production)

Owner: Jeff (Dane Warnick). Live Supabase project: `dhrrukdcigiiqksibdfb`.
Plan of record: "Client Medications Rebuild Plan" (Claude Docs). Related plans: Documentation plan (Medications), Staff View Plan (F1, F3, S5).
Built-in medication list: `src/lib/medications/medication-reference.json` (already on this branch, 210 meds).

Result when done: the client's Health → Medications card has two tabs, **Medications** and **MAR**. Admins add and edit medications with one form that pulls suggestions from the built-in list. Doses are logged only through one staff **Give meds** component. The old eMAR module, its nine tabs and every page and table that only it used are gone.

---

## HOW TO RUN THIS (Claude Code, read first)

1. Read `CLAUDE.md` and obey it. Read this whole file once.
2. Work on branch `meds-rebuild` (it is cut from `clients-rebuild` because the new client profile lives there). `git fetch` and check it out, then merge the latest `origin/main` into it (the Clients rebuild, its cleanup and Security hardening Part H are on `main` by now; confirm that first and stop if not). Never merge `staging` into it.
3. Run **M1 → M5 in order**. Before each step, also give the subagent that step's lines from "AUDIT ADDITIONS" at the end of this file; they are part of the step and its Done when. **Do not run M6** until Jeff says M1–M5 are on production `main` (M6 drops columns and tables).
4. For each prompt: start a fresh subagent with the Standard Rules + that prompt only. It works on `meds-rebuild/mN-<name>` cut from the tip of `meds-rebuild`, and must pass before finishing:
   - `npm run build` (commit the regenerated `src/routeTree.gen.ts`)
   - `npx tsc --noEmit` with no new errors versus the start of the prompt (record both counts)
   - `npm run test:unit`
   - the prompt's own "Done when" list
   Skip e2e (Jeff's rule). Open a PR into `meds-rebuild`, titled `Meds rebuild MN: <name>`. Body: what changed, files added and deleted, migrations applied, test results, anything skipped. If every check passes, squash-merge it into `meds-rebuild` and continue. If a check fails twice after honest fixes, write `BLOCKED: <reason>` at the top of the PR body and stop.
5. The subagent returns only a ≤ 10-line report. Append it to `docs/meds-rebuild/PROGRESS.md` and commit. A new session reads PROGRESS.md and continues from the first prompt not marked merged.
6. After M5, open one PR `meds-rebuild` → `staging`. Never merge into `staging` or `main` yourself.

---

## STANDARD RULES (every prompt)

- Read CLAUDE.md first. Never read or write the `role` column. Never PostgREST-embed organization_members↔profiles.
- **Database:** every change is a migration file in `supabase/migrations/`, named for what it does, applied to live `dhrrukdcigiiqksibdfb`. M1–M5 are **additive only** (new tables, columns, functions, RLS that `main` still satisfies; relaxing a check constraint is fine). No drops, renames or type changes before M6. Regenerate `src/integrations/supabase/types.ts` after every migration.
- **No hard deletes** of medication records or doses (7-year Medicaid retention). Stopping a med sets `discontinued_at`; corrections to a dose are addenda.
- **Writes go through server functions** guarded by `assertCanManageClient` (`src/lib/clients/guards.server.ts`): `view_medical` to read, `edit_medical` to change medications. Staff dose logging goes through `logMedicationPass` (its own checks). No browser `supabase.from(...).insert/update/delete` on medication tables.
- **Remind, don't block** for compliance gaps (missing consent, missing HRC link, missed follow-up). Contract-required medication fields (below) are required to save.
- **Dose and times are never filled automatically.** The built-in list only suggests names, strengths and forms, uses, side effects, signs of a bad reaction, swallowing risk, psychotropic type and controlled schedule. Every suggestion is editable and labeled "Suggested from PI's medication list. Check it against the pharmacy label."
- **Files:** medication code lives in `src/lib/medications/` and `src/components/medications/`. Client-profile UI in `src/components/clients/profile/health/medications/`. Components ≤ 250 lines, lib files ≤ 300, routes ≤ 80. No barrel files (remove medication exports from `src/lib/clinical/index.ts` as their files go).
- **Delete what's unused in the same PR**: when something is replaced, delete the old file, function, route, test, type and nav link. Before finishing, grep every removed export and route path and confirm zero references remain. No commented-out code.
- **Tests:** every new or changed lib file gets a `*.test.ts` added to the `test:unit` list.
- **UI wording:** plain English, "client", no contract citations in the UI except the small "§1.23" hints named below.
- **Don't break** other consumers of medication data: client-specific training (`src/lib/clients/training.functions.ts`), care data (`src/lib/clients/care-data.functions.ts`), Ask Nectar (`nectar-staff.functions.ts`), agency health (`agency-health.functions.ts`), client import (`import-schema.ts`, `import-checklist.functions.ts`, `document-extraction.ts`), face sheet, incidents, progress summaries. Re-point them when fields change.

### Contract-required medication fields (DHHS91172 §1.23)

Required to save: name, strength or dose, route, when it's given (times, or as needed), what it's for, common side effects, signs of a bad reaction, swallowing or choking risk (yes/no), how they take it, packaging, prescriber, start date.
Each logged dose must store: actual time taken, med, route, PRN reason (if PRN), staff who observed or assisted.

---

## M1 — Repairs, data and rules (no new screens)

**Goal:** the database and server code can hold everything the new screens need, and today's dose bugs are fixed.

1. **Fix dose logging** in `src/lib/emar-pass.functions.ts`:
   - The duplicate check (~line 212) looks for `self_administered`, `given`, `loa`, but doses are stored as `administered` / `omitted`. Treat `administered` (and the old values) as taken so the same scheduled dose can't be charted twice.
   - Migration: drop the stale `emar_logs_status_check` constraint (keep `emar_logs_status_ck`, which allows every value in use). This only relaxes a rule, so it is safe for `main`.
2. **Migration: new columns on `client_medications`** (all nullable or defaulted):
   `strength text`, `dose_form text`, `how_taken text check in ('self','assist','nurse')`, `stop_reason text`, `paused_at timestamptz`, `pause_reason text`, `packaging_approval_path text`, `label_photo_path text`, `reference_key text` (which built-in entry it came from), `prn_min_hours numeric`, `prn_max_per_day int`, `prn_followup_minutes int default 60`, `prn_try_first text`, `prn_call_if text`, `is_psychotropic boolean not null default false`, `psychotropic_type text check in ('antipsychotic','antidepressant','mood stabilizer','anti-anxiety','stimulant','sleep','other')`, `used_for_behavior boolean not null default false`, `bsp_document_id uuid references client_documents(id)`, `hrc_restriction_id uuid references hrc_restriction_records(id)`, `consent_date date`, `consent_document_path text`, `next_review_date date`.
   Reuse existing columns, don't duplicate: `medication_name`, `dosage` (dose), `route`, `scheduled_times`, `frequency`, `instructions` (how to give it), `start_date`, `end_date`, `prescriber`, `pharmacy`, `rx_number`, `purpose` (what it's for), `side_effects` (common side effects), `adverse_effects` (signs of a bad reaction), `contributes_to_swallowing_difficulty`, `choking_risk`, `packaging`, `is_prn`, `prn_instructions` (when to give it), `is_rescue`, `is_controlled`, `controlled_schedule`, `pill_count_current`, `diagnosis` (what a psychotropic treats), `is_active`, `discontinued_at`, `discontinued_by`.
   Backfill `how_taken` from `support_level`: `self`, `staff_observed` → `self`; `staff_administered` → `assist`; `lpn`, `rn`, `delegated` → `nurse`; null → null.
3. **Migration: new columns on `emar_logs`:** `route text`, `prn_effect text check in ('helped','partly','no')`, `prn_followup_due_at timestamptz`, `prn_followup_at timestamptz`, `prn_followup_by uuid`, `prn_tried_first text`, `prescriber_notified boolean`, `client_request_id uuid unique` (offline retry safety).
4. **Migration: `incident_reports.emar_log_id uuid references emar_logs(id)`** so a medication error links to its dose.
5. **Migration: new tables**, org-scoped RLS, read = `can_access_client_phi(client_id)`, writes only through server functions:
   - `client_medication_changes` (id, organization_id, client_id, medication_id, changed_by, changed_at default now(), action check in ('add','edit','pause','resume','stop','send'), changes jsonb (field → {from, to}), reason text).
   - `medication_month_reviews` (id, organization_id, client_id, month date (first of month), reviewed_by, reviewed_at, notes, pdf_path, unique (client_id, month)).
6. **Migration: tighten reads** on `controlled_med_counts` and `medication_transfers` to `can_access_client_phi(client_id)`, and on `emar_log_addenda` to readers of the parent dose (exists on `emar_logs` with `can_access_client_phi`). They are agency-wide today.
7. **`src/lib/medications/med-rules.ts`** (pure): required-field check for the form (contract fields above; PRN adds when to give, min hours, max per day, follow-up minutes; controlled adds schedule and count on hand); psychotropic reminders (missing what it treats, consent, next review, BSP/HRC links when used for behavior) returned as warnings, not errors; `howTakenLabel()`; `prnCheck({lastDoses, minHours, maxPerDay, now})` → `{tooSoon, overMax, nextAllowedAt}`; `expectedDoses(med, day)` for the MAR. Tests for each.
8. **`src/lib/medications/reference.ts`**: loads `medication-reference.json`; `searchMedications(query, limit = 8)` matches the start of the generic name or any brand (case-insensitive), then contains-matches, generic names first; `getReference(key)`. Tests: "ser" returns Sertraline and Quetiapine (Seroquel); "kepp" returns Levetiracetam.
9. **`src/lib/medications/meds.functions.ts`** (server, guarded): `listClientMedications(clientId, {includeStopped})`, `saveMedication(input)` (add or edit; runs `med-rules` required check; writes a `client_medication_changes` row with the field diff; keeps `support_level` in sync from `how_taken` until M6 so `main` keeps working), `setMedicationStatus({id, action: 'pause'|'resume'|'stop', reason})`, `sendMedicationWithClient({id, to, quantity, receivedBy, note})` (writes `medication_transfers` + change row), `listMedicationChanges(medicationId)`. Use the service client only after the guard passes.

**Done when:** migrations applied and types regenerated; the duplicate-dose test passes; `med-rules`, `reference` and `meds.functions` have tests; no UI changed.

---

## M2 — Medications tab and form (admin)

**Goal:** the client's Medications card is the new card with the Medications tab working. The old eMAR module is deleted.

1. **Card** (`src/components/clients/profile/health/medications-card.tsx`, rewrite; split into `health/medications/`): header with allergies and swallowing risk as chips (from the Health row, read-only; edited in the Health cards), one line: "Staff support the person to take their own medications. Nurses give medications only under PM or PN codes.", and buttons **Add medication** and **Print medication list**. Two tabs: **Medications** and **MAR** (MAR fills in M3; until then show nothing but the tab label). The card spans both grid columns. Remove "Open eMAR board" and the Show/Hide toggle.
2. **Medications tab:** one card per active med, sorted by first time of day, PRNs last. Each shows name + strength/dose, when given ("8:00 AM, 8:00 PM" or "As needed"), what it's for (one line), "Watch for:" side effects (one line), badges (PRN, Rescue, Psychotropic, C-II…C-V, Swallowing risk, Not dose-packed), a small amber "Missing: consent" style reminder when `med-rules` returns warnings, and a menu: Edit, Pause, Stop, Send with client, History. "Show stopped medications (N)" lists stopped and paused meds with their reason. Users without `client_medical:edit` see the list read-only.
3. **Form** (sheet on desktop and phone), four parts; PRN, psychotropic and controlled parts appear only when ticked:
   - *The medication:* type-ahead name using `searchMedications` (shows generic, brands and class; free typing allowed). Picking one sets `reference_key` and suggests: strength (select from the entry's forms, or type), dose form, what it's for (chips from `uses`, pick one or type), common side effects, signs of a bad reaction, swallowing risk, psychotropic type, controlled schedule. Show "Suggested from PI's medication list. Check it against the pharmacy label." under suggested fields. Then dose, route, times (add time chips) or As needed, how to give it, start date, stop date, prescriber, pharmacy, Rx number, packaging (dose pack / original bottle; original requires an approval upload, small hint "§1.23(c)(1) needs written DSPD approval"), label photo upload (optional).
   - *Why and what to watch for:* what it's for, common side effects, signs of a bad reaction (the reference's `any_med_bad_reaction` line is shown under it as fixed text), swallowing or choking risk yes/no.
   - *How they take it:* Takes it on their own with staff watching · Staff help (prompt, open, hand it over) · Nurse gives it.
   - *PRN:* when to give it, what to try first, minimum hours between doses, max doses in 24 hours, check whether it worked after (minutes, default 60), call the nurse or prescriber if, Rescue medication (seizure or allergy) checkbox.
   - *Psychotropic:* type, what it treats (`diagnosis`), used to manage behavior? (if yes: pick the behavior support plan from the client's documents of type `bsp` or `behavior_support_plan` (same list as `plans/bsp-card.tsx`) and the rights restriction from `hrc_restriction_records`; if none exist show "No Human Rights Committee approval on file. Add it under Plans → Rights restrictions." and allow saving), consent date + upload, next prescriber review date.
   - *Controlled:* schedule II–V, count on hand now (`pill_count_current`).
   Uploads go to the private `client-documents` bucket under `medications/<client_id>/`. Save through `saveMedication`; show required-field errors inline.
4. **History:** a small sheet listing `client_medication_changes` for the med (who, when, what changed, reason).
5. **Print medication list:** one-page PDF with `pdf-lib` (agency name, client name, DOB, allergies, swallowing risk, and per active med: name, strength, dose, route, times, what it's for, watch for, how they take it, PRN rules, prescriber, start date; printed date and printed-by). For school, day program or the ER (§1.23(f)).
6. **Fill from a label (Nectar):** only if `src/lib/document-extraction.ts` can already read an image or PDF properly through Bedrock. If yes, add "Fill from label photo" in the form that fills fields as suggestions for review. If not, skip it and say so in the PR. The old "Upload MAR / Order" (it read PDFs as raw text) is deleted either way.
7. **Delete** (and every import, test, nav link and route reference):
   `src/components/workspace/mar-emar-tab.tsx`, `src/components/workspace/emar-chart.tsx`, `src/components/workspace/emar-ops-panel.tsx`, `src/components/workspace/emar-nectar-panel.tsx`, `src/components/medications-manager.tsx`, `src/lib/emar-nectar.functions.ts`, `src/lib/medications.functions.ts` (unless step 6 reuses part of it, moved into `src/lib/medications/`), `src/routes/dashboard.emar.tsx`, `src/routes/dashboard.admin.emar-audit.tsx`. From `src/lib/emar-pass.functions.ts` delete `setRefillStatus` and `logMedicationTransfer` (replaced by `sendMedicationWithClient`). Remove their exports from `src/lib/clinical/index.ts`. Re-point the link in `src/components/clients/profile/setup/health-answers.tsx` to the client's Health → Medications.
8. **Self-admin switch:** stop using `clients.self_admin_med_support` in the UI. Replace `medicationSupportLabel` in `src/lib/clients/health.ts` with a summary from the meds' `how_taken` ("Staff help with 3 · On their own with 1 · Nurse gives 0"). Remove the two self-admin fields from the editable list in `src/lib/clients/writes.ts`. Client import (`import-schema.ts`, `import-checklist.functions.ts`, `document-extraction.ts`): map support level per medication to `how_taken`, stop writing the client-level flag, map `scheduled_time`/`am_pm` into `scheduled_times`. The columns stay in the database until M6.

**Done when:** the Medications tab adds, edits, pauses, stops, sends and shows history; the type-ahead works from the built-in list; the deleted files are gone with zero references; `/dashboard/emar` and `/dashboard/admin/emar-audit` no longer exist.

---

## M3 — MAR tab, printout and monthly review

**Goal:** an admin can see any month's MAR, print exactly what an auditor needs, and sign off the month.

1. **`getMarMonth({clientId, month})`** (server, guarded `view_medical`) in `src/lib/medications/mar.functions.ts`, with the grid logic in a pure `src/lib/medications/mar-grid.ts` (tested):
   - meds active at any point in the month (`start_date`, `end_date`, `discontinued_at`, pauses from `client_medication_changes`);
   - expected scheduled doses per day from `scheduled_times` (paused days = held, before start or after stop = not due);
   - this month's `emar_logs`, addenda and controlled counts;
   - each cell: given (with actual time and staff initials), refused, missed (due, in the past, no log), held, not due; PRN rows: count per day;
   - summary: doses given / due, refused, missed, PRNs given, PRN follow-ups missing, errors, late entries (documented more than 60 minutes after the time taken).
2. **MAR tab UI:** month picker (opens on the current month), the summary line, the grid (one row per med and time, one column per day, sticky first column, horizontal scroll inside the card), a key. Clicking a cell opens the dose: actual time taken, time documented, route, staff full name, PRN reason, whether it helped and when checked, notes, controlled count, linked incident number, addenda. Admins with edit rights can **add a correction** (an addendum through `addEmarAddendum`; the original stays visible).
3. **Print / PDF** (`src/lib/medications/mar-pdf.ts` with `pdf-lib`, landscape, tested for content): every page shows agency, client name, DOB, Medicaid ID, month and allergies. Pages:
   - *Medication list:* name, strength, dose, route, times, what it's for, prescriber, start and stop dates, PRN rules, psychotropic and controlled flags, and changes made during the month.
   - *Grid:* each cell shows the staff initials and the actual time (e.g. "TJ 8:04a"), or a reason code (R refused, M missed, H held, NA not at home).
   - *Signature key:* every staff member who logged a dose that month: initials, full name, title.
   - *PRN log:* date, time, med, dose, reason, what was tried first, whether it helped, follow-up time, staff.
   - *Exceptions:* refused, missed and held doses with reasons; errors with incident numbers; late entries; corrections shown beside the original.
   - *Controlled counts:* each count with expected, counted and difference.
   - *Review:* reviewed by, date and signature line (filled when the month is signed off).
   This covers §1.23(b)(5) (time, med, PRN reason, route, staff name) plus what reviewers look for.
4. **Monthly review:** "Sign off this month" (needs `client_medical:edit`, only for past months or the current month after its last day). Saves `medication_month_reviews`, generates the PDF, stores it in the client's file (`client_documents`, type `mar_month`). The Documentation → Medications area (if it exists on this branch) lists unsigned months; otherwise skip that link.
5. **Delete** `src/components/hhs/hhs-mar-overview-calendar.tsx` and its tab in `src/routes/dashboard.hhs-hub.$clientId.tsx` (link to the client's Health → MAR instead). Delete `saveEmarLog` in `src/lib/hhs.functions.ts` and its `emar_logs` writes if nothing calls it; the HHS daily note keeps its current med block until M5.

**Done when:** any month renders; the PDF contains every page above; signing off stores the review and the PDF; deleted files have zero references.

---

## M4 — Staff see the medications (read-only)

**Goal:** staff assigned to a client can read every medication's details on their phone.

1. `src/lib/clients/care-data.functions.ts`: select the new fields (strength, dose_form, how_taken, purpose, side_effects, adverse_effects, swallowing flags, PRN fields, is_rescue, psychotropic fields, controlled flags, scheduled_times) for active, not paused meds; drop `self_admin_med_support*` and `scheduled_time` from what it returns.
2. One shared component `src/components/medications/meds-read-only-list.tsx` showing, per med: name and dose, when given, what it's for, how they take it, watch for, signs of a bad reaction (plus the any-med line), PRN rules (when to give, try first, min hours, max per day, call if), psychotropic type and what it treats (and "Behavior support plan" link when used for behavior), "Count required" for controlled, swallowing risk badge. Use it in the staff client views that show meds today (`src/routes/dashboard.shift.$shiftId.tsx` read-only list, `src/components/staff-mobile/client-quick-info-sheet.tsx`, and the staff workspace client page) and delete the old inline lists.
3. Client-specific training (`src/lib/clients/training.functions.ts`): its medication section adds route, what it's for, side effects and signs of a bad reaction, and marks PRN rules and psychotropic use. Don't change versioning.

**Done when:** a staff member assigned to the client sees the full list; a staff member not assigned sees nothing; the old inline med lists are deleted.

---

## M5 — One Give meds component for staff

**Goal:** one place logs every dose, on shift and in host homes, with PRN checks and follow-ups.

1. **`src/components/medications/give-meds/`**: Due now (scheduled doses not yet logged today, from `expectedDoses`) and As needed listed apart. Each dose: Given now or Not given (reason: refused, asleep, not home, held by nurse or prescriber, ran out, other). Route defaults from the med and can be changed. Shows what it's for and watch for under the name.
   - **PRN:** reason required; runs `prnCheck`. If too soon or over the daily max, show the warning with the next allowed time, ask for a reason to continue, and mark the dose as an exception (it appears in the MAR exceptions). Saves `prn_followup_due_at = given + prn_followup_minutes`.
   - **Did it help?** PRNs with a due follow-up show at the top: Helped / Partly / Didn't help + note; saves `prn_effect`, `prn_followup_at`, `prn_followup_by`. A PRN **psychotropic** also asks what was tried first and whether the nurse or prescriber was told.
   - **Controlled:** count before and after; writes `controlled_med_counts`; a mismatch flags it.
   - **Wrong or missed dose?** opens the incident form with category Medication error and `emar_log_id` set.
   - Offline: each pass carries a `client_request_id`; retries never create a second row.
2. **`logMedicationPass`**: accept and store route, PRN effect fields, tried first, prescriber told, client_request_id; set `actual_taken_at` to the time the staff member says it was taken (host homes included); keep the training and nurse-role checks; read `how_taken` instead of `support_level` (keep writing `support_level` for `main` until M6). Add `prn_followup_due` to `notifications_type_check` and notify the staff member when a follow-up is due (in-app only).
3. **Use it everywhere doses are logged:** the staff workspace MAR tab (`src/routes/dashboard.workspace.$clientId.tsx`), the clock-out check in `src/components/evv/punch-pad.tsx` (its "Meds" item opens Give meds; fix the link that used `?tab=mar-emar`; a follow-up still due shows as a reminder, not a block), and the HHS daily note in `src/routes/dashboard.hhs-hub.$clientId.tsx`.
4. **Delete:** `src/components/medications/staff-medications-panel.tsx`, `src/components/medications/daily-note-meds-block.tsx`, and `src/components/medications/shift-med-due-check.tsx` plus `src/hooks/use-shift-med-due-status.tsx` once the clock-out check uses Give meds' own due logic. Delete `logShiftChangeCount` from `emar-pass.functions.ts` if counts now only come from Give meds (keep it if the shift-change count screen still needs it, and say which). Remove their exports from `src/lib/clinical/index.ts`; if that file becomes empty of medication exports, keep only what other areas need.

**Done when:** one component logs doses in all three places; PRN timing warnings, follow-ups and controlled counts work; the duplicate-dose guard holds; deleted files have zero references.

---

## M6 — Phase B clean-up (ONLY after Jeff confirms M1–M5 are on production `main`)

**Goal:** remove the database pieces nothing uses any more.

Before each drop, grep `main` and this branch for the column, table or function name; drop only what has zero references. One migration per logical step:

1. **Drop table** `medication_change_proposals`, its trigger, and functions `apply_med_change_proposal` and `reject_med_change_proposal`.
2. **Drop** trigger `trg_autoenable_self_admin_on_med` and function `autoenable_self_admin_on_med`; drop columns `clients.self_admin_med_support` and `clients.self_admin_med_support_locked`.
3. **Drop `client_medications` columns** replaced by the rebuild: `am_pm`, `scheduled_time`, `support_level`, `support_explanation`, `support_level_needs_review`, `refill_status`, `refill_requested_at`, `refill_requested_by`, `refill_threshold`, `refill_date`, `pill_count_updated_at`. Remove the `support_level` sync from `saveMedication` and `logMedicationPass`.
4. **Lock signed doses:** replace the `emar_logs` policy "staff update own emar" so staff can't update a logged dose (corrections are addenda); admins keep the review flag update.
5. Regenerate types; delete this runbook's PROGRESS.md entries older than M6 if Jeff asks; keep RUNBOOK.md.

Tables kept on purpose: `client_medications`, `emar_logs`, `emar_log_addenda`, `controlled_med_counts`, `medication_transfers` (now "Send with client"), plus the new `client_medication_changes` and `medication_month_reviews`. `hhs_medical_logs` is appointments, not medications; leave it.

**Done when:** the drops are applied, types regenerated, build and unit tests pass, and no code references a dropped name.

---

## AUDIT ADDITIONS (Oct 13, 2026 security and data-integrity audit, confirmed on live)

**M1**
- **Only the right staff log doses, only for that client's meds.** The live `emar_logs` INSERT rule is just "agency member and staff_id = self", and `logMedicationPass` (`emar-pass.functions.ts` ~56–100) loads the med by id without checking it belongs to `clientId`. `logMedicationPass` checks the med's `client_id` = `clientId`, the med is active and not paused, and the caller can see the client (`can_access_client_phi`) or has a shift or host assignment for that client today. Tighten the `emar_logs`, `controlled_med_counts` and `emar_log_addenda` INSERT rules the same way.
- **Duplicate doses at the database level.** The live unique index `emar_logs_terminal_dedupe` covers `self_administered`, `refused`, `omitted`, `missed` but not `administered` (what the code saves). Add a second partial unique index on `(medication_id, scheduled_for)` where status is `administered` (confirm no duplicates first). Make `client_request_id` required on every new dose.
- **PRN races.** Check the PRN minimum interval and daily maximum inside one SQL function that locks the medication row (`SELECT … FOR UPDATE`) before inserting, so two fast taps or two staff can't both pass.
- **Staff can edit logged doses until M6.** Add a `BEFORE UPDATE` trigger now that refuses staff changes to a logged dose's time, status, route, medication, client and counts (admins keep the review flag; corrections are addenda). First grep what the current code updates on `emar_logs` and allow exactly that until M5 replaces it. M6 still removes the policy.
- **HHS meds path.** `saveEmarLog` (`hhs.functions.ts` ~103) skips the training, role, witness and attestation checks, accepts `staffName` from the browser and free-text meds with no `medicationId`, and its duplicate check misses `administered`. Make it call `logMedicationPass` (or remove it) now, not in M5; never accept a staff name from the browser.
- **Org-wide reads.** Query `pg_policies` on live for `emar_logs`, `emar_log_addenda`, `controlled_med_counts`, `medication_transfers` and `medication_change_proposals` and drop any SELECT rule that is only `is_org_member` before adding the PHI-scoped ones.

**M2**
- `parseMedicationsAI` (`medications.functions.ts` ~24) lets any signed-in user send text and images to Bedrock with no agency check. Guard any label or order reading with `assertCanManageClient(edit_medical)`, pass the agency to the rate limit, cap image size at 5 MB and text at 20,000 characters; delete it if nothing uses it.

**M3**
- **Corrections:** `addEmarAddendum` (~343) has no permission check. It requires `client_medical:edit`, or being the person who logged the dose within 24 hours; a reason is required; addenda are insert-only (no UPDATE or DELETE rule).
- **MAR PDF and monthly review:** generate the PDF on the server only, store it in the private client-documents bucket under `<orgId>/<clientId>/medications/`, readable only with `can_access_client_phi`, served by a short-lived signed link. Saving a `medication_month_reviews` row requires `client_medical:edit`; a signed month can't be changed (reopening is logged).

**M5**
- **Controlled substances:** the expected count is read on the server, never sent by the browser. The count goes down in one statement (`UPDATE … SET pill_count_current = pill_count_current - 1 … RETURNING`); a negative or mismatched count flags a discrepancy instead of being clamped to 0. The witness must be a different active member of the agency who confirms with their own sign-in or PIN (`witness_confirmed_at`), not just a chosen name.
- **Dose times:** reject an actual-taken time in the future or more than 24 hours back; the documented time is always the server's `now()`; more than 60 minutes after the due time marks it late (shows in the MAR exceptions).
- **Training check:** Give meds uses the scheduler's `qualificationsOnDate` (approved, unexpired training on that date) instead of `is_med_assist_current`; with no medication training set up for the agency, show admins "Set up medication training in Evidence" rather than treating everyone as trained.
- **Inventory:** the dose and its pill-count change save in the same SQL function, so one can't succeed without the other.
