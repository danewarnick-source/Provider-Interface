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
