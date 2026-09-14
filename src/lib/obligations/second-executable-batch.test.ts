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
  SECOND_BATCH_DEMO_PATH,
  SECOND_BATCH_ENGINE_BINDINGS,
  SECOND_EXECUTABLE_BATCH_LIVE_KEYS,
  SECOND_EXECUTABLE_BATCH_RULE_IDS,
  applySecondExecutableBatchOverlay,
  secondBatchAssignmentOpensClock,
  secondBatchLiveEngineReady,
  secondBatchLiveFactsForRule,
  secondBatchParentIsWired,
  secondBatchPublicationStaysDeliberate,
  secondBatchSharedLiveKeyParents,
  secondExecutableBatchParents,
} from "./second-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

const DSP: StaffDutyFacts = {
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

const SEI: StaffDutyFacts = {
  ...DSP,
  staffId: "sei-1",
  assignedServiceCodes: ["SEI"],
};

const SED: StaffDutyFacts = {
  ...DSP,
  staffId: "sed-1",
  assignedServiceCodes: ["SED"],
};

const CMP: StaffDutyFacts = {
  ...DSP,
  staffId: "cmp-1",
  assignedServiceCodes: ["CMP"],
};

const DRIVER: StaffDutyFacts = {
  ...DSP,
  staffId: "driver-1",
  isTransporter: true,
};

const OFFICE: StaffDutyFacts = {
  ...DSP,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
  isTransporter: false,
};

describe("second executable batch — service assignment clocks", () => {
  it("overlays fixture logic onto the six imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = secondExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, SECOND_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.ok(secondBatchPublicationStaysDeliberate(rule), rule.id);
      assert.ok(secondBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.30");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay REQ-1.9 or the first-batch hire clocks", () => {
    const loaded = readCommittedCatalog();
    const umbrella = loaded.parents.find((r) => r.id === "REQ-1.9");
    assert.ok(umbrella);
    const next = applySecondExecutableBatchOverlay(umbrella);
    assert.equal(next.predicates.length, 0);
    assert.equal(secondBatchParentIsWired(next), false);
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applySecondExecutableBatchOverlay(orientation).predicates.length, 0);
  });

  it("keeps child elements off the staff-task queue and collapses shared live keys", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-30.6.b",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      { requirementRole: "parent", parentRequirementKey: null, liveKey: "acre_sei", id: "b" },
      { requirementRole: "parent", parentRequirementKey: null, liveKey: "acre_sei", id: "c" },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-30.6.b",
        liveKey: "acre_sei",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["b"],
    );
    assert.deepEqual(secondBatchSharedLiveKeyParents("acre_sei"), ["REQ-30.6.b", "REQ-30.6.c"]);
  });

  it("wires each live key through the existing engine surfaces", () => {
    for (const binding of SECOND_BATCH_ENGINE_BINDINGS) {
      const ready = secondBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "obligation", key);
      }
    }
    for (const key of SECOND_EXECUTABLE_BATCH_LIVE_KEYS) {
      assert.equal(
        secondBatchAssignmentOpensClock(key, {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "unknown",
        }),
        false,
        key,
      );
    }
    assert.equal(secondBatchAssignmentOpensClock("driving_record_transport", DRIVER), true);
    assert.equal(secondBatchAssignmentOpensClock("driving_record_transport", DSP), false);
    assert.equal(secondBatchAssignmentOpensClock("acre_sei", SEI), true);
    assert.equal(secondBatchAssignmentOpensClock("acre_sei", DSP), false);
    assert.equal(secondBatchAssignmentOpensClock("acre_sed", SED), true);
    assert.equal(secondBatchAssignmentOpensClock("acre_sed", DSP), false);
    assert.equal(secondBatchAssignmentOpensClock("cmp_cms_caregiver_comp", CMP), true);
    assert.equal(secondBatchAssignmentOpensClock("cmp_cms_caregiver_comp", DSP), false);
  });

  it("missing assignment facts stay questions — never silent N/A", () => {
    const facts = secondBatchLiveFactsForRule("REQ-1.30");
    assert.equal(facts[0]?.fact_id, "LIVE-transport_assignment");
    const unanswered = evaluateCatalogFact(facts[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /transport/i);
    const sei = evaluateCatalogFact(secondBatchLiveFactsForRule("REQ-30.6.b")[0]!, EMPTY_ORG_FACTS);
    assert.equal(sei.status, "unanswered");
    const designated = evaluateCatalogFact(
      secondBatchLiveFactsForRule("REQ-30.5")[0]!,
      EMPTY_ORG_FACTS,
    );
    assert.equal(designated.status, "unanswered");
    assert.match(designated.prompt, /designated|SSI|benefits/i);
  });

  it("documents a five-step demo path and simulates one parent task per live key", () => {
    assert.deepEqual(
      SECOND_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const acre = secondExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-30.6.b" || r.id === "REQ-30.6.c",
    );
    assert.equal(acre.length, 2);
    const result = simulateDraftRules({
      rules: acre,
      staff: [
        {
          ...SEI,
          hireDate: "2026-07-01",
          acreCertified: false,
          supervisorAcreCertified: true,
        },
        {
          ...OFFICE,
          hireDate: "2026-07-01",
          acreCertified: false,
          supervisorAcreCertified: true,
        },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["SEI"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
    });
    assert.equal(result.wroteDatabase, false);
    assert.equal(result.createdLiveAssignments, false);
    assert.equal(result.activatedRules, false);
    const seiStaff = result.staff.find((s) => s.staffId === "sei-1");
    assert.ok(seiStaff);
    assert.ok(seiStaff.rules.every((r) => r.applicability === "applies"));
    assert.ok(seiStaff.rules.every((r) => r.parentTaskCount === 1));
    const collapsed = staffTasksWithoutElementDuplicates(
      seiStaff.rules
        .filter((r) => r.task)
        .map((r) => ({
          id: r.ruleId,
          requirementRole: "parent" as const,
          liveKey: "acre_sei",
        })),
    );
    assert.equal(collapsed.length, 1);
    const office = result.staff.find((s) => s.staffId === "office-1");
    assert.ok(office?.rules.every((r) => r.applicability === "does_not_apply"));
  });
});
