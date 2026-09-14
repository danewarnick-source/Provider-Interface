# Agency setup gate — isolated preview harness

Do **not** run this against Hive-Platform production (`dhrrukdcigiiqksibdfb`).
Do **not** Soft-apply from CI. Core pastes SQL in Lovable after Dane go.
Catalog publishing stays untouched.

## What this agent could and could not run

| Check | Status here |
| --- | --- |
| In-memory unit tests (`agency-setup-gate.test.ts`, onboarding / Home source reviews) | Runnable |
| Isolated Postgres + **simplified** schema (`supabase/tests/agency-setup-gate/isolated-schema.sql`) + this migration | Runnable when local PG is up (`agency_setup_gate_it`) |
| `supabase start` / `supabase db reset` with **full** project migrations + live RLS | **Blocked** |
| Dedicated non-prod Supabase project URL + service role | **Blocked** (no credentials; must not use Hive-Platform) |
| Authenticated two-agency UI / live screenshots | **Blocked** until Reese has an isolated DB URL |

### Missing for full-project RLS proof

1. Docker (or another runtime that can boot the Supabase stack).
2. Supabase CLI (`supabase` not installed on this agent).
3. A dedicated **non-prod** project ref + URL (not `dhrrukdcigiiqksibdfb`).
4. Test users / session cookies for two agencies (new gated org + grandfathered org).
5. App origin pointed at that isolated DB (not hivecertify.com).

The simplified IT schema is a stand-in: org-scoped permissive policies plus
this migration’s restrictive INSERT + triggers. It does **not** include
caseload PHI SELECT, `self insert member` employee-only hardening, Hive Exec
UPDATE, or the rest of `supabase/migrations/`. Do not treat a green simplified
IT run as full-project RLS proof.

## Preferred: local Supabase (full migrations)

```bash
supabase start
supabase db reset   # applies supabase/migrations including 20260914120000_agency_setup_gate.sql
# point AGENCY_SETUP_TEST_DATABASE_URL at the local Postgres URL from `supabase status`
npm run test:agency-setup-integration
```

Then sign in as two test agencies on the local API URL (not production).

## Isolated Postgres (simplified schema — what the agent used)

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER agency_setup_it WITH PASSWORD 'agency_setup_it' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE agency_setup_gate_it OWNER agency_setup_it;"
export AGENCY_SETUP_TEST_DATABASE_URL='postgresql://agency_setup_it:agency_setup_it@127.0.0.1:5432/agency_setup_gate_it'
npm run test:agency-setup-integration
```

The test file refuses any URL containing `dhrrukdcigiiqksibdfb`.

## Authenticated UI preview (Reese / Dane / Core)

After SQL is applied to an **isolated test project or local Supabase only**:

1. Sign in as a new-org owner (not grandfathered).
2. Confirm Home still loads and Skip stays disabled at 1 of 6.
3. Open `/dashboard/employees` and `/dashboard/clients` — should redirect to
   `/dashboard/settings/compliance-setup?reason=setup_incomplete`.
4. Direct-request the create APIs (`createEmployeeManually`,
   `createInvitation`, `clients.insert`) — expect
   `Agency setup is incomplete…`.
5. Save all six operating facts (`service_area` is its own column).
6. Repeat the create APIs — expect success.
7. Confirm Agency A cannot read Agency B staff/clients.
8. On a pre-existing org with ≥1 client or members > 1 when SQL landed
   (TNS: 6 members / 4 clients), confirm lists still load and hire still
   works (`setup_create_gate_exempt = true`). Owner-only orgs stay gated.
9. Confirm company-profile save does **not** unlock create by itself
   (six facts / `useAgencySetup` only). The amber banner is an optional
   checklist and does not calculate eligibility.

`scripts/agency-setup-gate-preview.mjs` prints the exact curl/server-fn checks
once `AGENCY_SETUP_PREVIEW_ORIGIN` and a test session cookie are provided.
It exits without sending anything if those are missing, and it refuses the
production project ref.

Live UI screenshots / two-agency authenticated preview may be handed to Reese
once that isolated DB URL exists.
