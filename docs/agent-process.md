# How we work: builds, prompts, UI conventions, code style

`CLAUDE.md` holds the guardrails. This file holds the rest: read it before a **build** (a new screen or flow, or a runbook step that changes a screen). A **fix** doesn't need it.

## Running a build prompt
1. **Plan first, build second.** Before writing code, post a plan with a **behavior table**: every button, link, shortcut and empty state on the screen, with columns *Label · What happens on click · When it's disabled or hidden · What the user sees after*. Also list every decision you had to make that the prompt didn't settle. Wait for approval. (Unattended runbooks: see "Don't decide these" in CLAUDE.md.)
2. **Ask before guessing.** If the prompt leaves a user-visible behavior open, ask (up to ~10 questions in one message). Don't pick a default and move on.
3. **A demo is the spec.** When the prompt points at a demo (`docs/demos/*.html`, a folder created with the first demo, or an artifact), every button does exactly what it does there. Differences go in the PR, with the reason.
4. **One screen or one flow per PR.** If a prompt covers more, split it and say so.
5. **Done when** lines are what Dane clicks through on the PR's Vercel preview. They go in the PR as a checklist; Dane tests, not an e2e suite.
6. **PR body** = the final behavior table, the done-when checklist, decisions made, what was deleted, any DB change.

## Writing a prompt (for Dane, and for any agent drafting prompts or runbooks)
CLAUDE.md and this file carry the defaults, so a prompt only has to say what's *different*. Never restate rules in a prompt; if a rule is missing or wrong, fix it in the file instead.

A prompt is complete when it has these eight parts, in this order, each a few lines:
1. **Job:** who does this and what they're trying to get done ("The QA person needs to find the notes that need a look without reading all 300").
2. **Screen or flow:** one. If it takes more than one, it's more than one prompt.
3. **Reference:** the demo, artifact, screenshot or existing screen to match. If there is none, say "no reference, bring me 2–3 options as demos first" and the agent stops after the options.
4. **Behaviors:** what each button, link, shortcut and empty state does, as *click X → Y happens → user sees Z*. Anything not listed, the agent asks about before building.
5. **Done when:** 3–8 observable lines Dane can click through on the PR's Vercel preview.
6. **Data:** which tables or lib files own the facts involved (`docs/SOURCE_OF_TRUTH.md`), and which existing consumers must keep working.
7. **Delete:** what this replaces, by file and table name. Empty is allowed only for a brand-new area.
8. **Out of scope:** what not to touch.

Rules for the prompt itself:
- **Short beats thorough.** A good prompt fits on one screen.
- **Decide or delegate, per item.** Each open question is either answered in the prompt or handed to the agent ("you choose the column order; show me in the plan"). Silence means "ask me".
- **No design by adjective.** "Clean", "modern", "intuitive" tell the agent nothing. Point at a reference or describe the behavior.
- **One prompt, one PR, one preview.** Review the preview against the done-when list, send fixes as one numbered list per screen, pushed to the same branch.
- **Runbooks** are a sequence of these prompts plus a `PROGRESS.md` with one entry per prompt (status, PR, decisions made, notes for later prompts). A new session resumes from the first prompt not marked merged. Decisions recorded in PROGRESS.md are settled.
- **Kickoff line:** "Read CLAUDE.md, then `docs/<area>/RUNBOOK.md` and `PROGRESS.md`. Continue from the first prompt not marked merged. For a build step, post the plan and behavior table and wait; for a fix step, build it."

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
- **Status in form, not just text:** readiness, due, overdue and blocked states use the existing pill/tag tokens (`ok`, `warn/amber`, `danger`).
- **Dates** show as "Oct 22, 2026"; relative wording only next to the date ("Due Oct 22 · 3 days"). Date-only values are local (`src/lib/clients/dates.ts`), never `new Date("YYYY-MM-DD")`.
- **Phones first:** 44 px touch targets, tables become cards under 640 px, no horizontal page scroll.
- **Wording:** "client", "team member", "home", plain English; SOW citations only as small "§" hints when a spec asks for them. No PHI in texts, pushes, toasts or URLs.

## Code style (leave it smaller than you found it)
- **Replace means delete** (also in CLAUDE.md): the old component, function, route, table, column, bucket, hook or test goes in the same PR; grep for zero references. No commented-out code, no unused props, params, imports or types.
- **One source per fact.** If two places hold or compute the same thing, pick one, migrate the other's callers, delete it, and note it in the PR. Never add a third.
- **Reuse before writing.** Search `src/lib/`, `src/components/ui/`, `src/components/*/shared/` before creating a helper, component or table.
- **Size limits:** route files ≤ 80 lines, components ≤ 250, lib files ≤ 300, server-function files ≤ 300. Split a file you pushed over. Files you touch that were already over: bring them under if the change is in that file's area, otherwise say so in the PR.
- **Names say what things are**, in plain words (`client-list.tsx`, `evidence_files`, `hire_date`), never a phase, person, batch number or flag (`ninth-executable-batch.ts`, `phase-b`, `new-`). Rename with `git mv`.
- **Read-once code.** A new reader understands a file from its first 20 lines: a one-paragraph comment saying what it owns and what calls it, then the code. No abstractions for one call site; no `as any`; no catch-all `utils.ts`.
- **Tests** cover logic in pure functions (`lib/`), runnable by `node --test`. No regex-over-source "source lock" tests: they break on every refactor and catch no behavior.
- **Say what you deleted** in the PR. A build PR that only adds is suspicious; say why.
