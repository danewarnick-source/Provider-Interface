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
  NINTH_BATCH_DEMO_PATH,
  NINTH_BATCH_ENGINE_BINDINGS,
  NINTH_EXECUTABLE_BATCH_LIVE_KEYS,
  NINTH_EXECUTABLE_BATCH_RULE_IDS,
  applyNinthExecutableBatchOverlay,
  ninthBatchAssignmentOpensClock,
  ninthBatchLiveEngineReady,
  ninthBatchLiveFactsForRule,
  ninthBatchOmitsInventedQuarterlyOutcomesAndPn,
  ninthBatchParentIsWired,
  ninthBatchPublicationStaysDeliberate,
  ninthBatchSharedLiveKeyParents,
  ninthExecutableBatchParents,
} from "./ninth-executable-batch.ts";
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

describe("ninth executable batch — Article 1.15 UPI / USTEPS ops", () => {
  it("overlays fixture logic onto the fifteen imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = ninthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, NINTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) => row.ruleId.startsWith("REQ-1.15.")),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(ninthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(ninthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.15.1");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay REQ-1.4.2, hire clocks, FBA/BSP, or monthly UPI summaries", () => {
    const loaded = readCommittedCatalog();
    const accounts = loaded.parents.find((r) => r.id === "REQ-1.4.2");
    assert.ok(accounts);
    assert.equal(applyNinthExecutableBatchOverlay(accounts).predicates.length, 0);
    assert.equal(ninthBatchParentIsWired(accounts), false);
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applyNinthExecutableBatchOverlay(orientation).predicates.length, 0);
    const monthly = loaded.parents.find((r) => r.id === "REQ-30.3.4");
    assert.ok(monthly);
    assert.equal(applyNinthExecutableBatchOverlay(monthly).predicates.length, 0);
    const fba = loaded.parents.find((r) => r.id === "REQ-1.24.5");
    assert.ok(fba);
    assert.equal(applyNinthExecutableBatchOverlay(fba).id, "REQ-1.24.5");
    assert.equal(ninthBatchParentIsWired(fba), false);
  });

  it("keeps child elements off the staff-task queue and does not share usteps_upi_accounts", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.15.1",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "upi_form_0_9_designee",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.15.1",
        liveKey: "upi_form_0_9_designee",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(ninthBatchSharedLiveKeyParents("usteps_upi_accounts"), []);
    assert.deepEqual(ninthBatchSharedLiveKeyParents("upi_form_0_9_designee"), ["REQ-1.15.1"]);
  });

  it("wires each live key through the existing engine surfaces", () => {
    assert.equal(NINTH_EXECUTABLE_BATCH_LIVE_KEYS.length, 15);
    assert.equal(NINTH_BATCH_ENGINE_BINDINGS.length, 15);
    for (const row of NINTH_BATCH_ENGINE_BINDINGS) {
      const ready = ninthBatchLiveEngineReady(row);
      assert.equal(ready.ready, true, `${row.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(row.parentAssignment, "one", row.ruleId);
      assert.equal(row.mintsElementTasks, false, row.ruleId);
      assert.equal(row.trainingTitle, null, row.ruleId);
      for (const key of row.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, row.disposition, key);
      }
    }
    assert.equal(ninthBatchAssignmentOpensClock("upi_form_0_9_designee"), true);
    assert.ok(ninthBatchOmitsInventedQuarterlyOutcomesAndPn());
    assert.equal(sowCatalogEntryByKey("upi_1056_utilization")?.disposition, "by_design");
  });

  it("missing UPI-access staff fact stays a question — never silent N/A", () => {
    const facts = ninthBatchLiveFactsForRule("REQ-1.15.2");
    assert.equal(facts[0]?.fact_id, "FACT-009");
    const unanswered = evaluateCatalogFact(facts[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /UPI access/i);
    assert.equal(ninthBatchLiveFactsForRule("REQ-1.15.10").length, 0);
    const auth = ninthBatchLiveFactsForRule("REQ-1.15.4");
    assert.equal(auth[0]?.fact_id, "LIVE-authorization_1056");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      NINTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = ninthExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-1.15.1" || r.id === "REQ-1.15.7",
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
