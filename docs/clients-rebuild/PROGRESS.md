# Clients rebuild — progress

One short report per prompt. A new session continues from the first prompt not marked merged.

## Baseline (main @ start of run)
- Supabase live `dhrrukdcigiiqksibdfb`: reachable via MCP, migrations can be applied.
- `npx tsc --noEmit`: 203 errors.
- `npm run test:unit`: 1543 pass, 5 fail already on main (Lambda build path collision, NECTAR onboarding agency setup gate, Admin notification bell, confirm/webhook shared upsert, SOW index). "Passing" for each prompt = no new failures beyond these.

## P1
- **Status:** merged. PR #446 (https://github.com/danewarnick-source/Provider-Interface/pull/446) was squash-merged into `clients-rebuild`.
- **Branch:** `clients-rebuild-p1-safety-fixes`. Git can't create `clients-rebuild/…` while a branch named `clients-rebuild` exists.
- **What was done:**
  - Added `assertCanManageClient`, `src/lib/clients/dates.ts`, and guarded write server functions (`updateClient`, `createClient`, `writeClientRecord`). These confirm a row changed and otherwise show "You don't have permission to change this".
  - Every browser-side client write in the listed files now goes through these functions.
  - The profile load filters by organization.
  - Added page checks: billing, client training, workspace, HHS hub, the Clients sidebar link and hub, PBA, and Smart Import in client mode.
  - Edit buttons are hidden from view-only users.
  - Removed the healthcare-provider and RHS hospital-day / evacuation-drill cards, all `unfiled_items` uses, and the unused files. The old client-billing-codes page is now a redirect.
- **Checks:**
  - tsc: 203 errors before, 203 after.
  - Unit tests: 1592 pass, 5 fail; the 5 are the ones already failing on main.
  - Build passes. Done-when greps return 0.
- **Migrations:** none.
- **Files:** 9 added, 7 deleted.
- **Notes for later prompts:**
  - The live signature is `access_can_see_client(_client, _user)`.
  - Billing-code delete and budget-line delete are still hard deletes (Prompts 4 and 9).
  - Touched legacy files are still over the size limits (Prompts 2 and 7+).
  - Smart Import history is still on `view_staff_records`.

## P2
- **Status:** merged. PR #447 (https://github.com/danewarnick-source/Provider-Interface/pull/447) was squash-merged into `clients-rebuild`.
- **Branch:** `clients-rebuild-p2-folders`.
- **What was done:**
  - Client lib files moved to `src/lib/clients/`, renamed as the runbook says (for example `file.ts`, `hrc.ts`, `hrc.functions.ts`, `custom-fields-delete.ts`, `goals-for-staff.ts`, `training.functions.ts`).
  - Client components moved into `src/components/clients/{list,add,profile,dialogs,shared}/`. The 3 hooks moved to `src/components/clients/shared/hooks/`.
  - The list page was split out of `routes/dashboard.clients.tsx` into `list/` (`clients-page`, `use-client-list`, cards, table, intake chip, types, error view) and `add/` (`add-client-dialog`, `use-add-client`). `dashboard.clients.tsx` is now just the layout route.
  - `/dashboard/clients/new` now redirects to `/dashboard/clients?add=1`, which opens Add client. The index route reads `add` from the URL.
  - The other legacy client routes are redirects of 10 lines or fewer. They were kept because code, tests and the e2e smoke test still reference them.
  - Deleted, because nothing imported them: the `src/lib/clients/index.ts` barrel, `client-report-registry.ts`, and `client-budget-report.ts` and `client-report-shared.ts` (only the registry used those two).
- **Placement decisions:**
  - `client-access-gate`, `caseload-editor`, `code-assigned-staff`, `nectar-ask` and `client-documents-card` → `shared/`, because each is used by more than one subfolder.
  - `client-compliance-panel` and `client-intake-checklist-card` → `list/`.
  - `client-readiness-card`, `finish-onboarding-card` and `setup-checklist(-groups)` → `add/`.
- **Checks:**
  - tsc: 203 errors before, 203 after; the error sets are identical.
  - Unit tests: 1592 pass, 5 fail; the 5 are the ones already failing on main.
  - Build passes.
  - e2e roster: 10 pass / 5 fail at the start, 11 pass / 4 fail after. The 4 were all failing at the start.
  - e2e 1056: 12 fail at the start and the same 12 fail after, for the same reasons (the mocked chart, punch pad and billing headings are not found). These failures were already on the base branch.
- **Migrations:** none.
- **Files:** 9 added, 4 deleted, 64 moved (plus 3 that were moved and then deleted).
- **Notes for later prompts:**
  - **e2e setup:** Playwright 1.61 expects `chromium_headless_shell-1228`, but only 1194 is preinstalled. Symlink it: `mkdir -p /opt/pw-browsers/chromium_headless_shell-1228/chrome-headless-shell-linux64` and link the files from `chromium_headless_shell-1194/chrome-linux/`, naming `headless_shell` as `chrome-headless-shell`. Then start `npx vite dev --port 8080 --host 127.0.0.1` in the background before running the configs; the config's own webServer start times out.
  - **Oversized files:** many moved files are still over the size limits; the PR body lists them. The worst are `profile-tab` 1571, `setup-checklist-groups` 1632, `client-specific-training-card` 1153, `billing-codes-detail` 1080, `lib/clients/training.functions.ts` 1531, `import-schema.ts` 1139, and the `dashboard.clients.$clientId.tsx` route at 2553.
  - `dashboard.clients.pending.tsx` (233 lines) is still a real page the runbook doesn't mention.
