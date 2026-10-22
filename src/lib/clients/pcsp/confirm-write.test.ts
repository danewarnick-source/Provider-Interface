import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcsp } from "./parser.ts";
import { proposeCarryOver } from "./carry-over.ts";
import { initialReview } from "./review.ts";
import { applyReviewedPcsp, pcspWrite, splitCodesByBilling } from "./confirm-write.ts";
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
  // Stand-in for apply_reviewed_pcsp: the same writes, all or nothing.
  const rpcCalls: { fn: string; args: Row }[] = [];
  let failRpc: string | null = null;
  async function rpc(fn: string, args: Row) {
    rpcCalls.push({ fn, args });
    if (fn !== "apply_reviewed_pcsp") return { data: null, error: { message: `unknown rpc ${fn}` } };
    if (failRpc) return { data: null, error: { message: failRpc } };
    const plan = args._plan as Row;
    if (plan.status === "current") {
      for (const p of tables.client_plans ?? []) if (p.client_id === args._client_id && p.status === "current") p.status = "past";
    }
    const planId = `client_plans-${++n}`;
    (tables.client_plans ??= []).push({
      id: planId, organization_id: args._organization_id, client_id: args._client_id, ...plan,
      source: "pcsp_upload", created_by: args._actor, document_id: args._document_id,
    });
    (args._goals as Row[]).forEach((g, sort) => {
      const { supports, ...goal } = g as Row & { supports: Row[] };
      const goalId = `client_goals-${++n}`;
      (tables.client_goals ??= []).push({ id: goalId, plan_id: planId, client_id: args._client_id, sort, kind: "goal", ...goal });
      supports.forEach((x, i) => (tables.client_goal_supports ??= []).push({ id: `s-${++n}`, goal_id: goalId, sort: i, ...x }));
    });
    for (const c of args._codes as Row[]) {
      const hit = tables.client_billing_codes.find((r) => r.client_id === args._client_id && r.service_code === c.service_code);
      if (hit) Object.assign(hit, c);
      else tables.client_billing_codes.push({ id: `client_billing_codes-${++n}`, ...c });
    }
    const client = tables.clients.find((c) => c.id === args._client_id)!;
    for (const [k, v] of Object.entries(args._client_patch as Row)) if (!String(client[k] ?? "").trim()) client[k] = v;
    for (const k of args._contacts as Row[]) tables.client_contacts.push({ id: `k-${++n}`, ...k });
    return { data: planId, error: null };
  }
  return { from, rpc, tables, rpcCalls, failNextRpc: (m: string) => { failRpc = m; } };
}

const parse = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
const seed = () => ({
  client_documents: [{ id: "doc-1", client_id: "c1", organization_id: "org", document_type: "pcsp" }],
  client_plans: [{ id: "old", client_id: "c1", status: "current" }],
  client_goals: [{ id: "g-cook", plan_id: "old", client_id: "c1", status: "active", goal_text: parse.goals[0].goal }],
  client_billing_codes: [{ id: "b-dsi", client_id: "c1", service_code: "DSI", rate_per_unit: 7 }],
  clients: [{ id: "c1", special_directions: "Allergic to cats.", about_me: null, phone_number: "555-0199" }],
  client_contacts: [{ id: "k1", client_id: "c1", name: "Casey Sample", sort: 0 }],
});
const args = (review: ReturnType<typeof initialReview>) => ({
  organizationId: "org", clientId: "c1", userId: "u1", documentId: "doc-1", review, now: "2026-08-21T00:00:00Z",
  canEditBilling: true,
});
const review = () => initialReview(parse, proposeCarryOver(parse.goals.map((g) => g.goal), [{ id: "g-cook", goal_text: parse.goals[0].goal }], parse.lastYearGoals));

test("confirm creates the plan, goals, supports, and contacts; must-knows and about me are left alone", async () => {
  const db = fakeDb(seed());
  // The plan year in the sample is in the future relative to "today" in some runs; force it current.
  const r = review();
  r.plan.start = "2000-01-01";
  const out = await applyReviewedPcsp(db, args(r));
  assert.deepEqual({ ...out, planId: typeof out.planId }, {
    planId: "string", goals: 3, supports: 6, codes: ["DSI", "HHS", "SEI"], contacts: 1,
    profile: ["PID", "date of birth", "address"], codesHeld: [],
  });
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
  assert.equal(client.special_directions, "Allergic to cats.");
  assert.equal(client.about_me, null);
  // Blank profile fields are filled; the phone a person typed is kept.
  assert.deepEqual([client.client_pid, client.date_of_birth, client.phone_number], ["0000000", "1990-01-02", "555-0199"]);
  // The support coordinator is already a contact (same name), so only the other provider is added.
  assert.equal(db.tables.client_contacts.length, 2);
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

test("a new support coordinator from the PCSP is added as the primary coordinator", async () => {
  const db = fakeDb({ ...seed(), client_contacts: [] });
  const out = await applyReviewedPcsp(db, args(review()));
  assert.equal(out.contacts, 2);
  const sc = db.tables.client_contacts[0];
  assert.deepEqual([sc.role, sc.name, sc.email, sc.is_primary], ["support_coordinator", "Casey Sample", "casey@example.test", true]);
});

test("without billing access the plan is saved but no service code changes", async () => {
  const db = fakeDb(seed());
  const r = review();
  r.plan.start = "2000-01-01";
  const codesBefore = JSON.stringify(db.tables.client_billing_codes);
  const out = await applyReviewedPcsp(db, { ...args(r), canEditBilling: false });
  assert.deepEqual(out.codes, []);
  assert.deepEqual(out.codesHeld, ["DSI", "HHS", "SEI"]);
  assert.equal(JSON.stringify(db.tables.client_billing_codes), codesBefore);
  assert.equal(out.goals, 3);
  assert.ok(db.tables.client_plans.some((p) => p.id === out.planId));
});

test("splitCodesByBilling holds every code back without billing access", () => {
  const rows = [{ service_code: "SLH" }, { service_code: "DSI" }];
  assert.deepEqual(splitCodesByBilling(rows, true), { write: rows, held: [] });
  assert.deepEqual(splitCodesByBilling(rows, false), { write: [], held: ["SLH", "DSI"] });
});

test("every write goes in one database call; a failure there leaves the old plan current", async () => {
  const db = fakeDb(seed());
  const before = JSON.stringify(db.tables);
  const r = review();
  r.plan.start = "2000-01-01";
  db.failNextRpc("forced failure part way");
  await assert.rejects(applyReviewedPcsp(db, args(r)), /forced failure part way/);
  // Nothing was written outside the transaction: the old plan is still current.
  assert.equal(JSON.stringify(db.tables), before);
  assert.equal(db.tables.client_plans.find((p) => p.id === "old")!.status, "current");
  assert.deepEqual(db.rpcCalls.map((c) => c.fn), ["apply_reviewed_pcsp"]);
  const sent = db.rpcCalls[0].args;
  assert.deepEqual(
    [sent._organization_id, sent._client_id, sent._actor, sent._document_id],
    ["org", "c1", "u1", "doc-1"],
  );
  assert.equal((sent._plan as { status: string }).status, "current");
});

test("pcspWrite: the plan status comes from its dates on the given day; codes are held without billing", () => {
  const r = review();
  r.plan.start = "2026-09-01";
  r.plan.end = "2027-08-31";
  const read = { currentGoalIds: new Set<string>(), client: {}, contacts: [], today: "2026-08-21" };
  const w = pcspWrite({ ...args(r), canEditBilling: false }, read);
  assert.equal(w.plan.status, "upcoming");
  assert.deepEqual(w.codes, []);
  assert.deepEqual(w.codesHeld, ["DSI", "HHS", "SEI"]);
  assert.equal(pcspWrite(args(r), { ...read, today: "2026-09-01" }).plan.status, "current");
  // A carried-over goal only points at a goal of the plan being replaced.
  assert.equal(w.goals[0].carried_from_goal_id ?? null, null);
});
