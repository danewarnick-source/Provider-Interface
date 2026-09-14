# Agency setup gate — isolated preview harness

Do **not** run this against Hive-Platform production (`dhrrukdcigiiqksibdfb`).
Do **not** Soft-apply from CI. Core pastes SQL in Lovable after Dane go.

## Preferred: local Supabase

```bash
supabase start
supabase db reset   # applies supabase/migrations including 20260914120000_agency_setup_gate.sql
npm run test:agency-setup-integration
# then point AGENCY_SETUP_TEST_DATABASE_URL at the local Postgres URL from `supabase status`
```

This cloud agent did **not** have Docker or the Supabase CLI, so `supabase start`
could not run here. Integration tests ran against a disposable local PostgreSQL
16 database named `agency_setup_gate_it` instead.

## Isolated Postgres (what the agent used)

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER agency_setup_it WITH PASSWORD 'agency_setup_it' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE agency_setup_gate_it OWNER agency_setup_it;"
export AGENCY_SETUP_TEST_DATABASE_URL='postgresql://agency_setup_it:agency_setup_it@127.0.0.1:5432/agency_setup_gate_it'
npm run test:agency-setup-integration
```

The test file refuses any URL containing `dhrrukdcigiiqksibdfb`.

## Authenticated UI preview (Dane / Core)

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
8. On a pre-existing org that already had staff/clients when SQL landed,
   confirm the staff/client lists still load and hire still works
   (`setup_create_gate_exempt = true`).

`scripts/agency-setup-gate-preview.mjs` prints the exact curl/server-fn checks
once `AGENCY_SETUP_PREVIEW_ORIGIN` and a test session cookie are provided.
It exits without sending anything if those are missing, and it refuses the
production project ref.
