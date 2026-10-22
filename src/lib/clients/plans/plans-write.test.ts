import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendGoalsToCurrentPlan, importPlanYear, insertPlan, newGoalTexts } from "./plans-write.ts";

type Row = Record<string, unknown>;

/** Tiny in-memory stand-in for the Supabase query builder (eq filters only). */
function fakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = structuredClone(seed);
  let n = 0;
  const log: string[] = [];
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Array<[string, unknown]> = [];
    let op: "select" | "insert" | "update" = "select";
    let payload: Row | null = null;
    let headCount = false;
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (op === "insert") {
        const row = { id: `${table}-${++n}`, ...payload };
        rows.push(row);
        log.push(`insert ${table}`);
        return { data: [row], error: null };
      }
      if (op === "update") {
        const hit = match();
        for (const r of hit) Object.assign(r, payload);
        log.push(`update ${table} x${hit.length}`);
        return { data: hit, error: null };
      }
      const hit = match();
      return headCount ? { count: hit.length, data: null, error: null } : { data: hit, error: null };
    };
    const q = {
      select(_c?: string, opts?: { head?: boolean }) { headCount = !!opts?.head; return q; },
      insert(p: Row) { op = "insert"; payload = p; return q; },
      update(p: Row) { op = "update"; payload = p; return q; },
      eq(k: string, v: unknown) { filters.push([k, v]); return q; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: null }); },
      then(res: (v: unknown) => unknown) { return Promise.resolve(run()).then(res); },
    };
    return q;
  }
  return { from, tables, log };
}

const scope = { organizationId: "org", clientId: "c1" };

describe("newGoalTexts", () => {
  it("drops goals already on the plan and repeats", () => {
    assert.deepEqual(newGoalTexts(["Cook a meal"], [" cook  a MEAL ", "Walk", "walk", ""]), ["Walk"]);
  });
});

describe("insertPlan", () => {
  it("a new current plan retires the old current one", async () => {
    const db = fakeDb({ client_plans: [{ id: "old", client_id: "c1", status: "current" }] });
    const id = await insertPlan(db, { ...scope, source: "manual" });
    assert.equal(db.tables.client_plans.find((p) => p.id === "old")!.status, "past");
    assert.equal(db.tables.client_plans.find((p) => p.id === id)!.status, "current");
  });
  it("a future plan is upcoming and leaves the current plan alone", async () => {
    const db = fakeDb({ client_plans: [{ id: "old", client_id: "c1", status: "current" }] });
    await insertPlan(db, { ...scope, source: "manual", start_date: "2999-01-01", end_date: "2999-12-31" });
    assert.equal(db.tables.client_plans[0].status, "current");
    assert.equal(db.tables.client_plans[1].status, "upcoming");
  });
  it("links the PCSP document when given", async () => {
    const db = fakeDb({});
    await insertPlan(db, { ...scope, source: "pcsp_upload", document_id: "doc-1" });
    assert.equal(db.tables.client_plans[0].document_id, "doc-1");
  });
});

describe("appendGoalsToCurrentPlan", () => {
  it("adds only goals the plan doesn't have, with the given codes", async () => {
    const db = fakeDb({
      client_plans: [{ id: "p", client_id: "c1", status: "current" }],
      client_goals: [{ id: "g0", plan_id: "p", status: "active", goal_text: "Cook" }],
    });
    const added = await appendGoalsToCurrentPlan(db, { ...scope, goals: ["cook", "Walk"], codes: ["hhs"] });
    assert.equal(added, 1);
    assert.equal(db.tables.client_goals[1].goal_text, "Walk");
    assert.equal(db.tables.client_goals[1].sort, 1);
    assert.deepEqual(db.tables.client_goal_supports[0].our_codes, ["HHS"]);
    assert.equal(db.tables.client_goal_supports[0].support_text, "");
  });
});

describe("importPlanYear", () => {
  it("adds the imported plan year once", async () => {
    const db = fakeDb({ client_plans: [] });
    const fields = { plan_year: "01/01/2026 - 12/31/2026", pcsp_expiration_date: null };
    const id = await importPlanYear(db, { ...scope, ...fields });
    assert.ok(id);
    const plan = db.tables.client_plans[0];
    assert.equal(plan.start_date, "2026-01-01");
    assert.equal(plan.end_date, "2026-12-31");
    assert.equal(plan.source, "migrated");
    assert.equal(await importPlanYear(db, { ...scope, ...fields }), null);
    assert.equal(db.tables.client_plans.length, 1);
  });
  it("adds nothing without plan dates or a label", async () => {
    const db = fakeDb({ client_plans: [] });
    assert.equal(await importPlanYear(db, { ...scope, plan_year: null, pcsp_expiration_date: null }), null);
  });
});
