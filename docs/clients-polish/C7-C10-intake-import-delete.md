# Clients polish — round 2: C7 to C10

Read `00-START-HERE.md` first. Run after C6. Use C1's `SectionCard`, `InfoTile`, `FieldGrid`, `StatusTag`, `EmptyState` and button rules.

## C7 — Remove Smart Import; one way to add clients; simple templates

Jeff tested Smart Import with a made-up 15-client export: it didn't find the header row, made 18 "clients" (the title line and the header row became clients), put the title text in Full Name, and found no medications or goals. It's also where the inconsistent PCSP results came from (it sends PCSPs to Nectar), and it named a draft after its file ("PCSP rewrite"). It's ~15,600 lines in 26 files. Jeff decided to remove it, along with timesheet and daily note imports.

**Keep:** "Fill from PCSP" (`readPcspForNewClient` → `readPcspPdf` → `prefillFromPcsp`) and the Plans PCSP upload. They use the plain-code reader in `src/lib/clients/pcsp/` and don't depend on Smart Import.

1. **Remove completely** (code, routes, links, menu items, types, e2e references so it still type-checks):
   - `src/routes/dashboard.smart-import*.tsx`, `src/components/smart-import/` (including `timesheets/` and `daily-notes/`) and every `src/lib/smart-import*.ts`.
   - The Clients page "Import" button (`clients-page.tsx` ~line 101) and `src/lib/clients/import-template.ts`.
   - Imported-draft handling: `loadImportDraft`, the `finishImportDraft` use in `create.functions.ts`, `formFromDraftValues`, `loadDrafts` and the "Finish setup" draft rows in the Clients list.
   - The cron hook `src/routes/api/public/hooks/smart-import-reminders.ts` and its schedule entry.
   - The Smart Import parts of `dashboard.billing.imports.tsx` and `dashboard.hive-exec.company-migration.tsx` (remove the page if nothing else is left on it).
   - `document-extraction.ts` is also used by Nectar documents, knowledge and compliance docs (`nectar-documents.functions.ts`, `documents/index.ts`, `client-documents-card.tsx`): delete only what nothing else uses afterwards, such as its PCSP branch. Don't break those features.
   - Grep afterwards for `smart-import`, `smartImport`, `import_subjects`, `extracted_fields`, `finishImportDraft`: only types and the database remain.
   - **Database:** additive only. Leave the import tables and rows; one migration sets `discarded_at = now()` on open client drafts so nothing references them. The tables are dropped later in a removal step.
2. **One way to add a client:** the Clients page has one "Add client" button. Its first screen asks **"Start from their PCSP"** (Fill from PCSP, C8) or **"Enter by hand"**, plus a smaller link **"Import several clients from a spreadsheet"** (below).
3. **Client spreadsheet import (new, no AI):** build it like the existing team member import (`components/team-members/add/import-members-dialog.tsx`, `lib/team-members/import.ts`; reuse its shared pieces, move them to a shared folder if both need them). Download template (Excel and CSV, one made-up example row and a "how to fill this in" note) → upload → review every row (editable, removable, problems shown per cell, duplicate Medicaid IDs flagged against existing clients and within the file) → one save, the same server function and writes as Add client. **Columns are only the Add client first step:** First name, Last name, Date of birth, Medicaid ID, DSPD PID, Phone, Address, Start date, Home, Own guardian (Y/N), Guardian name, Guardian relationship, Guardian phone, Guardian email, Support coordinator name, Support coordinator phone, Support coordinator email, Support coordinator agency, Service codes (separated by ";"). Code dates and units come later (PCSP or by hand). Each imported client lands with "Finish setting up" (C9).
4. **Team member import:** keep it as is; check its template columns still match the Add team member form exactly (first name, last name, email, phone, hire date, position, access, home, supervisor, date of birth, worker type, transports clients) and fix any drift.

**Done when:** the greps above come back clean; Add client offers PCSP / by hand / spreadsheet; the client template round-trips (download → fill → upload → review → save) with unit tests for parsing, Y/N, dates in common formats, code lists and duplicate detection; the Nectar documents and knowledge pages still build; build/tsc/unit pass vs. baseline.

---

## C8 — Fill from PCSP fills the whole profile, the same way every time

1. **Everything the PCSP holds is filled in when the client is created from it** (and when a PCSP is uploaded later in Plans), through the existing PCSP review and confirm path (`src/lib/clients/pcsp/confirm-write.ts`), never a second writer:
   - **Profile:** name, PID, phone, address, date of birth if present.
   - **Contacts:** support coordinator and other providers.
   - **Plans:** the plan year (effective dates, activation and meeting dates), goals, supports and support details.
   - **Services & billing:** each agency code with start and end dates, annual units and rate from the purchased services / budget.
   - **About:** starts the Nectar "About <first name>" draft from C3 for a person to approve (never saved without approval).
   For a new client, Add client's PCSP path runs the same review screen after the core fields, then creates the client and confirms the plan in one save, so nothing has to be entered twice.
2. **The PCSP is filed the moment it's used:** saved to the Client file as the client's current PCSP (the Evidence "Current PCSP on file" row from C5), dated with the plan year. No second upload.
3. **A result that stays on screen** after every read: "Filled from the PCSP: name, PID, support coordinator, plan year Sep 1, 2026 – Aug 31, 2027, 4 goals, 3 codes with units (SLH, DSI, HHS)". On failure, the exact reason and "Try again" ("Couldn't read the PCSP: the server took too long. Try again."). If no codes are found, why: "No purchased services for <agency legal name> were found. Check the agency's legal name in Settings matches the PCSP."
4. **Find why it took four tries for Jeff.** That path has no randomness when the Nectar fallback is off. Check: the server function time limit for large PDFs (raise it or read pages in a worker), the error only showing as a brief toast, the agency Nectar fallback setting, and the provider-name match that decides which codes are "ours" (`readPcspPdf` uses `organizations.legal_name || name`; match case-insensitively and ignore punctuation and "LLC/Inc"). Fix what you find and describe it in the PR.
5. **Log every read** (no PHI): organization, time, page count, goals found, codes found, duration, error if any.
6. **Test:** reading the fixture twice gives identical results; the provider-name match handles case, punctuation and LLC.

**Done when:** creating a client from the fixture PCSP fills profile, contacts, plan year, goals, supports and codes with units in one save, and the PCSP is in the Client file; the summary shows; build/tsc/unit pass vs. baseline.

---

## C9 — Optional full setup, and only show what applies

1. **Rename "Admitted" to "Start date"** everywhere (profile, list, add client, templates, exports, face sheet). Change the label only; keep the column.
2. **After the core fields, a choice:** "Finish setting up <first name> now" or "Later". Later leaves a "Finish setting up" banner on the profile that reopens the same steps. Every step is optional, can be skipped, and saves as it goes.
3. **The setup steps** (short questions, mostly yes/no, each writing to the same place the profile edits):
   - **About:** date of birth, insurance, start date; "Add a photo?" with "Upload photo" or "Person prefers no photo" (marks the photo row Not needed, C5); About from the PCSP (C3/C8).
   - **Contacts:** guardian, support coordinator, others; "Anyone else we should know about?"
   - **Health:** "Any allergies?" (yes → which), "Any diagnoses or ongoing conditions?" (yes → add), "Special diet or eating needs?" (includes swallowing; move the separate Swallowing card into Diet), "Advance directive or DNR?" (yes → upload; it must then be on file), "Does your agency help with medications?" (yes → set up the eMAR or upload a MAR sheet; no → medications hidden), "Does your agency help with doctor visits?" (no → health events and appointments hidden; family handles them).
   - **Team:** pick the team members who will work with them and on which codes.
   - **Behavior:** "Do they have a behavior support plan?" (yes → upload the BSP).
   - **Client file:** choose the Evidence packs (C5), pre-checked from their codes.
   - Finish with a summary of what's set up and what was skipped, each skipped item linking to where to add it later.
4. **Hide what doesn't apply.** Store the answers per client (additive table, e.g. `client_support_scope`: client_id, helps_with_medications, helps_with_appointments, has_advance_directive, has_bsp, no_photo, answered_by, answered_at). Cards and sections marked "doesn't apply" are hidden, not shown empty. A small "Show hidden sections (3)" link at the bottom of the section lets an admin turn one back on. Hidden items never count in Needs attention.
5. Clients created by the spreadsheet import (C7) and from a PCSP land on the same "Finish setting up" banner.

**Done when:** the setup can be done end to end or skipped and resumed; answers hide and show the right cards; "Admitted" no longer appears anywhere in the UI (grep); unit tests cover which cards show for each answer combination; build/tsc/unit pass vs. baseline.

---

## C10 — Delete a client or team member (made by mistake), keeping the data

Mistakes happen (a client created twice, a test person). Admins need Delete for both clients and team members, with explicit permission and a warning, without breaking the 7-year Medicaid retention rule.

1. **Delete hides, it never erases.** Additive columns `deleted_at`, `deleted_by`, `delete_reason` on `clients` and on the team member record (`organization_members`). A deleted person disappears from every list, search, picker, schedule, count, report and export. Add the filter in the shared loaders and grep every read of those tables; list them in the PR. Nothing is removed from the database.
2. **Only for records made by mistake:** Delete is offered only when the person has no service history: no shifts, punches, notes, daily logs, billing rows, signed documents or summaries. Otherwise the dialog says "<Name> has service records, so they can't be deleted. Use Discharge to end services; their records stay on file." (End employment for team members).
3. **Permission:** owners by default; owners can give others a new "Delete people" permission, added the way categories are defined in `src/lib/access/categories.ts`. Checked on the server.
4. **One shared dialog and server function** for both: says what happens in plain words, requires a reason (chips "Created by mistake", "Duplicate", Other) and typing the person's full name to confirm. It lives in the ⋯ menu of each profile, never as a big button.
5. **Recently deleted:** a list in Settings (owners) with who deleted whom, when and why, and **Restore**.
6. **Close the known pre-launch gap:** the MCP tool in `src/lib/mcp/` (`table_write`) can still hard-delete any table. Remove its delete operation (or limit it to the tables that are safe), so no path in PI hard-deletes records.

**Done when:** a person with no history can be deleted and restored; a person with history can't, and is pointed to Discharge or End employment; deleted people don't appear in lists, pickers or schedules; non-owners without the permission get refused on the server; `table_write` can't delete; unit tests cover the history check and the permission; build/tsc/unit pass vs. baseline.
