# HIVE — Project Brain (read me first)
HIVE is a multi-tenant compliance platform for Utah DSPD (disability services) providers, replacing Connecteam + manual compliance. AI engine = "Nectar" (AWS Bedrock; Nectar advises/flags, NEVER fabricates documentation or acts unreviewed). First tenant: True North Supports (TNS). Services TNS runs: HHS, SLN, SLH, SEI, DSI. Launch: 2026-07-01, same day the new state contract DHHS91172 takes effect.

## Architecture & workflow
- TanStack Start + React + Supabase. Live project: "Provider-Interface" `dhrrukdcigiiqksibdfb` (Lovable is no longer used). Schema changes are migration files in supabase/migrations/, applied to the live DB directly (Supabase MCP/CLI) — one file per logical step, named for what it does. Small atomic commits, build green before push.
- Branches & deploys: `staging` = Vercel sandbox (agency-peace-of-mind.vercel.app); `main` = production on AWS (providerinterface.com, via .github/workflows/deploy-aws.yml). Nothing reaches `main` until the user says that change is ready.
  - Branch new work from `main` (never from `staging`, or unrelated staging work rides along to production). Open the PR against `staging`.
  - Merging the PR into `staging` puts it on the sandbox, and .github/workflows/sandbox-to-production.yml opens a matching "Production: …" PR from the same branch into `main` (label `production`). Merging that PR is the only way the change reaches production; the user decides when.
  - Fixes found while testing: push them to the same feature branch. The workflow merges them into `staging` and they show up in the production PR. Never delete the branch or merge `staging` into it.
  - Only open `staging` → `main` if the user asks to ship everything on staging at once.
  - Hotfixes may target `main` directly. .github/workflows/staging-sync.yml merges `main` back into `staging` on every push.
- The live DB is shared by production (main), staging, and PR previews: a migration applied before release must stay compatible with main. Anything that would break main (drops/renames) goes in a separate "Phase B" migration applied right after that change merges to main (not when it merges to staging).
- Older migrations may not match the live DB. Confirm schema against the live DB before relying on them.
- NEVER PostgREST-embed organization_members↔profiles (no FK; both key off auth.users.id) — two queries, join in JS.
- Access model (see docs/access-levels-migration-plan.md): organization_members.access_level (owner/admin/staff) + access_scope (agency/assigned/self) + access_preset_id (access_presets) + access_overrides. 18 categories, each off/view/edit, defined in src/lib/access/categories.ts. Code checks go through src/lib/access/ (useAccess().can / requireCategory). DB helpers: access_is_owner, is_org_admin_or_manager (= Owner or agency-wide Admin), access_has_category, access_can_see_client, access_can_see_staff. Scoped managers come from access_assignments (home/staff/client, many-to-many). Legacy organization_members.role / invitations.role still exist live until supabase/migrations/20260926000000_access_levels_b_drop_legacy_roles.sql is applied (only after the access-levels code is deployed; then regenerate src/integrations/supabase/types.ts). Never read or write `role` in new code.
- RLS: every org-data table is org-scoped via is_org_member/is_org_admin_or_manager helpers; never USING(true) on org/PHI data. `teams` = homes (team_name/setting/address). `home_designations` holds the Homes & Teams CARE-TEAM role labels (DSP/House Manager/Lead/Supervisor) — that's its legitimate data; never delete it, and never treat its rows as locations/homes.

## DSPD domain rules (encoded product truths — do not "simplify" these away)
- Atomic shift = client + service code + staff + time window. A client may only be scheduled/billed for codes with an active authorization row in client_billing_codes (the "1056"). No authorization → no shift, no billing.
- Unit math: quarter-hour codes round each ENTRY to the NEAREST quarter hour (Math.round of duration/15min); never alter raw timestamps; aggregate by summing per-entry units (never round a summed total). computeEntryUnits() in src/lib/billing-units.ts is the only correct path.
- EVV-mandated codes (geofence + UEVV transmission) per SOW §1.12: COM, HSQ, PAC, ACA, CHA, RP2, RP3, SLH, SLN, CMP, CMS. Everything else (incl. SEI, RHS, HHS, DSI) captures time for payroll/evidence only. src/lib/evv-codes.ts is authoritative.
- Daily-rate codes: HHS, RHS, PPS, DSG, RL6, RP4, RP5, SED (src/lib/service-billing.ts). HHS/RHS/DSI/SEI rates are per-client "worksheet" rates from client_billing_codes.rate_per_unit; SLH/SLN are table rates.
- Residential model: RHS = staffed homes, coverage requirements + coverage bars; staff clock for payroll (not EVV) and may run nested 1:1 segments (DSI/SEI) inside a base shift via parent_shift_id — segments are NOT overlap conflicts; during a segment the staff doesn't count toward home coverage. HHS = host homes: hosts NEVER clock or appear in shift scheduling; their artifact is the daily note + overnight confirmation (billing trigger: no overnight stay = unbillable day); agency staff visits into host homes ARE timed shifts (worksheet Direct Support hours).
- A billable HHS/residential day = attendance 'Present' AND daily note exists → hhs_daily_records_v.billable; otherwise blocked_reason explains.
- Summary cadences (DHHS91172, eff 7/1/26): quarterly (due 15 days after quarter end) for most codes incl. HHS/RHS/DSI/SLH/SLN; MONTHLY for SEI, SJD, CMP, CMS, PN1/PN2 (SEI summaries are typed into the state's UPI portal by the 15th); PBA = monthly financial statements. UPI is admin-only; staff never touch it.
- Conflict engine truths: back-to-back shifts (end == next start) are NOT overlaps; segment-within-parent is NOT a conflict; 2:1 staffing (two staff, one client, same time) needs a rights-modification warning; SLH/SLN overnight needs awake confirmation (asleep time unbillable); DSI max 6h/day; CMP/CMS max 8h/day, 40h/wk.
- Nectar posture: Gatekeeper (note coaching), Scrubber (pre-billing), Sentinel (deadlines/counters), Auditor (packet assembly). Always advisory: drafts marked, human attests, never auto-publish, never invent content.

## UI interaction rules (defaults for every screen; a prompt may override one, never silently)
- **Save:** toast saying what was saved ("Home saved"), stay on the page, show the new value in place. Never navigate away on save.
- **"+ Add X" / "+ Set X" shortcuts** (list cells, empty states, header tiles) open the editor for X with its first field focused. Never just the section the field lives in.
- **Edit:** one pencil button per card or row (40 px outline, `aria-label="Edit <thing>"`), same position everywhere. Save/Cancel appear in place; no separate edit pages.
- **Risky actions** (discharge, deactivate, archive, delete, end a code, remove access): a dialog that says what will happen and asks for a reason. Never a plain `confirm()`. Nothing that has worked a shift or holds records is hard-deleted.
- **Empty states** say what's missing in one sentence and show the one button that fixes it.
- **Disabled buttons** show the reason on hover/focus (tooltip or helper text). A button that would fail is disabled, not shown and then error.
- **Unsaved changes:** dialogs, drawers and edit modes never close (click-out, Escape, Back) with unsaved changes without asking.
- **Errors** say what went wrong and what to do ("Medicaid ID already belongs to Riley H. Open that client"). No raw codes, no "Something went wrong".
- **Labels** are verb + thing ("Add contact", "Upload PCSP"). Never "Submit", "OK", "Manage", "View", "Open editor". One primary (filled) action per card, top right; secondary actions are outline; rare actions go in the ⋯ menu.
- **Links that leave the page** say where they go ("Open in Evidence"). A row in a list is clickable and opens its record; actions inside the row stop propagation.
- **Lists** load in one request, keep search/filter/tab in the URL, and keep scroll position when the user comes back.
- **Status in form, not just text:** readiness, due, overdue and blocked states use the existing pill/tag tokens (`ok`, `warn/amber`, `danger`) so they're visible at a glance.
- **Dates** show as "Oct 22, 2026"; relative wording only next to the date ("Due Oct 22 · 3 days"). Date-only values are local (see `dates.ts`), never `new Date("YYYY-MM-DD")`.
- **Phones first:** 44 px touch targets, tables become cards under 640 px, no horizontal page scroll.
- **Wording:** "client", "team member", "home", plain English; SOW citations only as small "§" hints when a spec asks for them. No PHI in texts, pushes, toasts or URLs.

## How to run a build prompt (every feature or screen)
1. **Plan first, build second.** Before writing code, post a plan with a **behavior table**: every button, link, shortcut and empty state on the screen, with columns *Label · What happens on click · When it's disabled or hidden · What the user sees after*. Also list every decision you had to make that the prompt didn't settle. Wait for approval of the table before building. If the prompt says "no plan needed", still include the table in the PR.
2. **Ask before guessing.** If the prompt leaves a user-visible behavior open, ask (up to ~10 questions in one message). Don't pick a default and move on.
3. **"Done when" is observable.** Turn each done-when line into an e2e test *before* building ("click + Set home on a client with no home → Home select is open and focused → pick → Save → list shows the home"). Technical checks (file sizes, one request) are extra, never the definition of done.
4. **A demo is the spec.** When the prompt points at a demo (`docs/demos/*.html` or an artifact), every button does exactly what it does there. Differences must be listed in the PR, with the reason.
5. **One screen or one flow per PR.** If a prompt covers more, split it and say so.
6. **Walkthrough before the PR.** Run the done-when e2e tests with screenshots on (`screenshot: "on"`), save one image per step to `e2e/artifacts/<feature>/NN-<step>.png`, and put them in the PR body in order with one line each. The reviewer reads the strip, not the code.
7. **PR body** = behavior table (final), done-when list with pass/fail, screenshot strip, decisions made, what was deleted. No PHI in screenshots: use the mock/fixture data.
8. **Type errors never go up.** `npx tsc --noEmit` error count before and after in the PR; a PR that raises it isn't done.

## Writing a prompt (for Dane, and for any agent drafting prompts or runbooks)
This file carries the defaults, so a prompt only has to say what's *different*. Never restate CLAUDE.md rules in a prompt; if a rule is missing or wrong, fix it here instead so every future prompt gets it.

A prompt is complete when it has these eight parts, in this order, each a few lines:
1. **Job:** who does this and what they're trying to get done ("The QA person needs to find the notes that need a look without reading all 300").
2. **Screen or flow:** one. If it takes more than one, it's more than one prompt.
3. **Reference:** the demo, artifact, screenshot or existing screen to match ("match `docs/demos/clients-list.html`"; "works like the Team Members profile side menu"). If there is none, say "no reference, bring me 2–3 options as demos first" and the agent stops after the options.
4. **Behaviors:** what each button, link, shortcut and empty state does, in the form *click X → Y happens → user sees Z*. Anything not listed, the agent must ask about before building (not guess).
5. **Done when:** 3–8 observable lines a tester can click through. Each becomes an e2e test before code is written.
6. **Data:** which tables or lib files own the facts involved, and which existing consumers must keep working.
7. **Delete:** what this replaces, by file and table name. Empty is allowed only for a brand-new area.
8. **Out of scope:** what not to touch, so the agent doesn't "improve" nearby code.

Rules for the prompt itself:
- **Short beats thorough.** A good prompt fits on one screen. Length goes into behaviors and done-when, not into restating process.
- **Decide or delegate, per item.** Each open question is either answered in the prompt or explicitly handed to the agent ("you choose the column order; show me in the plan"). Silence means "ask me".
- **No design by adjective.** "Clean", "modern", "intuitive" tell the agent nothing. Point at a reference or describe the behavior.
- **One prompt, one PR, one preview.** Review the preview against the done-when list, send fixes as one numbered list per screen, and push them to the same branch.
- **Runbooks** are a sequence of these prompts plus a `PROGRESS.md` with one entry per prompt (status, PR, decisions made, notes for later prompts). A new session resumes from the first prompt not marked merged. Decisions recorded in PROGRESS.md are settled; later prompts don't reopen them.
- **Kickoff line** for a new session: "Read CLAUDE.md, then `docs/<area>/RUNBOOK.md` and `PROGRESS.md`. Continue from the first prompt not marked merged. Post the plan and behavior table and wait."

## Source of truth map (check before adding any table, column, file or fact)
Every fact has exactly one owner: one table (or column) and one lib file that reads and writes it. Everything else reads from the owner. The map lives in `docs/SOURCE_OF_TRUTH.md`; the core of it is here so no session misses it.

| Fact | Owner table / column | Owner code |
|---|---|---|
| Who works here, their access | `organization_members` (+ `access_*`), `profiles` for identity | `src/lib/access/`, `src/lib/team-members/` |
| Which client a team member supports, with which codes | `staff_assignments` (`client_id`, `service_codes`) | `src/lib/team-members/caseload.ts` |
| What a client is authorized for (the 1056) | `client_billing_codes` | `src/lib/clients/authorizations.ts` (+ `auth-1056.ts`) |
| Where a client lives (home) | `clients.team_id` → `teams` | `src/lib/clients/` |
| Homes | `teams` | homes route/lib |
| Staff requirements, proof, renewals | `evidence_items`, `evidence_files` | `src/lib/evidence/`, `src/lib/evidence.functions.ts` |
| Hours worked / EVV | `evv_timesheets` | `src/lib/billing-units.ts`, EVV lib |
| Scheduled work | `scheduled_shifts` | `src/lib/scheduler/` |
| Shift notes and daily notes | `daily_logs` | `src/lib/daily-log-*.ts` |
| Incidents | `incident_reports` | `src/lib/incidents.functions.ts` |
| Progress summaries | `client_progress_summaries` | `src/lib/progress-summar*` |
| Notes about a team member (office only) | `staff_notes` | `src/lib/team-members/staff-notes.ts` |
| Hire date | `profiles.hire_date` (not `start_date`) | `src/lib/team-members/profile.ts` |
| Service code facts (EVV, daily-rate, cadence) | code: `src/lib/evv-codes.ts`, `src/lib/service-billing.ts` | same |

Rules:
- **Before adding** a table, column, lib file or computed value, find the row above (or in `docs/SOURCE_OF_TRUTH.md`) that owns the fact. If it exists, use it. If it doesn't, add the row in the same PR; a PR that creates a fact without a row in the map isn't done.
- **Derived facts are computed, not stored.** Readiness, "needs attention", units left, next due, overdue: computed in one lib function from owner tables, never written to a column, never computed twice. If two screens show the same derived fact, they call the same function.
- **Never cache a fact on a second table** ("just copy the client's name here for convenience"). Join or look it up.
- **Facts about Persons drive staff rules.** A staff requirement that depends on a client (ABI, behavior plan, code) is derived from the client's record and the assignment, never from a switch on the staff profile.
- **Not a source of truth**, read-only until removed (don't build on these): `employee_client_assignments`, `staff_assigned_to_client`, `assignment_map`, `staff_other_assignments` (→ `staff_assignments`); `company_obligation*`, `obligation_applicability` (→ `evidence_*`); `training_completions`, `hive_training_*`, `training_class*`, `import_cert_documents`, `hr_documents`, `employee_documents` (→ `evidence_files`, except in-platform course progress until Training is rebuilt); `profiles.start_date`, `profiles.requires_abi`, `profiles.requires_deescalation`; `locations` (→ `teams`); old `hhs_daily_records` (→ `hhs_daily_records_v`). When a rebuild touches an area, its prompt names which of these it retires.
- **Two names, one thing:** the UI says "client" / "team member" / "home"; the schema says `clients` / `profiles`+`organization_members` / `teams`. Don't introduce a third name (no "person", "staff", "location", "employee" in new tables or files).

## Leave it smaller than you found it (every PR)
The codebase and database must shrink and get easier to read with each change. "Done" includes the cleanup.
- **Replace means delete.** When a PR replaces a component, function, route, table, column, bucket, hook or test, the old one is deleted in the same PR. Before finishing, grep for every removed export and name and confirm zero references remain. No commented-out code, no `legacy`/`old`/`v2` copies, no feature flags that keep both paths alive, no unused props, params, imports or types.
- **One source per fact.** A fact lives in one table and one lib file. If you find two places that hold or compute the same thing (two readiness checks, two assignment tables, two date helpers), pick one, migrate the other's callers, delete it, and note it in the PR. Never add a third.
- **Reuse before writing.** Before creating a helper, component or table, search for an existing one (`src/lib/`, `src/components/ui/`, `src/components/*/shared/`). Extend it or use it; don't write a near-duplicate.
- **Size limits:** route files ≤ 80 lines, components ≤ 250, lib files ≤ 300, server-function files ≤ 300. Split before merging if you pushed a file over. Files you touch that were already over: bring them under if the change is in that file's area, otherwise list them in the PR.
- **Database:** every new table or column needs a one-line reason in the migration. Prefer a column on an existing table to a new table. Drop tables, columns, functions, views, triggers and storage buckets that nothing reads or writes (additive migration while `main` still uses them; the drop in a Phase B migration right after the replacement reaches `main`). Before dropping anything with rows, confirm the data is either migrated or outside the retention rules (7-year Medicaid retention for client and staff records). Keep `src/integrations/supabase/types.ts` regenerated so dead tables disappear from the types.
- **Names say what things are.** Files, functions, tables and columns are named for what they hold or do, in plain words (`client-list.tsx`, `evidence_files`, `hire_date`), not for a phase, person, batch number or feature flag (`ninth-executable-batch.ts`, `phase-b`, `new-`). Rename when you touch a badly named thing, with `git mv` so history is kept.
- **Read-once code.** A new reader should understand a file from its first 20 lines: a one-paragraph comment saying what it owns and what calls it, then the code. No clever abstractions for one call site; no `as any` (fix the type or regenerate it); no catch-all `utils.ts`.
- **Report the numbers.** Every PR body ends with: lines added/removed, files added/deleted, tables/columns added/dropped, `tsc` error count before/after. A feature PR that only adds is suspicious; say why.
- **Protected, never delete without instruction:** `home_designations`, the old `hhs_daily_records` table, anything under 7-year retention.

## Known landmines
- locations table exists live-only; was polluted with staff-role names; rebuild only from teams.
- Old hhs_daily_records table is orphaned; read hhs_daily_records_v instead (never delete the old table without instruction).
- must_change_password must be enforced at router root. /fix-admin route is deleted; never recreate.
- Password-reset / invite / magic-link / email-confirm redirects must use `src/lib/auth-redirect.ts` (`passwordResetRedirectUrl` / `resolveAuthOrigin`). Never hardcode a Lovable URL. Allowed origins: providerinterface.com (+www) and agency-peace-of-mind.vercel.app; hivecertify.com (now a 301 to providerinterface.com) and Lovable hosts are rewritten to https://providerinterface.com. Supabase Dashboard Site URL must be https://providerinterface.com (ops, not in repo) or Auth will ignore redirectTo.

# Build & commit rules for this repo

This project uses TanStack Router (via @lovable.dev/vite-tanstack-config). The
file src/routeTree.gen.ts is auto-generated AND committed to git. If it is stale
relative to the route files, preview builds fail.

## Required before EVERY commit and push:
1. Run `npm run build`. This regenerates src/routeTree.gen.ts via the
   tanstack router plugin.
2. If src/routeTree.gen.ts changed, stage it together with your other changes.
3. Never commit changes to files under src/routes/ without the matching
   regenerated src/routeTree.gen.ts in the same commit.
4. The build must pass before you push.
