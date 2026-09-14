/**
 * Real Postgres integration tests for the agency setup gate.
 * Isolated local database only. Refuses Hive-Platform production.
 *
 * These are not the in-memory array unit tests in agency-setup-gate.test.ts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, before, after } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  computeAgencySetupStatus,
  setupFactsFromOrgRow,
} from "./agency-setup-gate.ts";
import { persistAgencySetupFactsInternal } from "./agency-setup-persist.ts";

const HIVE_PLATFORM_REF = "dhrrukdcigiiqksibdfb";
const DEFAULT_URL =
  process.env.AGENCY_SETUP_TEST_DATABASE_URL ??
  "postgresql://agency_setup_it:agency_setup_it@127.0.0.1:5432/agency_setup_gate_it";

const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ORG_EXISTING = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5";
const USER_EXISTING = "55555555-5555-4555-8555-555555555555";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_A2 = "11111111-1111-4111-8111-111111111112";
const ORG_C = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const USER_C = "33333333-3333-4333-8333-333333333333";
const USER_C2 = "33333333-3333-4333-8333-333333333334";

function refuseProduction(url: string) {
  if (url.includes(HIVE_PLATFORM_REF)) {
    throw new Error(
      "Refusing Hive-Platform production (dhrrukdcigiiqksibdfb). Use a local or dedicated test database.",
    );
  }
}

function readRel(rel: string) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

async function asUser(client: pg.Client, userId: string, fn: () => Promise<void>) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* not in a transaction */
  }
  await client.query("RESET ROLE");
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await client.query("SET ROLE authenticated");
  try {
    await fn();
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* not in a transaction */
    }
    await client.query("RESET ROLE");
  }
}

function pgClientToSupabase(client: pg.Client, failApplicability = false) {
  return {
    from(table: string) {
      const state: { filters: Array<[string, string]> } = { filters: [] };
      const api = {
        select() {
          return api;
        },
        eq(col: string, value: string) {
          state.filters.push([col, value]);
          return api;
        },
        async maybeSingle() {
          const orgId = state.filters.find(([col]) => col === "id")?.[1];
          const { rows } = await client.query(
            `SELECT fact_operates_ol_site, fact_uses_volunteers, fact_has_governing_board,
                    services_offered, approx_client_count, service_area, setup_create_gate_exempt,
                    fact_answers_updated_at, fact_answers_updated_by
             FROM public.organizations WHERE id = $1`,
            [orgId],
          );
          return { data: rows[0] ?? null, error: null };
        },
        async update(payload: Record<string, unknown>) {
          const orgId = state.filters.find(([col]) => col === "id")?.[1];
          const keys = Object.keys(payload);
          const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
          await client.query(
            `UPDATE public.organizations SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((key) => payload[key]), orgId],
          );
          return { error: null };
        },
        eqAfterUpdate: undefined as unknown,
        upsert() {
          if (failApplicability || table === "obligation_applicability") {
            return Promise.resolve({
              error: { message: "simulated applicability failure" },
            });
          }
          return Promise.resolve({ error: null });
        },
      };
      const update = (payload: Record<string, unknown>) => ({
        async eq(col: string, value: string) {
          if (table === "obligation_applicability") {
            return { error: { message: "simulated applicability failure" } };
          }
          const keys = Object.keys(payload);
          const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
          await client.query(
            `UPDATE public.organizations SET ${sets} WHERE ${col} = $${keys.length + 1}`,
            [...keys.map((key) => payload[key]), value],
          );
          return { error: null };
        },
      });
      return {
        select: api.select.bind(api),
        update,
        upsert: api.upsert,
      };
    },
  };
}

describe("integration: agency setup gate on isolated Postgres", { concurrency: false }, () => {
  let client: pg.Client;

  before(async () => {
    refuseProduction(DEFAULT_URL);
    client = new pg.Client({ connectionString: DEFAULT_URL });
    try {
      await client.connect();
    } catch (err) {
      const hint =
        "Start an isolated Postgres (see scripts/agency-setup-gate-preview.md) " +
        "or set AGENCY_SETUP_TEST_DATABASE_URL. Never Hive-Platform production.";
      throw new Error(`Could not connect to isolated test DB: ${(err as Error).message}. ${hint}`);
    }
    const { rows } = await client.query("SELECT current_database() AS db");
    assert.notEqual(rows[0]?.db, "postgres");
    await client.query(readRel("../../supabase/tests/agency-setup-gate/isolated-schema.sql"));
    await client.query("GRANT authenticated TO CURRENT_USER");
    await client.query("GRANT service_role TO CURRENT_USER");

    await client.query(
      `INSERT INTO public.organizations (id, name, slug, services_offered)
       VALUES ($1, 'Uintah Employment', 'uintah-employment', ARRAY['SEI'])`,
      [ORG_B],
    );
    await client.query(
      `INSERT INTO public.organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [ORG_B, USER_B],
    );
    await client.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Existing Staffed Home', 'existing-staffed')`,
      [ORG_EXISTING],
    );
    await client.query(
      `INSERT INTO public.organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [ORG_EXISTING, USER_EXISTING],
    );

    await client.query(readRel("../../supabase/migrations/20260914120000_agency_setup_gate.sql"));
  });

  after(async () => {
    await client.end();
  });

  it("grandfathers orgs that already had members; new orgs stay gated", async () => {
    const existing = await client.query(
      "SELECT setup_create_gate_exempt FROM public.organizations WHERE id = $1",
      [ORG_EXISTING],
    );
    const b = await client.query(
      "SELECT setup_create_gate_exempt FROM public.organizations WHERE id = $1",
      [ORG_B],
    );
    assert.equal(existing.rows[0].setup_create_gate_exempt, true);
    assert.equal(b.rows[0].setup_create_gate_exempt, true);

    await client.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Wasatch Residential', 'wasatch-residential')`,
      [ORG_A],
    );
    const a = await client.query(
      "SELECT setup_create_gate_exempt FROM public.organizations WHERE id = $1",
      [ORG_A],
    );
    assert.equal(a.rows[0].setup_create_gate_exempt, false);
  });

  it("creates Agency A first owner while Agency B already has members", async () => {
    await asUser(client, USER_A, async () => {
      await client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [ORG_A, USER_A],
      );
    });
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM public.organization_members WHERE organization_id = $1",
      [ORG_A],
    );
    assert.equal(rows[0].n, 1);
  });

  it("blocks second staff, client, and invitation while setup is incomplete", async () => {
    await assert.rejects(
      () =>
        asUser(client, USER_A, async () => {
          await client.query(
            `INSERT INTO public.organization_members (organization_id, user_id, role)
             VALUES ($1, $2, 'employee')`,
            [ORG_A, USER_A2],
          );
        }),
      /Agency setup is incomplete/,
    );
    await assert.rejects(
      () =>
        asUser(client, USER_A, async () => {
          await client.query(
            `INSERT INTO public.clients (organization_id, first_name, last_name)
             VALUES ($1, 'Ada', 'Client')`,
            [ORG_A],
          );
        }),
      /Agency setup is incomplete/,
    );
    await assert.rejects(
      () =>
        asUser(client, USER_A, async () => {
          await client.query(
            `INSERT INTO public.invitations (organization_id, email)
             VALUES ($1, 'staff@example.test')`,
            [ORG_A],
          );
        }),
      /Agency setup is incomplete/,
    );
  });

  it("matches TypeScript and SQL completion on the dedicated service_area column", async () => {
    const before = await client.query(
      "SELECT public.org_setup_is_complete($1) AS complete",
      [ORG_A],
    );
    assert.equal(before.rows[0].complete, false);

    await client.query(
      `UPDATE public.organizations SET
         services_offered = ARRAY['HHS','RHS'],
         fact_operates_ol_site = true,
         fact_uses_volunteers = false,
         fact_has_governing_board = true,
         approx_client_count = 12,
         service_area = 'Salt Lake, Davis',
         specializations = 'Behavioral support'
       WHERE id = $1`,
      [ORG_A],
    );
    const row = await client.query(
      `SELECT fact_operates_ol_site, fact_uses_volunteers, fact_has_governing_board,
              services_offered, approx_client_count, service_area, specializations
       FROM public.organizations WHERE id = $1`,
      [ORG_A],
    );
    const facts = setupFactsFromOrgRow(row.rows[0]);
    assert.equal(facts.serviceArea, "Salt Lake, Davis");
    assert.equal(computeAgencySetupStatus(facts).complete, true);
    const after = await client.query(
      "SELECT public.org_setup_is_complete($1) AS complete",
      [ORG_A],
    );
    assert.equal(after.rows[0].complete, true);

    await client.query(
      `UPDATE public.organizations SET service_area = NULL WHERE id = $1`,
      [ORG_A],
    );
    const blank = await client.query(
      "SELECT public.org_setup_is_complete($1) AS complete",
      [ORG_A],
    );
    assert.equal(blank.rows[0].complete, false);
    await client.query(
      `UPDATE public.organizations SET service_area = 'Salt Lake, Davis' WHERE id = $1`,
      [ORG_A],
    );
  });

  it("allows staff, client, and invitation after setup is complete", async () => {
    await asUser(client, USER_A, async () => {
      await client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'employee')`,
        [ORG_A, USER_A2],
      );
      await client.query(
        `INSERT INTO public.clients (organization_id, first_name, last_name)
         VALUES ($1, 'Ada', 'Client')`,
        [ORG_A],
      );
      await client.query(
        `INSERT INTO public.invitations (organization_id, email)
         VALUES ($1, 'staff@example.test')`,
        [ORG_A],
      );
    });
    const members = await client.query(
      "SELECT count(*)::int AS n FROM public.organization_members WHERE organization_id = $1",
      [ORG_A],
    );
    const clients = await client.query(
      "SELECT count(*)::int AS n FROM public.clients WHERE organization_id = $1",
      [ORG_A],
    );
    const invites = await client.query(
      "SELECT count(*)::int AS n FROM public.invitations WHERE organization_id = $1",
      [ORG_A],
    );
    assert.equal(members.rows[0].n, 2);
    assert.equal(clients.rows[0].n, 1);
    assert.equal(invites.rows[0].n, 1);
  });

  it("keeps existing-org staff readable and lets a grandfathered org hire", async () => {
    const visible = await client.query(
      `SELECT count(*)::int AS n FROM public.organization_members WHERE organization_id = $1`,
      [ORG_EXISTING],
    );
    assert.equal(visible.rows[0].n, 1);
    await asUser(client, USER_EXISTING, async () => {
      const read = await client.query(
        "SELECT user_id FROM public.organization_members WHERE organization_id = $1",
        [ORG_EXISTING],
      );
      assert.equal(read.rows.length, 1);
      await client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'employee')`,
        [ORG_EXISTING, "55555555-5555-4555-8555-555555555556"],
      );
      await client.query(
        `UPDATE public.organization_members SET role = 'manager'
         WHERE organization_id = $1 AND user_id = $2`,
        [ORG_EXISTING, USER_EXISTING],
      );
    });
  });

  it("prevents Agency A from reading, updating, or inserting Agency B records", async () => {
    await asUser(client, USER_A, async () => {
      const members = await client.query(
        "SELECT * FROM public.organization_members WHERE organization_id = $1",
        [ORG_B],
      );
      const orgs = await client.query("SELECT * FROM public.organizations WHERE id = $1", [ORG_B]);
      assert.equal(members.rows.length, 0);
      assert.equal(orgs.rows.length, 0);
      const updated = await client.query(
        "UPDATE public.organization_members SET role = 'employee' WHERE organization_id = $1",
        [ORG_B],
      );
      assert.equal(updated.rowCount, 0);
    });
    await assert.rejects(
      () =>
        asUser(client, USER_A, async () => {
          await client.query(
            `INSERT INTO public.organization_members (organization_id, user_id, role)
             VALUES ($1, $2, 'employee')`,
            [ORG_B, USER_A2],
          );
        }),
      /row-level security|violates|incomplete/i,
    );
    await assert.rejects(
      () =>
        asUser(client, USER_A, async () => {
          await client.query(
            `INSERT INTO public.clients (organization_id, first_name, last_name)
             VALUES ($1, 'Eve', 'Other')`,
            [ORG_B],
          );
        }),
      /row-level security|violates|incomplete/i,
    );
  });

  it("service-role writes still hit the trigger", async () => {
    await client.query(
      `INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Service Role Org', 'service-role-org')`,
      [ORG_C],
    );
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE service_role");
    await client.query(
      `INSERT INTO public.organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [ORG_C, USER_C],
    );
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO public.organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'employee')`,
          [ORG_C, USER_C2],
        ),
      /Agency setup is incomplete/,
    );
    await client.query("ROLLBACK");

    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE service_role");
    await client.query(
      `INSERT INTO public.organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [ORG_C, USER_C],
    );
    await client.query("COMMIT");
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE service_role");
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO public.clients (organization_id, first_name, last_name)
           VALUES ($1, 'Cora', 'Client')`,
          [ORG_C],
        ),
      /Agency setup is incomplete/,
    );
    await client.query("ROLLBACK");
  });

  it("blocks an authenticated admin from flipping setup_create_gate_exempt", async () => {
    const before = await client.query(
      `SELECT setup_create_gate_exempt,
              public.org_setup_is_complete($1) AS complete,
              public.org_setup_allows_create($1) AS allowed
       FROM public.organizations WHERE id = $1`,
      [ORG_C],
    );
    assert.equal(before.rows[0].setup_create_gate_exempt, false);
    assert.equal(before.rows[0].complete, false);
    assert.equal(before.rows[0].allowed, false);

    await assert.rejects(
      () =>
        asUser(client, USER_C, async () => {
          await client.query(
            `UPDATE public.organizations SET setup_create_gate_exempt = true WHERE id = $1`,
            [ORG_C],
          );
        }),
      /locked|privilege|permission denied|42501/i,
    );

    const after = await client.query(
      `SELECT setup_create_gate_exempt, public.org_setup_allows_create($1) AS allowed
       FROM public.organizations WHERE id = $1`,
      [ORG_C],
    );
    assert.equal(after.rows[0].setup_create_gate_exempt, false);
    assert.equal(after.rows[0].allowed, false);

    await assert.rejects(
      () =>
        asUser(client, USER_C, async () => {
          await client.query(
            `INSERT INTO public.clients (organization_id, first_name, last_name)
             VALUES ($1, 'Skip', 'Setup')`,
            [ORG_C],
          );
        }),
      /Agency setup is incomplete/,
    );
  });

  it("rolls back org facts when a later setup-save step fails", async () => {
    const before = await client.query(
      `SELECT services_offered, service_area, fact_operates_ol_site
       FROM public.organizations WHERE id = $1`,
      [ORG_C],
    );
    const supabase = pgClientToSupabase(client, true);
    await assert.rejects(
      () =>
        persistAgencySetupFactsInternal(supabase, ORG_C, USER_C, {
          operates_ol_site: true,
          uses_volunteers: false,
          has_governing_board: true,
          servicesOffered: ["SEI"],
          approxClientCount: 4,
          serviceArea: "Uintah Basin",
        }),
      /simulated applicability failure/,
    );
    const after = await client.query(
      `SELECT services_offered, service_area, fact_operates_ol_site
       FROM public.organizations WHERE id = $1`,
      [ORG_C],
    );
    assert.deepEqual(after.rows[0].services_offered, before.rows[0].services_offered);
    assert.equal(after.rows[0].service_area, before.rows[0].service_area);
    assert.equal(after.rows[0].fact_operates_ol_site, before.rows[0].fact_operates_ol_site);
  });
});
