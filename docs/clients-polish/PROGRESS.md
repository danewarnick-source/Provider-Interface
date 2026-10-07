# Clients polish — progress

## Notes for the run
- PR #457 (clients-rebuild → staging) was **already merged on Oct 6, 2026**. No open "Production:" PR exists for clients-rebuild, so pushes to clients-rebuild do not auto-sync to staging. The polish PRs land on clients-rebuild; shipping them needs a new clients-rebuild → staging PR later (the user decides).
- **Runbook updated (Oct 7, 2026):** the run is now C1 → C10, and **no e2e (Playwright) tests** are run, added or fixed. Checks are build, tsc and unit tests vs. the baseline, plus a "Check on staging" click-through list at the end of every PR body. The e2e baseline below is kept for reference only and is not a merge gate. (run-e2e.sh removed.)
- Prompt files: C1-C2 is in this folder (updated no-e2e version). C3-C4, C5-C6 and C7-C10 have **not been provided yet**. The run stops after C2 until they're added here.

## Baseline (clients-rebuild @ d14b63ff, Oct 7, 2026)
- `npx tsc --noEmit`: **203** errors (none under src/components/clients or src/lib/clients).
- `npm run test:unit`: 1843 tests, **5 failing**:
  - lambda-build-target.test.ts › Lambda build path does not collide with Vercel or build:aws › deploy-aws.yml updates matching Lambda before S3 --delete, then CloudFront
  - nectar-onboarding.test.ts › NECTAR onboarding — agency setup gate, no Home wizard › keeps the company documents hub as optional storage, not a SOW gate
  - notification-bell.test.ts › Admin notification bell › keeps the Admin-only mount and the chrome conditions that clip in-tree panels
  - org-subscription-activate.test.ts › confirm and webhook share the upsert › confirmCheckout upserts via activateSubscriptionFromCheckout
  - sow-index.test.ts › SOW index › builds about 300 rows from catalog + perimeters + standing + codes
- _E2E (reference only, not a gate):_
- E2E roster (20 tests): **3 failing**
  - clients-staff-roster.spec.ts:176 › 4. Team Members list loads; staff profile shows role at a glance
  - clients-staff-roster.spec.ts:671 › Caseload lives on the profile; /dashboard/assignments redirects
  - clients-staff-roster.spec.ts:852 › Access levels screenshots › access presets, bulk access dropdown, and profile scope save
  - (clients-profile-sections.spec.ts and clients-pcsp-review.spec.ts pass when warm.)
- E2E staff go-live (6): **0 failing**
- E2E daily logs (6): **4 failing** — daily-logs.spec.ts:65 (1. list does not crash), :86 (2. empty caseload message), :101 (3. compose UI / Close does not save), :134 (4. client picker binds a client)
- E2E 1056 (12): **12 failing** — all 7 in client-1056-billing.spec.ts (:65, :100, :159, :196, :239, :264, :295) and all 5 in punch-pad-gps.spec.ts (:112, :155, :168, :188, :199)

## Steps
