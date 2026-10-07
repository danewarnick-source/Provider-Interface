import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcsp } from "./parser.ts";
import { proposeCarryOver } from "./carry-over.ts";
import { initialReview } from "./review.ts";
import { applyReviewedPcsp } from "./confirm-write.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

type Row = Record<string, unknown>;

/** In-memory stand-in for the Supabase query builder (eq filters, insert/update/upsert). */
function fakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = structuredClone(seed);
  let n = 0;
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: [string, unknown][] = [];
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let payload: Row | Row[] = {};
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (op === "insert") {
        const added = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ id: `${table}-${++n}`, ...p }));
        rows.push(...added);
        return { data: added, error: null };
      }
      if (op === "upsert") {
        const out = (payload as Row[]).map((p) => {
          const hit = rows.find((r) => r.client_id === p.client_id && r.service_code === p.service_code);
          if (hit) return Object.assign(hit, p);
          const row = { id: `${table}-${++n}`, ...p };
          rows.push(row);
          return row;
        });
        return { data: out, error: null };
      }
      const hit = match();
      if (op === "update") for (const r of hit) Object.assign(r, payload);
      return { data: hit, error: null };
    };
    const q = {
      select() { return q; },
      insert(p: Row | Row[]) { op = "insert"; payload = p; return q; },
      update(p: Row) { op = "update"; payload = p; return q; },
      upsert(p: Row[]) { op = "upsert"; payload = p; return q; },
      eq(k: string, v: unknown) { filters.push([k, v]); return q; },
      maybeSingle() { return Promise.resolve({ data: run().data[0] ?? null, error: null }); },
      then(res: (v: unknown) => unknown) { return Promise.resolve(run()).then(res); },
    };
    return q;
  }
  return { from, tables };
}

const parse = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
const seed = () => ({
  client_documents: [{ id: "doc-1", client_id: "c1", organization_id: "org", document_type: "pcsp" }],
  client_plans: [{ id: "old", client_id: "c1", status: "current" }],
  client_goals: [{ id: "g-cook", plan_id: "old", client_id: "c1", status: "active", goal_text: parse.goals[0].goal }],
  client_billing_codes: [{ id: "b-dsi", client_id: "c1", service_code: "DSI", rate_per_unit: 7 }],
  clients: [{ id: "c1", special_directions: "Allergic to cats.", about_me: null }],
  client_contacts: [{ id: "k1", client_id: "c1", name: "Casey Sample", sort: 0 }],
});
const args = (review: ReturnType<typeof initialReview>) => ({
  organizationId: "org", clientId: "c1", userId: "u1", documentId: "doc-1", review, now: "2026-08-21T00:00:00Z",
});
const review = () => initialReview(parse, proposeCarryOver(parse.goals.map((g) => g.goal), [{ id: "g-cook", goal_text: parse.goals[0].goal }], parse.lastYearGoals));

test("confirm creates the plan, goals, supports, authorizations, must-knows and contacts; about me is left alone", async () => {
  const db = fakeDb(seed());
  // The plan year in the sample is in the future relative to "today" in some runs; force it current.
  const r = review();
  r.plan.start = "2000-01-01";
  const out = await applyReviewedPcsp(db, args(r));
  assert.deepEqual({ ...out, planId: typeof out.planId }, { planId: "string", goals: 3, supports: 6, codes: ["DSI", "HHS", "SEI"], contacts: 1 });
  const plans = db.tables.client_plans;
  assert.equal(plans.find((p) => p.id === "old")!.status, "past");
  const plan = plans.find((p) => p.id === out.planId)!;
  assert.equal(plan.document_id, "doc-1");
  assert.equal(plan.source, "pcsp_upload");
  const goals = db.tables.client_goals.filter((g) => g.plan_id === out.planId);
  assert.deepEqual(goals.map((g) => g.carried_from_goal_id ?? null), ["g-cook", null, null]);
  // The non-goal support paid to the agency is kept under "Other needs in the PCSP".
  assert.deepEqual([goals[2].goal_text, goals[2].kind], ["Other needs in the PCSP", "other_need"]);
  const other = db.tables.client_goal_supports.filter((x) => x.goal_id === goals[2].id);
  assert.deepEqual(other.map((x) => [x.support_text, x.our_codes]), [["Host home helps Pat with daily living.", ["HHS"]]]);
  const sup = db.tables.client_goal_supports;
  assert.deepEqual(sup[1].other_providers, [{ code: "BC2", provider: "Sample Behavior Group Inc" }]);
  assert.deepEqual(sup[0].health_needs, ["Kitchen safety: Staff stay within reach at the stove.", "Burns: Check that burners are off."]);
  assert.deepEqual(sup[0].our_codes, ["DSI"]);
  const dsi = db.tables.client_billing_codes.find((b) => b.service_code === "DSI")!;
  assert.equal(dsi.id, "b-dsi");
  assert.equal(dsi.rate_per_unit, 8.5);
  assert.equal(db.tables.client_billing_codes.length, 3);
  const client = db.tables.clients[0];
  assert.match(String(client.special_directions), /^Allergic to cats\.\n\nFrom PCSP 2000-01-01 – 2027-08-31:\n- Choking/);
  assert.equal(client.about_me, null);
  assert.equal(db.tables.client_contacts[1].role, "other_provider");
});

test("nothing is written when the review has problems or the document isn't this client's PCSP", async () => {
  const db = fakeDb(seed());
  const before = JSON.stringify(db.tables);
  const bad = review();
  bad.plan.end = null;
  await assert.rejects(applyReviewedPcsp(db, args(bad)), /start and end dates/);
  await assert.rejects(applyReviewedPcsp(db, { ...args(review()), documentId: "other" }), /wasn't found/);
  assert.equal(JSON.stringify(db.tables), before);
});
