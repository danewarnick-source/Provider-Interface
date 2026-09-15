import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  TENTH_BATCH_DEMO_PATH,
  TENTH_BATCH_ENGINE_BINDINGS,
  TENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  TENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyTenthExecutableBatchOverlay,
  tenthBatchAssignmentOpensClock,
  tenthBatchLiveEngineReady,
  tenthBatchLiveFactsForRule,
  tenthBatchOmitsInventedQuarterlyOutcomesUpiAndRightsMod,
  tenthBatchParentIsWired,
  tenthBatchPublicationStaysDeliberate,
  tenthBatchSharedLiveKeyParents,
  tenthExecutableBatchParents,
} from "./tenth-executable-batch.ts";
import { applyNinthExecutableBatchOverlay } from "./ninth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

const STAFF: StaffDutyFacts = {
  ...UNKNOWN_STAFF_DUTY_FACTS,
  staffId: "dsp-1",
  role: "employee",
  assignmentsKnown: true,
  assignedClientIds: ["c1"],
  assignedServiceCodes: ["HHS"],
  transportsKnown: true,
  isTransporter: false,
  abiCaseloadKnown: true,
  hasAbiCaseload: false,
  requiresAbi: false,
  behaviorCaseloadKnown: true,
  hasBehaviorCaseload: false,
  requiresDeescalation: false,
  managerIdKnown: true,
  managerId: "mgr-1",
};

const OFFICE: StaffDutyFacts = {
  ...STAFF,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
};

describe("tenth executable batch — BC FBA/BSP twins", () => {
  it("overlays fixture logic onto the 41 imported twins without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = tenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, TENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(TENTH_EXECUTABLE_BATCH_RULE_IDS.length, 41);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (TENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(tenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(tenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.equal(liveObligationKeyForRule(rule), "fba_bsp", rule.id);
      assert.equal(rule.timing.kind, "none", rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-3.3.3");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay UPI 1.15, hire clocks, support strategies, or rights-mod twins", () => {
    const loaded = readCommittedCatalog();
    const upi = loaded.parents.find((r) => r.id === "REQ-1.15.1");
    assert.ok(upi);
    assert.equal(applyTenthExecutableBatchOverlay(upi).predicates.length, upi.predicates.length);
    assert.equal(tenthBatchParentIsWired(upi), false);
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applyTenthExecutableBatchOverlay(orientation).predicates.length, 0);
    const strategies = loaded.parents.find((r) => r.id === "REQ-1.24.5");
    assert.ok(strategies);
    assert.equal(applyTenthExecutableBatchOverlay(strategies).id, "REQ-1.24.5");
    assert.equal(tenthBatchParentIsWired(strategies), false);
    const rights = loaded.parents.find((r) => r.id === "REQ-3.4.3");
    assert.ok(rights);
    assert.equal(applyTenthExecutableBatchOverlay(rights).predicates.length, 0);
    assert.equal(tenthBatchParentIsWired(rights), false);
    const ninth = applyNinthExecutableBatchOverlay(loaded.parents.find((r) => r.id === "REQ-3.3.1")!);
    assert.equal(ninth.predicates.length, 0);
  });

  it("keeps child elements off the staff-task queue and shares one fba_bsp card", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-3.3.2",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "fba_bsp",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-3.3.2",
        liveKey: "fba_bsp",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(tenthBatchSharedLiveKeyParents("human_rights_plan"), []);
    assert.equal(tenthBatchSharedLiveKeyParents("fba_bsp").length, 41);
    assert.ok(tenthBatchSharedLiveKeyParents("fba_bsp").includes("REQ-3.3.1"));
    assert.ok(tenthBatchSharedLiveKeyParents("fba_bsp").includes("REQ-5.4.7"));
  });

  it("wires fba_bsp through the existing engine surfaces", () => {
    assert.deepEqual([...TENTH_EXECUTABLE_BATCH_LIVE_KEYS], ["fba_bsp"]);
    assert.equal(TENTH_BATCH_ENGINE_BINDINGS.length, 41);
    for (const row of TENTH_BATCH_ENGINE_BINDINGS) {
      const ready = tenthBatchLiveEngineReady(row);
      assert.equal(ready.ready, true, `${row.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(row.parentAssignment, "one", row.ruleId);
      assert.equal(row.mintsElementTasks, false, row.ruleId);
      assert.equal(row.trainingTitle, null, row.ruleId);
      assert.equal(row.formTitle, null, row.ruleId);
      assert.equal(row.disposition, "by_design", row.ruleId);
      for (const key of row.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "by_design", key);
        assert.deepEqual(entry.service_codes, ["BC1", "BC2", "BC3"]);
      }
    }
    assert.equal(tenthBatchAssignmentOpensClock("fba_bsp", EMPTY_ORG_FACTS), false);
    assert.equal(tenthBatchAssignmentOpensClock("fba_bsp", { ...EMPTY_ORG_FACTS, servicesOffered: ["BC1"] }), true);
    assert.equal(tenthBatchAssignmentOpensClock("fba_bsp", { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] }), false);
    assert.ok(tenthBatchOmitsInventedQuarterlyOutcomesUpiAndRightsMod());
  });

  it("missing BC awarded-code fact stays a question — never silent N/A", () => {
    const bc1 = tenthBatchLiveFactsForRule("REQ-3.3.1");
    assert.equal(bc1[0]?.fact_id, "FACT-010");
    const unanswered = evaluateCatalogFact(bc1[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /BC1/i);
    const bc2 = tenthBatchLiveFactsForRule("REQ-4.3.3");
    assert.equal(bc2[0]?.fact_id, "FACT-013");
    const bc3 = tenthBatchLiveFactsForRule("REQ-5.4.6");
    assert.equal(bc3[0]?.fact_id, "FACT-011");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      TENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = tenthExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-3.3.3" || r.id === "REQ-5.4.6",
    );
    assert.equal(screens.length, 2);
    const result = simulateDraftRules({
      rules: screens,
      staff: [
        { ...STAFF, hireDate: "2026-07-01" },
        { ...OFFICE, hireDate: "2026-07-01" },
      ],
      orgFacts: EMPTY_ORG_FACTS,
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
    });
    assert.equal(result.wroteDatabase, false);
    assert.equal(result.createdLiveAssignments, false);
    assert.equal(result.activatedRules, false);
  });
});
