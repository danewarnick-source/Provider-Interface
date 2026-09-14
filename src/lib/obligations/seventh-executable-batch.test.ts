import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNIVERSAL_STAFF_KEYS, UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  SEVENTH_BATCH_DEMO_PATH,
  SEVENTH_BATCH_ENGINE_BINDINGS,
  SEVENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  SEVENTH_EXECUTABLE_BATCH_RULE_IDS,
  applySeventhExecutableBatchOverlay,
  seventhBatchAssignmentOpensClock,
  seventhBatchLiveEngineReady,
  seventhBatchLiveFactsForRule,
  seventhBatchOmitsInventedQuarterlyOutcomesAndPn,
  seventhBatchParentIsWired,
  seventhBatchPublicationStaysDeliberate,
  seventhBatchSharedLiveKeyParents,
  seventhExecutableBatchParents,
} from "./seventh-executable-batch.ts";
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

describe("seventh executable batch — Article 1 enrollment + credential files", () => {
  it("overlays fixture logic onto the ten imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = seventhExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, SEVENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.ok(seventhBatchPublicationStaysDeliberate(rule), rule.id);
      assert.ok(seventhBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.9.2");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay hire clocks, monthly summaries, or the REQ-1.9 CE collision", () => {
    const loaded = readCommittedCatalog();
    const umbrella = loaded.parents.find((r) => r.id === "REQ-1.9");
    assert.ok(umbrella);
    assert.equal(applySeventhExecutableBatchOverlay(umbrella).predicates.length, 0);
    assert.equal(seventhBatchParentIsWired(umbrella), false);
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applySeventhExecutableBatchOverlay(orientation).predicates.length, 0);
    const monthly = loaded.parents.find((r) => r.id === "REQ-30.3.4");
    assert.ok(monthly);
    assert.equal(applySeventhExecutableBatchOverlay(monthly).predicates.length, 0);
  });

  it("keeps child elements off the staff-task queue and collapses shared enrollment", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.4.1",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "medicaid_enrollment",
        id: "a",
      },
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "medicaid_enrollment",
        id: "b",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.4.1",
        liveKey: "medicaid_enrollment",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(seventhBatchSharedLiveKeyParents("medicaid_enrollment"), [
      "REQ-1.4.1",
      "REQ-1.13",
    ]);
  });

  it("wires each live key through the existing engine surfaces", () => {
    for (const binding of SEVENTH_BATCH_ENGINE_BINDINGS) {
      const ready = seventhBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, binding.disposition, key);
      }
    }
    for (const key of UNIVERSAL_STAFF_KEYS) {
      if (!(SEVENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key)) continue;
      assert.equal(
        seventhBatchAssignmentOpensClock(key, STAFF),
        true,
        key,
      );
      assert.equal(
        seventhBatchAssignmentOpensClock(key, OFFICE),
        true,
        `${key} office`,
      );
    }
    assert.equal(seventhBatchAssignmentOpensClock("volunteer_training_file", STAFF, null), false);
    assert.equal(seventhBatchAssignmentOpensClock("volunteer_training_file", STAFF, false), false);
    assert.equal(seventhBatchAssignmentOpensClock("volunteer_training_file", STAFF, true), true);
    assert.equal(seventhBatchAssignmentOpensClock("medicaid_101_contractor", OFFICE), true);
    assert.ok(seventhBatchOmitsInventedQuarterlyOutcomesAndPn());
  });

  it("missing volunteer fact stays a question — never silent N/A", () => {
    const facts = seventhBatchLiveFactsForRule("REQ-1.6");
    assert.equal(facts[0]?.fact_id, "FACT-035");
    const unanswered = evaluateCatalogFact(facts[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /volunteer/i);
    const staffFacts = seventhBatchLiveFactsForRule("REQ-1.9.2");
    assert.equal(staffFacts[0]?.fact_id, "LIVE-staff_personnel_file");
    const staffQ = evaluateCatalogFact(staffFacts[0]!, EMPTY_ORG_FACTS);
    assert.equal(staffQ.status, "unanswered");
    assert.equal(seventhBatchLiveFactsForRule("REQ-1.7.1").length, 0);
  });

  it("documents a five-step demo path and simulates staff credential parents", () => {
    assert.deepEqual(
      SEVENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = seventhExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-1.9.2" || r.id === "REQ-1.9.7",
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
    const dsp = result.staff.find((s) => s.staffId === "dsp-1");
    assert.ok(dsp);
    assert.ok(dsp.rules.every((r) => r.applicability === "applies"));
    assert.ok(dsp.rules.every((r) => r.parentTaskCount === 1));
    const office = result.staff.find((s) => s.staffId === "office-1");
    assert.ok(office?.rules.every((r) => r.applicability === "applies"));
  });
});
