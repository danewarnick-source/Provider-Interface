# Clients Polish — Start Here

Owner: Jeff (Dane Warnick). Repo: danewarnick-source/Provider-Interface. Live Supabase project: dhrrukdcigiiqksibdfb (NEVER refrpqrxpjeqmygxgekp).

Jeff reviewed the Clients rebuild (PR #457, branch `clients-rebuild`, not yet merged to `staging`) and asked for these changes before it ships. They are fixes to that same work, so per CLAUDE.md they land on `clients-rebuild` and PR #457 updates itself.

| File | Prompts |
| --- | --- |
| `C1-C2-layout-and-list.md` | C1 Shared layout, header and side menu · C2 Clients list page |
| `C3-C4-overview-profile-plans.md` | C3 Overview and Profile sections · C4 Plans section and PCSP review |
| `C5-C6-file-and-sections.md` | C5 Client file and Evidence · C6 Contacts, Health, Services, Money, Team, Activity |
| `C7-C10-intake-import-delete.md` | C7 Remove Smart Import, one Add client, spreadsheet templates · C8 Fill from PCSP fills everything · C9 Optional full setup, hide what doesn't apply · C10 Delete made-by-mistake people |

Run them in order, C1 → C10: C1 builds the shared card and header every later prompt uses.

---

## Goals for every prompt

1. **User friendly first.** Every card says what it's for in one line. Every message says what's wrong and has the button that fixes it. Every button says exactly what it does ("Upload PCSP", "Open Q4 2026 summary"), never "Open editor", "View", "Submit" or "Manage".
2. **Less code, one source.** When something is replaced, delete the old file, component, function, route, type and test in the same PR. Grep each removed export and confirm zero imports. No commented-out code, no "legacy" copies, no second version of something that exists (reuse the existing PCSP upload, summary editor, Evidence functions).
3. **Same look everywhere.** Use the shared pieces from C1 (`SectionCard`, the button rules, the info tile). Don't hand-roll a card or a header anywhere in the client profile or the Clients list.
4. **Today's colors.** Use the app's current theme tokens only (`src/styles/hive-theme.css`: `--hive-ink`, `--hive-gold` / `--hive-gold-soft`, `--hive-ok` / `--hive-ok-soft`, `--hive-info` / `--hive-info-soft`, `--hive-danger` / `--hive-danger-soft`, `--hive-muted-surface`, `--hive-border`, `--hive-surface`, via the existing Tailwind tokens). Add no new hex values. A color change comes later, separately.

---

## HOW TO RUN THIS (Claude Code, unattended)

1. Read `CLAUDE.md` and this file. Open only the prompt file for the step you're on.
2. Check out `clients-rebuild` and pull. Make sure `docs/clients-polish/` on it holds these five files; commit and push if not.
3. **Baseline, once:** before C1, record in `docs/clients-polish/PROGRESS.md` the `npx tsc --noEmit` error count and the `npm run test:unit` failures by name. Already-failing tests are not blockers. The bar for every prompt is **no new failures vs. this baseline**.
   **Do not run any e2e (Playwright) tests** in this run: not as a baseline, not per prompt, not at the end. Jeff tests each PR himself on the staging sandbox. Don't add new e2e tests either.
4. For each prompt, in order C1 → C10:
   a. Start a **fresh subagent** with: the Goals above, the Standard Rules below, the baseline, and that one prompt, verbatim. Nothing else.
   b. It works on branch `clients-polish-cN-<short-name>` cut from the current tip of `clients-rebuild`.
   c. Before finishing: `npm run build` (commit the regenerated `src/routeTree.gen.ts`), `npx tsc --noEmit` no higher than the baseline, `npm run test:unit` with no new failures, and the prompt's "Done when" (checked by reading the code and unit tests; anything that needs clicking goes in the PR's click-through list for Jeff).
   d. Open a PR into `clients-rebuild` titled `Clients polish CN: <name>`. Body: what changed, a **button list** (every button added, renamed or removed, old label → new label), files added and deleted, line counts before → after for every touched file, migrations applied, tests vs. baseline.
   e. All checks pass: squash-merge into `clients-rebuild` and continue.
   f. A check fails and two honest fixes inside the prompt's scope don't solve it: leave the PR open with `BLOCKED: <reason>` at the top and **stop the run**.
   g. The subagent returns only a ≤ 10-line report (PR link, merged yes/no, checks vs. baseline, migrations, files added/deleted, blockers). Append it to `PROGRESS.md` and commit. If the run is interrupted (including a container restart), read `PROGRESS.md`, delete any step branch with no pushed PR, and continue from the first prompt not marked merged.
5. At the end, update **PR #457's body**: add a "Clients polish" section with the table of C1–C10 PRs, total client-area line count before → after, every migration applied, and a "Check on staging" click-through list. Never merge into `staging` or `main`.
6. **Migrations and the database tool:** the Supabase tool holds any SQL containing `DELETE` for Jeff's approval, and that prompt doesn't reach him from an unattended run. Write such a migration file, don't apply it, put `NEEDS JEFF: apply <file>` at the top of the PR body, keep any code that depends on it behind the old path until it's applied, and continue. Never try to get around the approval.
7. If a scheduler session is running at the same time, only one session applies migrations at a time; check `supabase_migrations.schema_migrations` for a newer migration before applying yours.

---

## STANDARD RULES (every prompt)

- Read CLAUDE.md first. Never PostgREST-embed organization_members↔profiles (two queries, join in JS).
- **Database:** every change is a migration in `supabase/migrations/` named for what it does, applied to live `dhrrukdcigiiqksibdfb`, **additive only** (new tables/columns, backfills, functions, RLS). No drops, renames or type changes: production `main` shares this database. Regenerate `src/integrations/supabase/types.ts` after any migration.
- **No hard deletes** of client, contact, document, plan, note, shift, punch or billing records (7-year Medicaid retention). Archive, end-date or mark "not needed".
- **No PHI** in code, tests, fixtures, logs or PR text. Fixtures use made-up people.
- **Size limits:** route files ≤ 80 lines, components ≤ 250, lib files ≤ 300. Split before merging. Report, don't split, old oversized files you only touch lightly.
- **Writes** go through server functions with the existing client guards (`src/lib/clients/guards.server.ts`, `requireCategory`). Show an edit button only to people who can edit; everyone else sees the same card read-only.
- **Nectar** only drafts. A person reviews and approves before anything Nectar wrote is saved, and the card shows who approved it and when. Nectar never invents facts.
- **PI warns, it doesn't block** operational actions; the only hard stops are the state's own (no authorization → no shift or billing).
- **Wording:** plain English, "team member" (never employee) and "client", dates like "Aug 31, 2026", no raw `2026-09-01` in the UI, no SOW section numbers except small "§" hints where a prompt shows them.
- **Phones:** every screen works at 390 px wide; touch targets ≥ 44 px; side menus become a scrolling row; wide tables scroll inside their own box.
- **Tests:** every new or changed lib file (rules, math, parsing, wording) gets a `*.test.ts` beside it, added to `test:unit`. No e2e work: don't run, add or fix Playwright tests. When you delete something an e2e test or mock references, delete or update that reference so the repo still builds and type-checks.
- **Click-through list:** every PR body ends with "Check on staging": 3–8 short steps Jeff can click to see the change ("Open a client → Plans → Upload PCSP → see the plan year filled").

---

## KICKOFF MESSAGE (paste into Claude Code)

> (If you attached the five files instead of pushing them: "Check out `clients-rebuild`, save the attached files into `docs/clients-polish/`, commit and push. Then…")
>
> Read `docs/clients-polish/00-START-HERE.md` on branch `clients-rebuild` and run C1 through C10 exactly as written: record the baseline once, then one subagent and one PR per prompt into `clients-rebuild`, merging each only when it has no new failures vs. the baseline, stopping on a blocker. When done, update PR #457's body with the Clients polish summary. Don't merge into `staging` or `main`. I'm asleep; don't wait for me.
