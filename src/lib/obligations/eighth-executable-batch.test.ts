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
  EIGHTH_BATCH_DEMO_PATH,
  EIGHTH_BATCH_ENGINE_BINDINGS,
  EIGHTH_EXECUTABLE_BATCH_LIVE_KEYS,
  EIGHTH_EXECUTABLE_BATCH_RULE_IDS,
  applyEighthExecutableBatchOverlay,
  eighthBatchAssignmentOpensClock,
  eighthBatchLiveEngineReady,
  eighthBatchLiveFactsForRule,
  eighthBatchOmitsInventedQuarterlyOutcomesAndPn,
  eighthBatchParentIsWired,
  eighthBatchPublicationStaysDeliberate,
  eighthBatchSharedLiveKeyParents,
  eighthExecutableBatchParents,
} from "./eighth-executable-batch.ts";
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

describe("eighth executable batch — Article 1 org policy / process files", () => {
  it("overlays fixture logic onto the nine imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = eighthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, EIGHTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.ok(eighthBatchPublicationStaysDeliberate(rule), rule.id);
      assert.ok(eighthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.18");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay children, Mega A credentials, or Mega C leftovers", () => {
    const loaded = readCommittedCatalog();
    const child = loaded.parents.find((r) => r.id === "REQ-1.22.c.1");
    assert.ok(child);
    assert.equal(applyEighthExecutableBatchOverlay(child).predicates.length, 0);
    assert.equal(eighthBatchParentIsWired(child), false);
    const boardChild = loaded.parents.find((r) => r.id === "REQ-1.14.1");
    assert.ok(boardChild);
    assert.equal(applyEighthExecutableBatchOverlay(boardChild).predicates.length, 0);
    const megaA = loaded.parents.find((r) => r.id === "REQ-1.9.2");
    assert.ok(megaA);
    assert.equal(applyEighthExecutableBatchOverlay(megaA).predicates.length, 0);
    const leftover = loaded.parents.find((r) => r.id === "REQ-1.35");
    assert.ok(leftover);
    assert.equal(applyEighthExecutableBatchOverlay(leftover).predicates.length, 0);
  });

  it("keeps child elements off the staff-task queue and keeps loan keys separate", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.18",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "operating_policies",
        id: "a",
      },
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "operating_policies",
        id: "b",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.18",
        liveKey: "operating_policies",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(eighthBatchSharedLiveKeyParents("emergency_loan_record"), ["REQ-1.28.7"]);
    assert.deepEqual(eighthBatchSharedLiveKeyParents("large_loan_disclosure_process"), [
      "REQ-1.28.7.G",
    ]);
  });

  it("wires each live key through the existing engine surfaces", () => {
    for (const binding of EIGHTH_BATCH_ENGINE_BINDINGS) {
      const ready = eighthBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      assert.equal(binding.formTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, binding.disposition, key);
      }
    }
    assert.equal(EIGHTH_EXECUTABLE_BATCH_LIVE_KEYS.length, 9);
    assert.equal(
      eighthBatchAssignmentOpensClock("zoning_life_safety", {
        operates_ol_site: null,
        has_governing_board: null,
        servicesOffered: [],
      }),
      false,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("zoning_life_safety", {
        operates_ol_site: false,
        has_governing_board: true,
        servicesOffered: ["HHS"],
      }),
      false,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("zoning_life_safety", {
        operates_ol_site: true,
        has_governing_board: false,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("governing_board_records", {
        operates_ol_site: true,
        has_governing_board: null,
        servicesOffered: ["HHS"],
      }),
      false,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("governing_board_records", {
        operates_ol_site: true,
        has_governing_board: true,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("human_rights_plan", {
        operates_ol_site: true,
        has_governing_board: true,
        servicesOffered: [],
      }),
      false,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("human_rights_plan", {
        operates_ol_site: true,
        has_governing_board: true,
        servicesOffered: ["CHA", "HSQ", "PBA"],
      }),
      false,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("human_rights_plan", {
        operates_ol_site: true,
        has_governing_board: true,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      eighthBatchAssignmentOpensClock("operating_policies", {
        operates_ol_site: null,
        has_governing_board: null,
        servicesOffered: [],
      }),
      true,
    );
    assert.ok(eighthBatchOmitsInventedQuarterlyOutcomesAndPn());
  });

  it("missing OL-site and board facts stay questions — never silent N/A", () => {
    const zoning = eighthBatchLiveFactsForRule("REQ-1.11");
    assert.equal(zoning[0]?.fact_id, "FACT-069");
    const unanswered = evaluateCatalogFact(zoning[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /zoning|licensed|Life Safety/i);
    const board = eighthBatchLiveFactsForRule("REQ-1.14");
    assert.equal(board[0]?.fact_id, "FACT-070");
    const boardQ = evaluateCatalogFact(board[0]!, EMPTY_ORG_FACTS);
    assert.equal(boardQ.status, "unanswered");
    assert.equal(eighthBatchLiveFactsForRule("REQ-1.18").length, 0);
    assert.equal(eighthBatchLiveFactsForRule("REQ-1.28.7").length, 0);
  });

  it("documents a five-step demo path and simulates standing policy parents", () => {
    assert.deepEqual(
      EIGHTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = eighthExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-1.18" || r.id === "REQ-1.23",
    );
    assert.equal(screens.length, 2);
    const result = simulateDraftRules({
      rules: screens,
      staff: [
        { ...STAFF, hireDate: "2026-07-01" },
        { ...OFFICE, hireDate: "2026-07-01" },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] },
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
