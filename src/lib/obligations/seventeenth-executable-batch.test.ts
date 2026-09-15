import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  SEVENTEENTH_BATCH_DEMO_PATH,
  SEVENTEENTH_BATCH_ENGINE_BINDINGS,
  SEVENTEENTH_BATCH_HOLD_OUT_RULE_IDS,
  SEVENTEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applySeventeenthExecutableBatchOverlay,
  seventeenthBatchAssignmentOpensClock,
  seventeenthBatchExpectedLiveKey,
  seventeenthBatchLiveEngineReady,
  seventeenthBatchLiveFactsForRule,
  seventeenthBatchOfficialClause,
  seventeenthBatchOmitsBlockedFamilies,
  seventeenthBatchParentIsWired,
  seventeenthBatchPublicationStaysDeliberate,
  seventeenthBatchSharedLiveKeyParents,
  seventeenthExecutableBatchParents,
} from "./seventeenth-executable-batch.ts";
import { applySixteenthExecutableBatchOverlay } from "./sixteenth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { EXPLICIT_REQ_TO_LIVE_KEY, liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

describe("seventeenth executable batch — professional nursing leftovers", () => {
  it("overlays fixture logic onto the 21 leftover children without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = seventeenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 21);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(seventeenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(seventeenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      const expected = seventeenthBatchExpectedLiveKey(
        rule.id as (typeof SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number],
      );
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.ok(pred, rule.id);
      assert.equal(pred.catalogKey, expected, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-16.2.3");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("leaves product-blocked families unwired and does not invent monthly-summary keys", () => {
    const loaded = readCommittedCatalog();
    for (const id of SEVENTEENTH_BATCH_HOLD_OUT_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      if (!parent) continue;
      assert.equal(applySeventeenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(seventeenthBatchParentIsWired(parent), false, id);
      assert.equal(EXPLICIT_REQ_TO_LIVE_KEY[id], undefined, id);
    }
    const sixteenth = loaded.parents.find((r) => r.id === "REQ-1.27.1");
    assert.ok(sixteenth);
    assert.equal(applySeventeenthExecutableBatchOverlay(sixteenth).predicates.length, 0);
    const overlaid = applySixteenthExecutableBatchOverlay(sixteenth);
    assert.ok(overlaid.predicates.length > 0);
    assert.equal(seventeenthBatchParentIsWired(overlaid), false);
    assert.ok(seventeenthBatchOmitsBlockedFamilies());
    assert.equal(sowCatalogEntryByKey("pn_medical_care_plan")?.key, "pn_medical_care_plan");
    assert.notEqual(sowCatalogEntryByKey("pn_medical_care_plan")?.key, "sei_monthly_summary_upi");
  });

  it("keeps leftover children on the parent card and uses the two invented liveKeys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-16.2.3",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "pm_nursing_file",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-16.2.3",
        liveKey: "pm_nursing_file",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(seventeenthBatchSharedLiveKeyParents("pm_nursing_file"), [
      "REQ-16.2.3",
      "REQ-16.2.7",
      "REQ-16.2.8",
      "REQ-16.2.9",
      "REQ-16.4",
      "REQ-17.2.3",
      "REQ-17.2.7",
      "REQ-17.2.8",
      "REQ-17.2.9",
      "REQ-17.4",
    ]);
    assert.deepEqual(seventeenthBatchSharedLiveKeyParents("pn_medical_care_plan"), [
      "REQ-18.2.3",
      "REQ-18.5",
      "REQ-19.2.7",
      "REQ-19.2.8",
      "REQ-19.2.8.A",
      "REQ-19.2.8.B",
      "REQ-19.2.9.A",
      "REQ-19.2.9.B",
      "REQ-19.2.10",
      "REQ-19.5.a",
      "REQ-19.5.b",
    ]);
    assert.deepEqual(seventeenthBatchSharedLiveKeyParents("medication_record"), []);
  });

  it("wires the invented pack liveKeys through the live engine", () => {
    assert.deepEqual([...SEVENTEENTH_EXECUTABLE_BATCH_LIVE_KEYS], [
      "pm_nursing_file",
      "pn_medical_care_plan",
    ]);
    assert.equal(SEVENTEENTH_BATCH_ENGINE_BINDINGS.length, 21);
    for (const row of SEVENTEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = seventeenthBatchLiveEngineReady(row);
      assert.equal(ready.ready, true, `${row.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(row.parentAssignment, "one", row.ruleId);
      assert.equal(row.mintsElementTasks, false, row.ruleId);
      assert.equal(row.trainingTitle, null, row.ruleId);
      assert.equal(row.formTitle, null, row.ruleId);
      for (const key of row.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, row.disposition, key);
      }
    }
    assert.equal(seventeenthBatchAssignmentOpensClock("pm_nursing_file", EMPTY_ORG_FACTS), false);
    assert.equal(
      seventeenthBatchAssignmentOpensClock("pm_nursing_file", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["PM1"],
      }),
      true,
    );
    assert.equal(
      seventeenthBatchAssignmentOpensClock(
        "pm_nursing_file",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] },
        ["PM1"],
      ),
      false,
    );
    assert.equal(
      seventeenthBatchAssignmentOpensClock("pn_medical_care_plan", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["PN2"],
      }),
      true,
    );
    assert.equal(
      seventeenthBatchAssignmentOpensClock(
        "pn_medical_care_plan",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["PN2"] },
        ["PN1"],
      ),
      false,
    );
  });

  it("maps official catalog parent clause_text — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    for (const id of SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      const official = seventeenthBatchOfficialClause(id);
      const workbook = parent.workbookRow.clause_text;
      assert.equal(typeof workbook, "string", id);
      assert.equal(official, workbook, id);
      const overlaid = applySeventeenthExecutableBatchOverlay(parent);
      assert.equal(overlaid.group.members[0]?.label, official, id);
      assert.equal(overlaid.evidence.summary, official, id);
    }
  });

  it("missing awarded-code facts stay questions — never silent N/A", () => {
    const pm1 = seventeenthBatchLiveFactsForRule("REQ-16.2.3");
    assert.equal(pm1[0]?.fact_id, "FACT-023");
    const unanswered = evaluateCatalogFact(pm1[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /PM1/i);
    const pn2 = seventeenthBatchLiveFactsForRule("REQ-19.2.10");
    assert.equal(pn2[0]?.fact_id, "FACT-014");
    assert.equal(evaluateCatalogFact(pn2[0]!, EMPTY_ORG_FACTS).status, "unanswered");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      SEVENTEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = seventeenthExecutableBatchParents(loaded.parents);
    assert.equal(screens.length, 21);
    const result = simulateDraftRules({
      rules: screens,
      staff: [
        {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "admin-1",
          role: "admin",
          hireDate: "2026-07-01",
          acreCertified: null,
          supervisorAcreCertified: null,
        },
      ],
      orgFacts: EMPTY_ORG_FACTS,
      evidence: [],
      now: new Date("2026-09-15T12:00:00.000Z"),
    });
    assert.equal(result.wroteDatabase, false);
    assert.equal(result.createdLiveAssignments, false);
    assert.equal(result.activatedRules, false);
  });
});
