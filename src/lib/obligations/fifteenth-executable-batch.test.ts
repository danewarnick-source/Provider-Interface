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
  FIFTEENTH_BATCH_DEMO_PATH,
  FIFTEENTH_BATCH_ENGINE_BINDINGS,
  FIFTEENTH_BATCH_HOLD_OUT_RULE_IDS,
  FIFTEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyFifteenthExecutableBatchOverlay,
  fifteenthBatchAssignmentOpensClock,
  fifteenthBatchExpectedLiveKey,
  fifteenthBatchLiveEngineReady,
  fifteenthBatchLiveFactsForRule,
  fifteenthBatchOfficialClause,
  fifteenthBatchOmitsInventedUmbrellasAndMegaBC,
  fifteenthBatchParentIsWired,
  fifteenthBatchPublicationStaysDeliberate,
  fifteenthBatchSharedLiveKeyParents,
  fifteenthExecutableBatchParents,
} from "./fifteenth-executable-batch.ts";
import { applyFourteenthExecutableBatchOverlay } from "./fourteenth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { EXPLICIT_REQ_TO_LIVE_KEY, liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

const STAFF: StaffDutyFacts = {
  ...UNKNOWN_STAFF_DUTY_FACTS,
  staffId: "dsp-1",
  role: "employee",
  assignmentsKnown: true,
  assignedClientIds: ["c1"],
  assignedServiceCodes: ["HHS"],
  transportsKnown: true,
  isTransporter: true,
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
  isTransporter: false,
};

describe("fifteenth executable batch — Article 1 standing leftover children", () => {
  it("overlays fixture logic onto the 45 leftover children without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = fifteenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 45);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(fifteenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(fifteenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      const expected = fifteenthBatchExpectedLiveKey(
        rule.id as (typeof FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number],
      );
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.ok(pred, rule.id);
      assert.equal(pred.catalogKey, expected, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.6.1");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("holds out MEGA B rows and does not invent umbrellas or start MEGA C", () => {
    const loaded = readCommittedCatalog();
    for (const id of FIFTEENTH_BATCH_HOLD_OUT_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      assert.equal(applyFifteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(fifteenthBatchParentIsWired(parent), false, id);
    }
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-1.13.4"], undefined);
    assert.equal(loaded.parents.some((r) => r.id === "REQ-1.17"), false);
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-1.17"], "personnel_policies");
    for (const id of ["REQ-1.21", "REQ-1.35", "REQ-11.3.5", "REQ-11.3.6"]) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      assert.equal(applyFifteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(fifteenthBatchParentIsWired(parent), false, id);
    }
    const evac = loaded.parents.find((r) => r.id === "REQ-11.3.6");
    assert.ok(evac);
    const fourteenth = applyFourteenthExecutableBatchOverlay(evac);
    assert.ok(fourteenth.predicates.length > 0);
    assert.equal(fifteenthBatchParentIsWired(fourteenth), false);
    assert.ok(fifteenthBatchOmitsInventedUmbrellasAndMegaBC());
  });

  it("keeps leftover children on the parent card and uses existing liveKeys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.6",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "volunteer_training_file",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.6.1",
        liveKey: "volunteer_training_file",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(fifteenthBatchSharedLiveKeyParents("incident_reporting_process"), []);
    assert.deepEqual(fifteenthBatchSharedLiveKeyParents("hrc_committee"), []);
    assert.deepEqual(fifteenthBatchSharedLiveKeyParents("volunteer_training_file"), [
      "REQ-1.6.1",
      "REQ-1.6.2.B",
      "REQ-1.6.3",
      "REQ-1.6.3.B",
      "REQ-1.6.3.F",
    ]);
    assert.deepEqual(fifteenthBatchSharedLiveKeyParents("medicaid_disclosure_annual"), [
      "REQ-1.13.5",
    ]);
    assert.deepEqual(fifteenthBatchSharedLiveKeyParents("personnel_policies"), [
      "REQ-1.17.a",
      "REQ-1.17.b",
    ]);
    assert.deepEqual(fifteenthBatchSharedLiveKeyParents("medical_dental_exams"), ["REQ-1.23.h"]);
  });

  it("wires existing pack liveKeys through the live engine", () => {
    assert.deepEqual([...FIFTEENTH_EXECUTABLE_BATCH_LIVE_KEYS], [
      "volunteer_training_file",
      "medicaid_manuals_memo",
      "medicaid_change_notifications",
      "medicaid_disclosure_annual",
      "governing_board_records",
      "personnel_policies",
      "operating_policies",
      "person_discharge_process",
      "health_support_policies",
      "medication_record",
      "medical_dental_exams",
      "emergency_loan_record",
      "driving_record_transport",
    ]);
    assert.equal(FIFTEENTH_BATCH_ENGINE_BINDINGS.length, 45);
    for (const row of FIFTEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = fifteenthBatchLiveEngineReady(row);
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
      fifteenthBatchAssignmentOpensClock("volunteer_training_file", STAFF, {
        uses_volunteers: null,
        has_governing_board: null,
      }),
      false,
    );
    assert.equal(
      fifteenthBatchAssignmentOpensClock("volunteer_training_file", STAFF, {
        uses_volunteers: true,
        has_governing_board: null,
      }),
      true,
    );
    assert.equal(
      fifteenthBatchAssignmentOpensClock("governing_board_records", STAFF, {
        uses_volunteers: true,
        has_governing_board: false,
      }),
      false,
    );
    assert.equal(
      fifteenthBatchAssignmentOpensClock("governing_board_records", STAFF, {
        uses_volunteers: true,
        has_governing_board: true,
      }),
      true,
    );
    assert.equal(
      fifteenthBatchAssignmentOpensClock("driving_record_transport", STAFF, {
        uses_volunteers: null,
        has_governing_board: null,
      }),
      true,
    );
    assert.equal(
      fifteenthBatchAssignmentOpensClock("driving_record_transport", OFFICE, {
        uses_volunteers: null,
        has_governing_board: null,
      }),
      false,
    );
    assert.equal(
      fifteenthBatchAssignmentOpensClock("medicaid_disclosure_annual", STAFF, {
        uses_volunteers: null,
        has_governing_board: null,
      }),
      true,
    );
  });

  it("maps official catalog parent clause_text — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    for (const id of FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      const official = fifteenthBatchOfficialClause(id);
      const workbook = parent.workbookRow.clause_text;
      assert.equal(typeof workbook, "string", id);
      assert.equal(official, workbook, id);
      const overlaid = applyFifteenthExecutableBatchOverlay(parent);
      assert.equal(overlaid.group.members[0]?.label, official, id);
      assert.equal(overlaid.evidence.summary, official, id);
    }
  });

  it("missing volunteer and board facts stay questions — never silent N/A", () => {
    const volunteer = fifteenthBatchLiveFactsForRule("REQ-1.6.1");
    assert.equal(volunteer[0]?.fact_id, "FACT-035");
    const unanswered = evaluateCatalogFact(volunteer[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /volunteer/i);
    const board = fifteenthBatchLiveFactsForRule("REQ-1.14.1");
    assert.equal(board[0]?.fact_id, "FACT-057");
    assert.equal(evaluateCatalogFact(board[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    assert.equal(fifteenthBatchLiveFactsForRule("REQ-1.7.3").length, 0);
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      FIFTEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = fifteenthExecutableBatchParents(loaded.parents);
    assert.equal(screens.length, 45);
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
