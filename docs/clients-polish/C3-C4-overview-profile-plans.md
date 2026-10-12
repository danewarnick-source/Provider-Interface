# Clients polish — C3 and C4

Read `00-START-HERE.md` first. Use C1's `SectionCard`, `InfoTile`, `FieldGrid`, `StatusTag`, `EmptyState` and button rules everywhere below.

## C3 — Overview and Profile sections

### Overview (`src/components/clients/profile/overview/`, `src/lib/clients/overview*.ts`)

1. **Needs attention is collapsed by default.** Replace the always-open list of cards with one button at the top: "Needs attention (N)", danger tone if any item is a block, amber if only warnings, hidden when N = 0. Tapping it expands the existing items; tapping again collapses. Remember open/closed per viewer in the browser only (wrapped in try/catch). Keep `attention-cards.tsx` ≤ 250 lines.
2. **Layout:** Must-knows full width (lead card), then Units left | Coming up, then Team | Last notes, each a `SectionCard` with a one-line description ("Units left: how much of each authorization is used, and the pace").
3. **Coming up** only includes shifts that are published and not cancelled (`published = true`, `status <> 'cancelled'`) in `loadUpcomingShifts` (`overview-load.ts`). Each row: date, what it is, and a link to the section ("SLH with <name> · Tue Oct 8, 9:00").
4. **Last notes** shows who wrote each note: the punch's staff for shift notes, the log's author for daily logs (two queries joined in JS; no members↔profiles embed). Each note: author, date, code, the 240-character preview, and "Open in Activity".
5. Update `overview.test.ts` and `overview-load.test.ts`.

### Profile section (`src/components/clients/profile/details/`)

1. **Layout** (fixes the empty gap): "About <first name>" full width at the top; then **Identity | Service address** side by side at equal height; then **More details** full width. Identity uses `FieldGrid` (date of birth, Medicaid ID masked, DSPD PID, own guardian, language, admitted). The photo moves into the header (C1); delete the separate photo card from this section if nothing else uses it.

2. **About <first name>: a Nectar summary of who the person is.** Today, confirming a PCSP appends the PCSP's "action plan" rows to `clients.about_me` as one text block (`aboutMeLines` / `mergePcspBlock` in `src/lib/clients/pcsp/confirm-plan.ts`), which reads as copied questions ("Where can I learn or improve my employment skills: …").
   1. **Stop copying action-plan rows into About me.** Remove `aboutMeLines` / `mergePcspBlock` from the PCSP confirm path and delete what only they used. Backfill: remove existing "From PCSP …" blocks from `clients.about_me`, keeping any hand-written text. (That backfill updates rows; it deletes nothing.)
   2. **"Draft with Nectar"** on the card reads every client document with readable text: the current PCSP (including its action plan), the BSP, a face sheet, and any other upload in the Client file. It writes about 8–10 short bullets, only where the documents say so, covering: who they are and what matters to them; likes and dislikes; a typical day and routines; people important to them; how they communicate; what helps them have a good day and what upsets them. **Leave out** medications, diagnoses, medical history and incident details.
   3. **Nothing made up.** Only facts in the documents, in plain everyday words ("Loves running and spending time with friends and his bunny."). Each bullet carries its source document and page. Check in code that every bullet's source exists in the client's files and drop any that don't. If the documents say little, write fewer bullets; never pad. Scanned documents with no readable text are skipped, and the card lists them.
   4. **A person approves it.** The draft opens in an editor with each bullet's source in small grey text; saving needs "Approve", which records who and when. Nectar never saves on its own.
   5. **Storage (additive):** table `client_about_me` (organization_id, client_id unique, items jsonb `[{ text, source_doc_id, source_page }]`, drafted_by_nectar bool, approved_by, approved_at, based_on_doc_ids uuid[]), RLS like the other client tables. `clients.about_me` stays as the agency's own notes, shown under the bullets as "Added by the agency".
   6. **Display:** title "About <first name>", description "Who they are, in plain words. Read this before your first shift." Bullets in two columns on wide screens, one on phones, with clear spacing and a bold lead word or two where natural ("**Loves** running and…"). Footer: "Summary from PCSP, BSP, face sheet · Approved Oct 6, 2026 by <name>". Primary button "Draft with Nectar" (or "Refresh with Nectar" once one exists). Staff see it read-only.
   7. **Keep it current, without surprises:** when a new PCSP, BSP or face sheet is uploaded after approval, the card shows "New documents since this summary. Refresh with Nectar?" Nothing changes until someone refreshes and approves.

3. **Service address: say whether EVV applies.** The punch pad only enforces the clock-in circle for EVV codes (`isEvvLockedCode`; per SOW §1.12: COM, HSQ, PAC, RP2, RP3, SLH, SLN, CMP, CMS), but the section tells everyone "Staff clock in within the circle around the pin" and readiness flags "No home pin" for every client.
   - Has an active EVV code: `StatusTag` ok tone **"EVV required: SLH"** (list the codes) + "Staff on SLH must clock in inside the circle. These visits must meet the state's EVV rules."
   - No EVV code: neutral tag **"No EVV codes"** + "This client's services don't use EVV. The pin is optional; it's used for directions and as a record of where staff clocked in."
   - Use `isEvvLockedCode`; don't make a new list.
   - **Readiness:** "No home pin" counts only for clients with an active EVV code (`listReadiness` in `src/lib/clients/list.ts`, `clientAttention` in `readiness.ts`). Same tag on the extra service locations card.

4. **More details** (custom fields) as small muted tiles in a grid, with the agency's own About text below.

**Done when:** Overview and Profile match the layout above with no empty gaps; Needs attention is collapsed; Coming up hides cancelled and unpublished shifts; Last notes shows authors; About is the approved Nectar summary with sources checked; EVV wording follows the client's codes; readiness tests cover EVV client without pin = not ready, non-EVV client without pin = ready; build/tsc/unit pass vs. baseline.

---

## C4 — Plans section and the PCSP review

Layout of the Plans section, top to bottom, each a `SectionCard`: **Plan years** (lead) → **Goals and supports** → **Support strategies** → **Progress summaries** → **Human rights restrictions** / BSP. Each card's description says what it is.

### 1. Plan years card (`plans/plan-years-card.tsx`): the PCSP sets the dates

Confirming a PCSP already creates the plan year from its "Effective Start Date" and "Effective End Date" (`src/lib/clients/pcsp/confirm-write.ts`), but the card's main button is "Add plan year" (typing dates by hand).

1. **Primary button: "Upload PCSP"**, opening the same PCSP upload and review used in `plan-goals-panel.tsx` (reuse; don't build a second one). Hand entry becomes a small link at the bottom: "No PCSP? Enter plan dates by hand." Keep the pencil on each row for corrections.
2. **Wording** (every message has the button that fixes it):

| When | Today | New |
| --- | --- | --- |
| 60 or 30 days before the plan year ends | "The plan year ends in N days (date). Schedule the PCSP meeting." | "PCSP expires in N days (Nov 5). Schedule the PCSP meeting with the support coordinator." |
| Plan year ended, no new PCSP | "Waiting N days for the new PCSP." | **"PCSP is N days overdue. Upload the new PCSP"** + Upload PCSP button |
| Same, 10+ days overdue | "… Office: follow up with the support coordinator." | "PCSP is N days overdue. Upload it, or contact the support coordinator if you don't have it yet." + Upload PCSP button |
| Badge on an ended plan year | "Ended — waiting N days" | "Expired N days ago" |
| No plan year | "No plan year on file yet — upload the PCSP or add one." | "No PCSP on file." + Upload PCSP button |

3. Use the identical wording in the Overview's Needs attention items, the header's Plan year tile (C1) and the list's Next due cell (`readiness.ts`, `plan-dates.ts`).
4. After a new PCSP is confirmed, if any of the client's codes have no authorization covering today, show "Next: add the new 1056 for <codes>" linking to Services & billing.

### 2. PCSP review screen (`src/lib/clients/pcsp/`, `plans/pcsp-review*.tsx`)

The checks come from the plain-code PCSP reader, not Nectar.

1. **"Now obsolete" lines:** USTEPS prints a "now obsolete" line on the Purchased Services and Plan Budget pages of every PCSP, so `parser-tables.ts` warns on every upload (~lines 66 and 93). Drop both warnings for those standard lines. Warn only when the line names a specific code: "The PCSP says RP4 is obsolete. Check whether this client still has RP4." Update `fixture/sample-expected.json`.
2. **False "purchased service listed without its code":** on Jeff's real upload every service had its code, but the error still showed. The reader starts a code-less entry whenever a "Type:" line appears and the current service already has a type, which happens when a service continues onto the next page or the heading isn't matched by `^([A-Z][A-Z0-9]{1,3})\s{2,}…`. Make a continuation never become a code-less service; raise the error only when a code-less entry's units and dates belong to no coded service. Add fixture cases: a service continuing across a page break, and a code and name separated by one space or a dash.
3. **Page printed on top of itself** (`parser.ts`): "Page N didn't print cleanly in this PDF, so part of it couldn't be read. Open page N of the PCSP and check that the goals and supports from that page are listed below." Whole page skipped: "Page N couldn't be read at all. Open page N of the PCSP and add anything from it by hand."
4. **Two choices instead of Continuing / Changed / New** (`pcsp-review-goals.tsx`): **"Carried over from last year"** (keeps progress history; shows "Last year: <wording>" in small grey text only when it differs) and **"New goal"**. Keep `CarryKind` only if other code needs it.
5. **Supports clearly labeled**, in the review and in the Plans goal tree (`goal-tree.tsx`):
   - **Support:** <support text> + its code badges
   - **Support details:** <details> (or "None listed")
6. The review screen uses the C1 card and button rules: one "Confirm PCSP" primary at the bottom, issues grouped at the top by "Fix before confirming" (errors) and "Check these" (warnings).

### 3. Support strategies: one per support, with its code, visible without clicking

SOW: a support strategy is the instructions telling staff how to help the client reach a PCSP goal or meet another need in the PCSP; it goes to the support coordinator within 30 days of the PCSP being activated. Today `assembleSupportStrategyStubs` (`src/lib/clients/training.functions.ts`) builds one section per **goal**, with no code and no support, hidden behind an expand arrow (`StrategiesTitle` in `support-strategies-cards.tsx`).

1. **One strategy per support paid to the agency:** a section for every support in the current plan year with at least one of the agency's codes, grouped under its goal; supports paid only to other providers get none. Each shows, read-only: **Goal**, **Support**, **Code** (badges), **Support details** (or "None listed"); and one editable field, **Support strategy** (Nectar drafts; a person edits). Store the plan support's id on each section. Keep sections someone edited; never overwrite them on rebuild.
2. **Other needs:** also a section for each non-goal support with the agency's code ("Goal: Other need in the PCSP").
3. **Coverage:** "N of M supports have a strategy"; empty ones show "Strategy needed" (amber). Approving with gaps warns and lists them; the person can still approve with a reason.
4. **Open by default:** remove the expand arrow. After a draft or rebuild, scroll to the list with the toast "Support strategies drafted. Review each one below, then approve." Rename "Rebuild from goals" to "Rebuild from PCSP supports". Each strategy has its own pencil to edit it in place.
5. **Status in plain words** with the matching button: "Draft: review and approve" (Approve), "Approved <date> by <name>", "Out of date: the PCSP changed since these were approved" (Rebuild from PCSP supports). Next to it: "Due to the support coordinator by <activation + 30 days>".
6. Split `support-strategies-panel.tsx` (248 lines) and trim the 895-line `client-specific-training-card.tsx` it borrows from: move what support strategies need into the plans folder and delete what nothing else uses. Unit-test the stub builder (one section per agency-paid support, other providers skipped, edited sections kept). Update the Overview's strategies attention item to use the same coverage count.

### 4. Progress summaries: clearly separate, and open in place

The summaries card's "Open editor" sits right under the strategies, so it looks like part of them, and it leaves the profile for `/dashboard/summaries`.

1. Separate cards with their own descriptions: "Support strategies: instructions to staff for each support." / "Progress summaries: quarterly or monthly reports to the support coordinator."
2. Buttons name the summary: "Open Q4 2026 summary", "View Q3 2026 summary" (`summaries-panel.tsx` ~line 97); primary "Start Q4 2026 summary".
3. Summaries open in a side panel inside the profile, reusing the existing editor from `/dashboard/summaries` (don't build a second one). Closing returns to the same spot. `/dashboard/summaries` stays as the agency-wide list.

**Done when:** the Plans section follows the order and card rules above; the plan years wording is identical in all four places; the parser tests and fixture cover the obsolete lines, page-break continuation and overlap wording; strategies are per support with codes and show without clicking; summaries open in a side panel; build/tsc/unit pass vs. baseline.
