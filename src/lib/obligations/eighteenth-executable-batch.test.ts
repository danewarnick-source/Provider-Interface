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
  EIGHTEENTH_BATCH_DEMO_PATH,
  EIGHTEENTH_BATCH_ENGINE_BINDINGS,
  EIGHTEENTH_BATCH_HOLD_OUT_RULE_IDS,
  EIGHTEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyEighteenthExecutableBatchOverlay,
  eighteenthBatchAssignmentOpensClock,
  eighteenthBatchExpectedLiveKey,
  eighteenthBatchLiveEngineReady,
  eighteenthBatchLiveFactsForRule,
  eighteenthBatchOfficialClause,
  eighteenthBatchOmitsBlockedFamilies,
  eighteenthBatchParentIsWired,
  eighteenthBatchPublicationStaysDeliberate,
  eighteenthBatchSharedLiveKeyParents,
  eighteenthExecutableBatchParents,
} from "./eighteenth-executable-batch.ts";
import { applySeventeenthExecutableBatchOverlay } from "./seventeenth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

describe("eighteenth executable batch — combined inventable leftovers", () => {
  it("overlays fixture logic onto the 43 leftover children without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = eighteenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 43);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(eighteenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(eighteenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      const expected = eighteenthBatchExpectedLiveKey(
        rule.id as (typeof EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number],
      );
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.ok(pred, rule.id);
      assert.equal(pred.catalogKey, expected, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-33.2.a");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("leaves product-blocked families unwired and does not invent UPI or qualification umbrellas", () => {
    const loaded = readCommittedCatalog();
    for (const id of EIGHTEENTH_BATCH_HOLD_OUT_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      if (!parent) continue;
      assert.equal(applyEighteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(eighteenthBatchParentIsWired(parent), false, id);
    }
    const seventeenth = loaded.parents.find((r) => r.id === "REQ-16.2.3");
    assert.ok(seventeenth);
    assert.equal(applyEighteenthExecutableBatchOverlay(seventeenth).predicates.length, 0);
    const overlaid = applySeventeenthExecutableBatchOverlay(seventeenth);
    assert.ok(overlaid.predicates.length > 0);
    assert.equal(eighteenthBatchParentIsWired(overlaid), false);
    assert.ok(eighteenthBatchOmitsBlockedFamilies());
    assert.equal(sowCatalogEntryByKey("epr_program_file")?.key, "epr_program_file");
    assert.notEqual(sowCatalogEntryByKey("epr_program_file")?.key, "acre_sei");
    assert.equal(sowCatalogEntryByKey("milestone_rfs")?.key, "milestone_rfs");
  });

  it("keeps leftover children on the parent card and uses the ten invented liveKeys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-33.2.a",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "sjd_discovery_vocational",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-33.2.a",
        liveKey: "sjd_discovery_vocational",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("sjd_discovery_vocational"), [
      "REQ-33.2.a",
      "REQ-33.2.b",
      "REQ-33.2.c",
      "REQ-33.2.d",
      "REQ-33.2.e",
      "REQ-33.2.i",
      "REQ-33.2.j",
      "REQ-33.2.m",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("household_12plus_background"), [
      "REQ-11.3.1",
      "REQ-20.3.1",
      "REQ-22.3.2",
      "REQ-23.3.3",
      "REQ-24.3.2",
      "REQ-25.3.3",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("medicaid_eligibility_assist"), [
      "REQ-11.2.7",
      "REQ-20.2.7",
      "REQ-21.2.6",
      "REQ-31.2.3",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("dhhs_quality_remediation"), [
      "REQ-1.19",
      "REQ-1.19.1",
      "REQ-1.19.2",
      "REQ-1.19.3",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("program_day_to_day_staff"), [
      "REQ-7.3.4",
      "REQ-9.3.4",
      "REQ-10.3.1",
      "REQ-21.3.5",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("employment_assessment_fade"), [
      "REQ-28.2.3",
      "REQ-28.2.6",
      "REQ-29.2.a",
      "REQ-30.2.7",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("milestone_rfs"), [
      "REQ-34.3",
      "REQ-35.3",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("epr_program_file"), [
      "REQ-9.2.2",
      "REQ-9.2.8",
      "REQ-9.5.1",
      "REQ-9.5.2",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("bc_staff_qualifications"), [
      "REQ-3.6",
      "REQ-4.6",
      "REQ-5.6",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("rhs_housing_voucher"), [
      "REQ-21.3.8",
      "REQ-21.3.8.A",
      "REQ-21.3.8.B",
      "REQ-21.3.8.C",
    ]);
    assert.deepEqual(eighteenthBatchSharedLiveKeyParents("acre_sei"), []);
  });

  it("wires the invented pack liveKeys through the live engine", () => {
    assert.deepEqual([...EIGHTEENTH_EXECUTABLE_BATCH_LIVE_KEYS], [
      "sjd_discovery_vocational",
      "household_12plus_background",
      "medicaid_eligibility_assist",
      "dhhs_quality_remediation",
      "program_day_to_day_staff",
      "employment_assessment_fade",
      "milestone_rfs",
      "epr_program_file",
      "bc_staff_qualifications",
      "rhs_housing_voucher",
    ]);
    assert.equal(EIGHTEENTH_BATCH_ENGINE_BINDINGS.length, 43);
    for (const row of EIGHTEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = eighteenthBatchLiveEngineReady(row);
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
    assert.equal(
      eighteenthBatchAssignmentOpensClock("sjd_discovery_vocational", EMPTY_ORG_FACTS),
      false,
    );
    assert.equal(
      eighteenthBatchAssignmentOpensClock("sjd_discovery_vocational", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["SJD"],
      }),
      true,
    );
    assert.equal(
      eighteenthBatchAssignmentOpensClock(
        "sjd_discovery_vocational",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] },
        ["SJD"],
      ),
      false,
    );
    assert.equal(
      eighteenthBatchAssignmentOpensClock("epr_program_file", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["EPR"],
      }),
      true,
    );
    assert.equal(
      eighteenthBatchAssignmentOpensClock("dhhs_quality_remediation", EMPTY_ORG_FACTS),
      true,
    );
    assert.equal(
      eighteenthBatchAssignmentOpensClock(
        "rhs_housing_voucher",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["RHS"] },
        ["RHS"],
      ),
      true,
    );
  });

  it("maps official catalog parent clause_text — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    for (const id of EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      const official = eighteenthBatchOfficialClause(id);
      const workbook = parent.workbookRow.clause_text;
      assert.equal(typeof workbook, "string", id);
      assert.equal(official, workbook, id);
      const overlaid = applyEighteenthExecutableBatchOverlay(parent);
      assert.equal(overlaid.group.members[0]?.label, official, id);
      assert.equal(overlaid.evidence.summary, official, id);
    }
  });

  it("missing awarded-code facts stay questions — never silent N/A", () => {
    const sjd = eighteenthBatchLiveFactsForRule("REQ-33.2.a");
    assert.equal(sjd[0]?.fact_id, "FACT-002");
    const unanswered = evaluateCatalogFact(sjd[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /SJD/i);
    const epr = eighteenthBatchLiveFactsForRule("REQ-9.2.2");
    assert.equal(epr[0]?.fact_id, "FACT-012");
    assert.equal(evaluateCatalogFact(epr[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    assert.deepEqual(eighteenthBatchLiveFactsForRule("REQ-1.19"), []);
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      EIGHTEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = eighteenthExecutableBatchParents(loaded.parents);
    assert.equal(screens.length, 43);
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
