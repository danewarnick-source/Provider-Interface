import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NectarSource } from "./engine/ask-types.ts";
import { adminSourceHref, sourceLabel, staffSourceHref } from "./source-links.ts";

const DOC = "11111111-1111-4111-8111-111111111111";
const RULE = "22222222-2222-4222-8222-222222222222";
const SECTION = "33333333-3333-4333-8333-333333333333";
const CLIENT = "44444444-4444-4444-8444-444444444444";

function source(overrides: Partial<NectarSource>): NectarSource {
  return {
    id: SECTION,
    kind: "library",
    documentTitle: "Emergency procedures",
    heading: "Falls",
    version: 2,
    documentId: DOC,
    stateRuleId: null,
    clientId: null,
    ...overrides,
  };
}

const policy = source({});
const stateRule = source({
  kind: "state_rule",
  documentTitle: "DHHS91172 Scope of Work",
  heading: "1.10 Service documentation",
  version: 1,
  documentId: null,
  stateRuleId: RULE,
});
const plan = source({
  id: `goals:${CLIENT}`,
  kind: "client_plan",
  documentTitle: "Plan goals for a client",
  heading: null,
  version: null,
  documentId: null,
  clientId: CLIENT,
});
const meds = { ...plan, id: `meds:${CLIENT}`, kind: "medications" as const };
const schedule = source({
  id: "schedule:u1",
  kind: "schedule",
  documentId: null,
  version: null,
  heading: null,
});
const required = source({
  id: "agency:required",
  kind: "agency",
  documentId: null,
  version: null,
  heading: null,
});
const reviews = { ...required, id: "agency:reviews" };

describe("source chip labels (N6)", () => {
  it("names the document, section and version; client facts carry no version", () => {
    assert.equal(sourceLabel(policy), "Emergency procedures · Falls · v2");
    assert.equal(
      sourceLabel(stateRule),
      "DHHS91172 Scope of Work · 1.10 Service documentation · v1",
    );
    assert.equal(sourceLabel(plan), "Plan goals for a client");
    assert.equal(sourceLabel({ ...policy, heading: "  " }), "Emergency procedures · v2");
  });
});

describe("where an admin opens a source (N6)", () => {
  it("documents and state rules open in the Knowledge base", () => {
    assert.equal(adminSourceHref(policy), `/dashboard/hub/knowledge?doc=${DOC}`);
    assert.equal(adminSourceHref(stateRule), `/dashboard/hub/knowledge?rule=${RULE}`);
  });

  it("agency facts open the Required policies tab (reviews: the Reviews tab)", () => {
    assert.equal(adminSourceHref(required), "/dashboard/hub/knowledge?tab=required");
    assert.equal(adminSourceHref(reviews), "/dashboard/hub/knowledge?tab=reviews");
  });

  it("client facts open the client's care plan; shifts open the schedule", () => {
    assert.equal(adminSourceHref(plan), `/dashboard/clients/${CLIENT}?tab=care-plan`);
    assert.equal(adminSourceHref(meds), `/dashboard/clients/${CLIENT}?tab=care-plan`);
    assert.equal(adminSourceHref(schedule), "/dashboard/schedule");
    assert.equal(adminSourceHref({ ...policy, documentId: null }), null);
  });
});

describe("where a team member opens a source (N6)", () => {
  it("never the admin-only Knowledge base", () => {
    for (const s of [policy, stateRule, plan, meds, schedule, required]) {
      assert.doesNotMatch(staffSourceHref(s) ?? "", /hub\/knowledge|\/dashboard\/clients\//);
    }
  });

  it("a policy and a state rule section open read-only in their own Nectar, back to the same tab", () => {
    assert.equal(staffSourceHref(policy), `/dashboard/ask-nectar?doc=${DOC}`);
    assert.equal(
      staffSourceHref(policy, "policies"),
      `/dashboard/ask-nectar?tab=policies&doc=${DOC}`,
    );
    assert.equal(staffSourceHref(stateRule), `/dashboard/ask-nectar?section=${SECTION}`);
  });

  it("a client's plan or medications open in the client workspace; shifts open the schedule", () => {
    assert.equal(staffSourceHref(plan), `/dashboard/workspace/${CLIENT}?tab=about`);
    assert.equal(staffSourceHref(meds), `/dashboard/workspace/${CLIENT}?tab=emar`);
    assert.equal(staffSourceHref(schedule), "/dashboard/schedule");
  });

  it("agency facts (admin only) have nowhere to go", () => {
    assert.equal(staffSourceHref(required), null);
  });
});
