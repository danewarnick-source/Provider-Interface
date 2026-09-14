import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import { catalogFactPrompts, evaluateCatalogFact } from "./catalog-fact-questions.ts";
import type { CatalogFact } from "./draft-rules/catalog-loader.ts";

const SEI: CatalogFact = {
  fact_id: "FACT-008",
  question: "Agency awarded SEI?",
};
const TRANSPORT: CatalogFact = {
  fact_id: "FACT-003",
  question: "Does the agency provide transportation? Which staff drive?",
};
const UNKNOWN: CatalogFact = {
  fact_id: "FACT-054",
  question: "Client age",
};

describe("catalog applicability facts", () => {
  it("never silently N/A when awarded codes are unanswered", () => {
    const row = evaluateCatalogFact(SEI, EMPTY_ORG_FACTS);
    assert.equal(row.status, "unanswered");
    assert.equal(row.source, "awarded_service_codes");
    assert.match(row.prompt, /SEI/);
  });

  it("resolves awarded-code facts from the live company-profile list", () => {
    const applies = evaluateCatalogFact(SEI, {
      ...EMPTY_ORG_FACTS,
      servicesOffered: ["HHS", "SEI"],
    });
    const skip = evaluateCatalogFact(SEI, { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] });
    assert.equal(applies.status, "applies");
    assert.equal(skip.status, "does_not_apply");
  });

  it("prompts unanswered facts instead of inventing N/A", () => {
    const prompts = catalogFactPrompts([SEI, TRANSPORT, UNKNOWN], EMPTY_ORG_FACTS);
    assert.ok(prompts.includes("Which DSPD service codes is this contractor awarded?"));
    assert.ok(prompts.some((p) => /transportation/i.test(p)));
    assert.ok(prompts.some((p) => /Client age/.test(p)));
    assert.equal(evaluateCatalogFact(UNKNOWN, EMPTY_ORG_FACTS).status, "unanswered");
  });

  it("maps first-batch live assignment facts without coercing N/A", () => {
    const hire = evaluateCatalogFact(
      {
        fact_id: "LIVE-direct_support_assignment",
        question: "Which staff have a direct-support assignment?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(hire.source, "staff_assignment");
    assert.equal(hire.status, "unanswered");
    const abi = evaluateCatalogFact(
      {
        fact_id: "LIVE-abi_caseload",
        question: "Which persons have acquired brain injury, and which staff serve them?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(abi.source, "abi_caseload");
    assert.equal(abi.status, "unanswered");
  });

  it("maps second-batch assignment facts without coercing N/A", () => {
    const transport = evaluateCatalogFact(
      {
        fact_id: "LIVE-transport_assignment",
        question: "Which staff transport persons?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(transport.source, "transport_assignment");
    assert.equal(transport.status, "unanswered");
    const sei = evaluateCatalogFact(
      {
        fact_id: "LIVE-sei_assignment",
        question: "Which staff are assigned to an SEI authorization?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(sei.source, "staff_assignment");
    assert.equal(sei.status, "unanswered");
  });

  it("maps third-batch SJD / Discovery facts without coercing N/A", () => {
    const sjd = evaluateCatalogFact(
      {
        fact_id: "LIVE-sjd_assignment",
        question: "Which staff are assigned to an SJD authorization?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(sjd.source, "staff_assignment");
    assert.equal(sjd.status, "unanswered");
    const discovery = evaluateCatalogFact(
      {
        fact_id: "LIVE-sjd_discovery",
        question: "Which SJD staff perform Discovery?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(discovery.source, "staff_assignment");
    assert.equal(discovery.status, "unanswered");
    const award = evaluateCatalogFact(
      {
        fact_id: "LIVE-sei_award_date",
        question: "When was this contractor awarded SEI?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(award.status, "unanswered");
  });

  it("maps fourth-batch periodic monthly facts without coercing N/A", () => {
    const periodic = evaluateCatalogFact(
      {
        fact_id: "LIVE-periodic_report_assignment",
        question:
          "Which persons received a service that requires a monthly or quarterly progress report?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(periodic.source, "staff_assignment");
    assert.equal(periodic.status, "unanswered");
    const seiMonthly = evaluateCatalogFact(
      {
        fact_id: "LIVE-sei_monthly_caseload",
        question: "Which persons have an active SEI authorization this month?",
      },
      EMPTY_ORG_FACTS,
    );
    assert.equal(seiMonthly.source, "awarded_service_codes");
    assert.equal(seiMonthly.status, "unanswered");
    assert.deepEqual(seiMonthly.awardedCodes, ["SEI"]);
  });
});
