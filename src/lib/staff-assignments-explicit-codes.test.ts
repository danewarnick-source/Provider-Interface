// "No service codes means all codes" is gone. Every staff_assignments row
// lists its codes; NULL / [] grants nothing. These tests pin the readers and
// the single write path (setStaffClientCodes) to that rule.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadStaffDutyFactsInternal } from "./obligations/load-staff-duty-facts.functions.ts";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Minimal chainable Supabase fake: every query resolves to the rows for its table. */
function fakeSupabase(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const result = { data: tables[table] ?? [], error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "not", "order", "overlaps"]) {
        chain[m] = () => chain;
      }
      chain.maybeSingle = async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null });
      chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
      return chain;
    },
  };
}

describe("loadStaffDutyFactsInternal — NULL / [] codes contribute nothing", () => {
  const ORG = "org-1";
  const base = {
    organization_members: [
      { user_id: "s1", access_level: "staff", manager_id: null },
      { user_id: "s2", access_level: "staff", manager_id: null },
    ],
    clients: [],
    day_program_transport: [],
    behavior_support_clients: [],
    client_target_behaviors: [],
    profiles: [],
  };

  it("a NULL-code row adds no client and no code", async () => {
    const sb = fakeSupabase({
      ...base,
      staff_assignments: [
        { staff_id: "s1", client_id: "c1", service_codes: null },
        { staff_id: "s1", client_id: "c2", service_codes: [] },
        { staff_id: "s2", client_id: "c3", service_codes: ["dsi", "HHS"] },
      ],
    });
    const facts = await loadStaffDutyFactsInternal(sb, ORG, ["s1", "s2"]);
    assert.deepEqual(facts.get("s1")?.assignedClientIds, []);
    assert.deepEqual(facts.get("s1")?.assignedServiceCodes, []);
    assert.deepEqual(facts.get("s2")?.assignedClientIds, ["c3"]);
    assert.deepEqual([...(facts.get("s2")?.assignedServiceCodes ?? [])].sort(), ["DSI", "HHS"]);
  });
});

describe("setStaffClientCodes — the single write path", () => {
  const setup = src("./scheduler/setup.functions.ts");

  it("exports setStaffClientCodes and drops setClientCaseload", () => {
    assert.match(setup, /export const setStaffClientCodes = createServerFn/);
    assert.doesNotMatch(setup, /setClientCaseload/);
  });

  it("validates codes ⊆ clientAuthorizedCodes and gates on staff_roster edit + access_can_see_staff", () => {
    assert.match(setup, /resolveStaffClientCodes\(data\.codes, authorized\)/);
    assert.match(setup, /clientAuthorizedCodes\(/);
    assert.match(setup, /action: "edit_caseload"/);
  });

  it("never collapses to NULL / all codes", () => {
    assert.doesNotMatch(setup, /service_codes:\s*null/);
    assert.doesNotMatch(setup, /collapse/i);
    assert.doesNotMatch(setup, /scopes === null/);
  });

  it("add / remove go through the same writer and keep the assignment hooks", () => {
    assert.match(setup, /withCodeAdded\(existing\?\.service_codes, code\)/);
    assert.match(setup, /withCodeRemoved\(existing\.service_codes, data\.service_code\)/);
    assert.match(
      setup,
      /onStaffAssignmentCreatedInternal\(supabase, organizationId, staffId, clientId, codes\)/,
    );
    assert.match(setup, /onStaffAssignmentRemovedInternal\(supabase, organizationId, staffId\)/);
  });

  it("auto-fill only proposes staff assigned the shift's exact code", () => {
    assert.match(setup, /staffByClientCode/);
    assert.match(setup, /assignmentCodes\(a\.service_codes\)/);
  });
});

describe("scheduler — shifts only for an assigned code", () => {
  const sched = src("./scheduler/scheduler.functions.ts");

  it("saveShift checks the shift's code is on the staff member's assignment", () => {
    assert.match(
      sched,
      /assignmentCoversCode\(\s*\(data as \{ service_codes: string\[\] \| null \}\)\.service_codes,\s*code,?\s*\)/,
    );
    assert.match(sched, /data\.job_code,\s*staffName,/);
  });

  it("the code-less addToCaseload / removeFromCaseload writers are gone", () => {
    assert.doesNotMatch(sched, /export const addToCaseload/);
    assert.doesNotMatch(sched, /export const removeFromCaseload/);
  });
});

describe("readers never treat NULL / [] as all codes", () => {
  it("client-care-data: staff see only codes on their assignment row", () => {
    const s = src("./client-care-data.functions.ts");
    assert.match(s, /assignmentCoversCode\(myCodeScope\?\.service_codes, c\.service_code\)/);
    assert.doesNotMatch(s, /service_codes === null\s*\?\s*authorized_codes/);
  });

  it("company-obligations: a no-code row never qualifies for a per-client obligation", () => {
    const s = src("./company-obligations.functions.ts");
    assert.match(s, /codes\.length > 0 && arraysOverlapCaseInsensitive/);
  });

  it("smart-import commit writes explicit codes (client's authorized codes when the source has none)", () => {
    const s = src("./smart-import-commit.functions.ts");
    assert.match(s, /importAssignmentCodes\(\s*r\.service_codes,/);
    assert.doesNotMatch(s, /NULL = all of the client's authorized/);
    assert.doesNotMatch(s, /codes \?\? \[\]\)/);
  });

  it("smart-import review never stages [] as all codes", () => {
    const s = src("./smart-import-review.functions.ts");
    assert.match(s, /Pick at least one code, or remove this staff from the client\./);
    assert.doesNotMatch(s, /serviceCodes\.length === 0 \? null/);
  });

  it("financial HHP detection reads explicit CMP/CMS codes only", () => {
    for (const f of [
      "./financial-contractors.functions.ts",
      "./financial-employees.functions.ts",
      "./financial-totals.functions.ts",
    ]) {
      assert.match(src(f), /\.overlaps\("service_codes", \["CMP", "CMS"\]\)/, f);
    }
  });
});
