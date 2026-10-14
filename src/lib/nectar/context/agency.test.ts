import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminCaller, agencyDb, DOC, STAFF, staffCaller } from "../engine/ask-fixtures.ts";
import {
  AGENCY_FACT_IDS,
  countsFact,
  loadAgencyFacts,
  requiredFact,
  reviewsFact,
} from "./agency.ts";

describe("agency facts (admin view only)", () => {
  it("team members and admins without whole-agency scope get none, and nothing is read", async () => {
    const db = agencyDb();
    assert.deepEqual(await loadAgencyFacts(db.client, staffCaller, "2026-10-14"), []);
    assert.deepEqual(
      await loadAgencyFacts(db.client, { ...adminCaller, agencyAdmin: false }, "2026-10-14"),
      [],
    );
    assert.equal(db.calls.length, 0);
  });

  it("required policies: X of Y published and current, then each slot that applies", () => {
    const fact = requiredFact(
      [
        { id: "grievances", code: "1.18(3)", label: "Grievances", applies_when: null, position: 1 },
        {
          id: "finances",
          code: "1.18(5)",
          label: "Personal finances",
          applies_when: "finances",
          position: 2,
        },
        {
          id: "health",
          code: "1.23",
          label: "Health and medication",
          applies_when: null,
          position: 3,
        },
      ],
      [
        {
          id: "d1",
          title: "Health Policy",
          required_slot: "health",
          library_status: "published",
          review_due: "2027-01-01",
          superseded_by: null,
        },
      ],
      { provides_transportation: true, manages_client_money: false },
      "2026-10-14",
    );
    assert.equal(fact.id, AGENCY_FACT_IDS.required);
    assert.equal(
      fact.text,
      [
        "1 of 2 required policies are published and current.",
        "Provides transportation: yes. Manages clients' personal money: no.",
        "- §1.18(3) Grievances: Missing",
        "- §1.23 Health and medication: Published (Health Policy)",
      ].join("\n"),
    );
  });

  it("reviews: how many of the people each policy is for reviewed its current version", () => {
    const fact = reviewsFact(
      [
        {
          id: "p1",
          title: "Medication Policy",
          version: 2,
          audience_all: true,
          policy_assigned_users: [],
        },
        {
          id: "p2",
          title: "Night Procedure",
          version: 1,
          audience_all: false,
          policy_assigned_users: ["u2"],
        },
      ],
      ["u1", "u2", "u3"],
      [
        { document_id: "p1", document_version: 2, user_id: "u1", signed_at: "2026-10-01" },
        { document_id: "p1", document_version: 1, user_id: "u2", signed_at: "2026-01-01" },
      ],
    );
    assert.equal(
      fact.text,
      "Reviews of the current version of each published policy and procedure:\n- Medication Policy v2: 1 of 3 reviewed\n- Night Procedure v1: 0 of 1 reviewed (selected people)",
    );
    assert.equal(reviewsFact([], ["u1"], []).text, "No policies or procedures are published yet.");
  });

  it("counts say when a number is unavailable instead of guessing", () => {
    assert.equal(
      countsFact({ activeMembers: 3, activeClients: 2, allClients: 5 }).text,
      "3 active team members. 2 active clients (5 in all).",
    );
    assert.equal(
      countsFact({ activeMembers: 3, activeClients: null, allClients: null }).text,
      "3 active team members. Client counts are unavailable.",
    );
  });

  it("an agency-wide admin gets the three facts for their own agency", async () => {
    const db = agencyDb();
    db.tables.policy_signatures!.push({
      id: "sig-1",
      document_id: DOC.forAll,
      document_version: 1,
      user_id: STAFF,
      signed_at: "2026-10-02",
    });
    const facts = await loadAgencyFacts(db.client, adminCaller, "2026-10-14");
    assert.deepEqual(
      facts.map((f) => f.id),
      ["agency:required", "agency:reviews", "agency:counts"],
    );
    assert.match(facts[0]!.text, /^1 of 2 required policies are published and current\./);
    assert.match(facts[1]!.text, /- Medication Policy v1: 1 of 3 reviewed/);
    assert.match(
      facts[1]!.text,
      /- Overnight Checks Procedure v1: 0 of 1 reviewed \(selected people\)/,
    );
    assert.equal(facts[2]!.text, "3 active team members. 2 active clients (2 in all).");
  });
});
