import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  catalogFactPrompts,
  evaluateCatalogFact,
} from "./catalog-fact-questions.ts";
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
    const applies = evaluateCatalogFact(SEI, { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS", "SEI"] });
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
});
