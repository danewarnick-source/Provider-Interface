import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENCY_SETUP_QUESTIONS,
  NON_QUESTION_FACT_DISPOSITIONS,
  RESIDENTIAL_HOST_HOME_CODES,
  SECTION_CODE_CALLOUTS,
  activeSectionCodeCallouts,
  agencySetupQuestionsBySection,
  isQuestionRequired,
  isQuestionVisible,
  isSectionVisible,
  requiredAgencySetupQuestions,
  workbookFactIds,
} from "./agency-setup-questions.ts";
import {
  COMPOUND_SPLIT_FACT_IDS,
  DEFERRED_FACTS,
  deferredFactsForRecord,
} from "./deferred-setup-facts.ts";

describe("agency setup questions — exhaustive workbook coverage", () => {
  it("accounts for every one of the 85 workbook fact_ids exactly once (compound splits excepted)", () => {
    const all = new Set(workbookFactIds());
    assert.equal(
      all.size,
      85,
      "the workbook itself changed size — update this expectation deliberately",
    );

    const counts = new Map<string, number>();
    const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const q of AGENCY_SETUP_QUESTIONS) for (const f of q.sourceFactIds) bump(f);
    for (const nd of NON_QUESTION_FACT_DISPOSITIONS) bump(nd.factId);
    for (const df of DEFERRED_FACTS) bump(df.factId);

    const missing = [...all].filter((id) => !counts.has(id));
    assert.deepEqual(missing, [], `workbook facts with no home anywhere: ${missing.join(", ")}`);

    const compoundSet = new Set(COMPOUND_SPLIT_FACT_IDS);
    const badDupes = [...counts.entries()].filter(([id, n]) => n > 1 && !compoundSet.has(id));
    assert.deepEqual(
      badDupes,
      [],
      `fact_ids claimed more than once without being declared compound: ${badDupes.map(([id]) => id).join(", ")}`,
    );

    const unknownIds = [...counts.keys()].filter((id) => !all.has(id));
    assert.deepEqual(
      unknownIds,
      [],
      `references to fact_ids the workbook does not contain: ${unknownIds.join(", ")}`,
    );
  });

  it("every sourceFactIds / duplicateOf reference resolves to a real workbook row", () => {
    // agency-setup-questions.ts and deferred-setup-facts.ts both throw at
    // import time if reqIdsFor()/workbookFact() sees an unknown fact_id —
    // reaching this line at all is half the proof. This asserts the other
    // half: every declared duplicateOf target is itself a real DEFERRED_FACTS row.
    const deferredIds = new Set(DEFERRED_FACTS.map((f) => f.factId));
    for (const f of DEFERRED_FACTS) {
      if (f.duplicateOf) {
        assert.ok(
          deferredIds.has(f.duplicateOf),
          `${f.factId} claims duplicateOf ${f.duplicateOf}, which is not a deferred fact`,
        );
      }
    }
  });

  it("never leaks workbook/requirement jargon into an owner-facing question", () => {
    for (const q of AGENCY_SETUP_QUESTIONS) {
      assert.doesNotMatch(q.question, /FACT-\d{3}/);
      assert.doesNotMatch(q.question, /REQ-/);
      if (q.help) assert.doesNotMatch(q.help, /FACT-\d{3}/);
    }
    for (const f of DEFERRED_FACTS) {
      assert.doesNotMatch(f.question, /FACT-\d{3}/);
      assert.doesNotMatch(f.question, /REQ-/);
    }
  });

  it("every required question carries at least one source requirement id, or documents why not", () => {
    for (const q of AGENCY_SETUP_QUESTIONS) {
      if (q.sourceRequirementIds.length === 0) {
        assert.ok(q.sourceNote, `${q.factKey} has no linked requirements and no explanatory note`);
      }
    }
  });
});

describe("agency setup questions — conditional sections", () => {
  it("RHS produces the residential section with an RHS-specific callout", () => {
    const ctx = { awardedCodes: ["RHS"] };
    assert.ok(isSectionVisible("residential_and_host_home", ctx));
    const callouts = activeSectionCodeCallouts(ctx);
    assert.ok(callouts.some((c) => c.id === "callout_rhs"));
    assert.ok(RESIDENTIAL_HOST_HOME_CODES.includes("RHS"));
  });

  it("PPS produces the residential section with a host-home-specific callout", () => {
    const ctx = { awardedCodes: ["PPS"] };
    assert.ok(isSectionVisible("residential_and_host_home", ctx));
    const callouts = activeSectionCodeCallouts(ctx);
    assert.ok(callouts.some((c) => c.id === "callout_hhs_pps"));
  });

  it("PBA produces a client-funds callout pointing at the existing PBA ledger", () => {
    const ctx = { awardedCodes: ["PBA"] };
    const callouts = activeSectionCodeCallouts(ctx);
    const pba = callouts.find((c) => c.id === "callout_pba");
    assert.ok(pba);
    assert.equal(pba?.section, "client_funds");
  });

  it("no awarded codes yet means no code-specific callouts fire", () => {
    assert.deepEqual(activeSectionCodeCallouts({ awardedCodes: [] }), []);
  });

  it("every SECTION_CODE_CALLOUTS entry targets a real section with at least one question", () => {
    for (const c of SECTION_CODE_CALLOUTS) {
      const inSection = AGENCY_SETUP_QUESTIONS.filter((q) => q.section === c.section);
      assert.ok(
        inSection.length > 0,
        `${c.id} targets section ${c.section}, which has no questions`,
      );
    }
  });

  it("sections group only their own questions and stay stable in count", () => {
    const grouped = agencySetupQuestionsBySection({ awardedCodes: ["SEI", "RHS", "PBA"] });
    const total = grouped.reduce((sum, s) => sum + s.questions.length, 0);
    assert.equal(total, AGENCY_SETUP_QUESTIONS.length);
  });
});

describe("agency setup questions — required-ness reacts to answers, never erases them", () => {
  it("awarding SEI adds exactly the sei_award_date question", () => {
    const without = requiredAgencySetupQuestions({ awardedCodes: [] });
    const withSei = requiredAgencySetupQuestions({ awardedCodes: ["SEI"] });
    const added = withSei.filter((q) => !without.some((w) => w.factKey === q.factKey));
    assert.deepEqual(
      added.map((q) => q.factKey),
      ["sei_award_date"],
    );
  });

  it("a question with no condition is required and visible regardless of awarded codes", () => {
    const q = AGENCY_SETUP_QUESTIONS.find((x) => x.factKey === "operates_ol_site")!;
    assert.equal(isQuestionVisible(q, { awardedCodes: [] }), true);
    assert.equal(isQuestionRequired(q, { awardedCodes: [] }), true);
  });
});

describe("deferred facts — every one has a real home, none is a fake placeholder", () => {
  it("every deferred fact declares a concrete storage strategy", () => {
    for (const f of DEFERRED_FACTS) {
      assert.ok(["existing_mechanism", "derived", "generic"].includes(f.storage.kind), f.factId);
    }
  });

  it("groups cleanly by which record type will surface them", () => {
    const totalByRecord =
      deferredFactsForRecord("staff_record").length +
      deferredFactsForRecord("client_record").length +
      deferredFactsForRecord("location_record").length +
      deferredFactsForRecord("assignment_record").length;
    assert.equal(totalByRecord, DEFERRED_FACTS.length);
  });
});
