import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminCaller, agencyDb, CLIENT, ORG, staffCaller } from "../engine/ask-fixtures.ts";
import {
  clientsForQuestion,
  clientsNamedIn,
  goalsFact,
  loadClientFacts,
  loadClientScope,
  MAX_STAFF_CARE_CLIENTS,
  medicationsFact,
  mustKnowsFact,
  type ScopedClient,
} from "./clients.ts";

function client(
  id: string,
  first: string,
  last: string,
  extra: Partial<ScopedClient> = {},
): ScopedClient {
  return {
    id,
    organization_id: ORG,
    first_name: first,
    last_name: last,
    pcsp_goals: [],
    special_directions: null,
    ...extra,
  };
}

const avery = client("c-1", "Avery", "Assigned");
const blake = client("c-2", "Blake", "Brook");

describe("which clients a question is about", () => {
  it("finds clients named by first or last name as a whole word", () => {
    assert.deepEqual(clientsNamedIn("What meds does avery take?", [avery, blake]), [avery]);
    assert.deepEqual(clientsNamedIn("Goals for Brook?", [avery, blake]), [blake]);
    assert.deepEqual(clientsNamedIn("Does Averyx have a plan?", [avery]), []);
    assert.deepEqual(clientsNamedIn("What are Avery's goals? And Brook’s?", [avery, blake]), [
      avery,
      blake,
    ]);
  });

  it("a team member's care question that names nobody covers their caseload, up to 6", () => {
    const many = Array.from({ length: 9 }, (_, i) => client(`c-${i}`, `Name${i}`, "Person"));
    assert.equal(
      clientsForQuestion("What are my clients' goals?", many, staffCaller).length,
      MAX_STAFF_CARE_CLIENTS,
    );
    assert.deepEqual(clientsForQuestion("Where is the fire extinguisher?", many, staffCaller), []);
    assert.deepEqual(
      clientsForQuestion("What are the goals?", many, adminCaller),
      [],
      "admins name the client",
    );
  });
});

describe("client facts", () => {
  it("goals come from the current plan's goals, else the older pcsp_goals column", () => {
    const fromPlan = goalsFact(avery, [
      { client_id: "c-1", plan_id: "p", goal_text: "Ride the bus alone", kind: "goal" },
      { client_id: "c-1", plan_id: "p", goal_text: "See the dentist", kind: "other_need" },
    ]);
    assert.equal(fromPlan?.text, "1. Ride the bus alone\n2. Other need: See the dentist");
    assert.equal(fromPlan?.id, "goals:c-1");
    assert.equal(fromPlan?.title, "Plan goals for Avery Assigned");
    assert.equal(goalsFact({ ...avery, pcsp_goals: ["Walk daily"] }, [])?.text, "1. Walk daily");
    assert.equal(goalsFact(avery, []), null);
  });

  it("must-knows come from the approved must-knows, else special directions", () => {
    assert.equal(
      mustKnowsFact({ ...avery, special_directions: "Old note" }, "Approved list")?.text,
      "Approved list",
    );
    assert.equal(
      mustKnowsFact({ ...avery, special_directions: "Old note" }, null)?.text,
      "Old note",
    );
    assert.equal(mustKnowsFact(avery, "  "), null);
  });

  it("the medication list carries dose, how often, how, PRN and choking notes", () => {
    const fact = medicationsFact(avery, [
      {
        client_id: "c-1",
        medication_name: "Examplol",
        strength: "10 mg",
        dosage: "1 tablet",
        frequency: "twice a day",
        route: "by mouth",
        instructions: null,
        is_prn: true,
        prn_instructions: "for pain",
        choking_risk: true,
        choking_risk_details: "crush first",
        adverse_effects: null,
        paused_at: null,
      },
    ]);
    assert.equal(fact?.kind, "medications");
    assert.equal(
      fact?.text,
      "- Examplol, 10 mg, 1 tablet, twice a day, by mouth. As needed (PRN): for pain. Choking risk: crush first",
    );
    assert.equal(medicationsFact(avery, []), null);
  });
});

describe("client scope comes from access, never the request", () => {
  it("staff view: the caller's caseload from clients_for_staff", async () => {
    const db = agencyDb();
    const scope = await loadClientScope(db.client, staffCaller);
    assert.deepEqual(
      scope.map((c) => c.id),
      [CLIENT.assigned],
    );
    assert.deepEqual(db.callsTo("clients_for_staff")[0]!.payload, {
      _org: ORG,
      _staff: staffCaller.userId,
    });
  });

  it("staff view without a user token: the direct staff_assignments rows", async () => {
    const db = agencyDb();
    db.onRpc("clients_for_staff", () => ({ data: null, error: { message: "not authenticated" } }));
    const scope = await loadClientScope(db.client, staffCaller);
    assert.deepEqual(
      scope.map((c) => c.id),
      [CLIENT.assigned],
    );
    assert.deepEqual(db.callsTo("staff_assignments")[0]!.filters, [
      ["eq", "organization_id", ORG],
      ["eq", "staff_id", staffCaller.userId],
    ]);
  });

  it("admin view: every client of the agency, for an agency-wide admin only", async () => {
    const db = agencyDb();
    assert.deepEqual((await loadClientScope(db.client, adminCaller)).length, 2);
    const notAgencyWide = await loadClientScope(db.client, { ...adminCaller, agencyAdmin: false });
    assert.deepEqual(
      notAgencyWide,
      [],
      "an admin without whole-agency scope gets their own caseload",
    );
  });

  it("drops a row from another agency even if the caseload returns it", async () => {
    const db = agencyDb();
    db.onRpc("clients_for_staff", () => ({
      data: [{ ...avery, organization_id: "other" }],
      error: null,
    }));
    assert.deepEqual(await loadClientScope(db.client, staffCaller), []);
  });

  it("facts are loaded only for the clients the question is about, in the caller's agency", async () => {
    const db = agencyDb();
    const { scope, facts } = await loadClientFacts(db.client, staffCaller, "What does Avery take?");
    assert.deepEqual(
      scope.map((c) => c.id),
      [CLIENT.assigned],
    );
    assert.deepEqual(
      facts.map((f) => f.id),
      [`goals:${CLIENT.assigned}`, `must-knows:${CLIENT.assigned}`, `meds:${CLIENT.assigned}`],
    );
    assert.deepEqual(db.callsTo("client_medications")[0]!.filters, [
      ["eq", "organization_id", ORG],
      ["in", "client_id", [CLIENT.assigned]],
      ["eq", "is_active", true],
      ["is", "discontinued_at", null],
    ]);
    const none = await loadClientFacts(
      agencyDb().client,
      staffCaller,
      "Where is the fire extinguisher?",
    );
    assert.deepEqual(none.facts, []);
  });

  it("works without the Clients rebuild tables, and reports a failed medication read", async () => {
    const db = agencyDb({ failing: ["client_goals", "client_plans", "client_must_knows"] });
    const { facts } = await loadClientFacts(db.client, staffCaller, "Avery's goals?");
    assert.equal(facts[0]!.text, "1. Walk to the park twice a week");
    await assert.rejects(
      loadClientFacts(
        agencyDb({ failing: ["client_medications"] }).client,
        staffCaller,
        "Avery's meds?",
      ),
      /Could not load medication lists/,
    );
  });
});
