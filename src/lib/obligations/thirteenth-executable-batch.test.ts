import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { DHHS91172_CATALOG_DIR, readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  THIRTEENTH_BATCH_DEMO_PATH,
  THIRTEENTH_BATCH_ENGINE_BINDINGS,
  THIRTEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyThirteenthExecutableBatchOverlay,
  thirteenthBatchAssignmentOpensClock,
  thirteenthBatchLiveEngineReady,
  thirteenthBatchLiveFactsForRule,
  thirteenthBatchOmitsHoldoutsUmbrellasEvacAndInventedKeys,
  thirteenthBatchParentIsWired,
  thirteenthBatchPublicationStaysDeliberate,
  thirteenthBatchSharedLiveKeyParents,
  thirteenthExecutableBatchParents,
} from "./thirteenth-executable-batch.ts";
import { applyMegaCExecutableBatchOverlay } from "./mega-c-executable-batch.ts";
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

const EXPECTED_LIVE_KEY: Record<(typeof THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number], string> = {
  "REQ-7.5.a": "ol_day_tx_license_4plus",
  "REQ-7.5.b": "ol_day_support_cert_3or_fewer",
  "REQ-8.5.a": "ol_day_tx_license_4plus",
  "REQ-8.5.b": "ol_day_support_cert_3or_fewer",
  "REQ-9.6.a": "ol_day_tx_license_4plus",
};

describe("thirteenth executable batch — OL Day Treatment / Day Support twins", () => {
  it("overlays fixture logic onto the five imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = thirteenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 5);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(thirteenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(thirteenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.equal(rule.timing.kind, "none", rule.id);
      const expected = EXPECTED_LIVE_KEY[rule.id as keyof typeof EXPECTED_LIVE_KEY];
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.equal(pred?.kind, "awarded_service_codes", rule.id);
      assert.equal(pred?.catalogKey, expected, rule.id);
      assert.ok((pred?.serviceCodes?.length ?? 0) > 0, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-7.5.a");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay hold-outs, umbrellas, or REQ-21.5", () => {
    const loaded = readCommittedCatalog();
    for (const id of [
      "REQ-7.5.c",
      "REQ-8.5.c",
      "REQ-9.6.b",
      "REQ-7.3.5",
      "REQ-8.3.3",
      "REQ-9.3.5",
      "REQ-10.5",
      "REQ-1.4.3",
      "REQ-1.34",
    ]) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      assert.equal(applyThirteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(thirteenthBatchParentIsWired(parent), false, id);
    }
    const rhs = loaded.parents.find((r) => r.id === "REQ-21.5");
    assert.ok(rhs);
    assert.equal(applyThirteenthExecutableBatchOverlay(rhs).predicates.length, rhs.predicates.length);
    assert.equal(thirteenthBatchParentIsWired(rhs), false);
    const megaC = applyMegaCExecutableBatchOverlay(rhs);
    assert.ok(megaC.predicates.length > 0);
  });

  it("keeps child elements off the staff-task queue and shares the two pack keys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-7.5.a",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "ol_day_tx_license_4plus",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-7.5.a",
        liveKey: "ol_day_tx_license_4plus",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(thirteenthBatchSharedLiveKeyParents("ol_community_based_day_support"), []);
    assert.deepEqual(thirteenthBatchSharedLiveKeyParents("ol_rhs_license_4plus"), []);
    assert.deepEqual(thirteenthBatchSharedLiveKeyParents("hhs_evac_drills_quarterly"), []);
    assert.deepEqual(thirteenthBatchSharedLiveKeyParents("ol_day_tx_license_4plus"), [
      "REQ-7.5.a",
      "REQ-8.5.a",
      "REQ-9.6.a",
    ]);
    assert.deepEqual(thirteenthBatchSharedLiveKeyParents("ol_day_support_cert_3or_fewer"), [
      "REQ-7.5.b",
      "REQ-8.5.b",
    ]);
    assert.equal(sowCatalogEntryByKey("ol_community_based_day_support"), null);
  });

  it("wires unused OL Day Treatment / Day Support keys through the live engine", () => {
    assert.deepEqual(
      [...THIRTEENTH_EXECUTABLE_BATCH_LIVE_KEYS],
      ["ol_day_tx_license_4plus", "ol_day_support_cert_3or_fewer"],
    );
    assert.equal(THIRTEENTH_BATCH_ENGINE_BINDINGS.length, 5);
    for (const row of THIRTEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = thirteenthBatchLiveEngineReady(row);
      assert.equal(ready.ready, true, `${row.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(row.parentAssignment, "one", row.ruleId);
      assert.equal(row.mintsElementTasks, false, row.ruleId);
      assert.equal(row.trainingTitle, null, row.ruleId);
      assert.equal(row.formTitle, null, row.ruleId);
      assert.equal(row.disposition, "standing", row.ruleId);
      for (const key of row.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "standing", key);
      }
    }
    assert.equal(
      thirteenthBatchAssignmentOpensClock("ol_day_tx_license_4plus", EMPTY_ORG_FACTS),
      false,
    );
    assert.equal(
      thirteenthBatchAssignmentOpensClock(
        "ol_day_tx_license_4plus",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["DSG"] },
        ["DSG", "DSP"],
      ),
      true,
    );
    assert.equal(
      thirteenthBatchAssignmentOpensClock(
        "ol_day_tx_license_4plus",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["DSI"] },
        ["DSG", "DSP"],
      ),
      false,
    );
    assert.equal(
      thirteenthBatchAssignmentOpensClock(
        "ol_day_support_cert_3or_fewer",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["DSI"] },
        ["DSI"],
      ),
      true,
    );
    assert.equal(
      thirteenthBatchAssignmentOpensClock(
        "ol_day_tx_license_4plus",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["EPR"] },
        ["EPR"],
      ),
      true,
    );
    assert.equal(
      thirteenthBatchAssignmentOpensClock(
        "ol_day_tx_license_4plus",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["RHS"] },
        ["EPR"],
      ),
      false,
    );
    assert.ok(thirteenthBatchOmitsHoldoutsUmbrellasEvacAndInventedKeys());
  });

  it("maps official catalog clause_text and article awarded codes — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    const catalog = JSON.parse(
      readFileSync(join(DHHS91172_CATALOG_DIR, "Requirements.json"), "utf8"),
    ) as { rows?: Array<{ requirement_key?: string; clause_text?: string; service_codes?: string }> };
    const rows = catalog.rows ?? [];
    for (const id of THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const official = rows.find((row) => row.requirement_key === id);
      assert.ok(official?.clause_text, id);
      const overlaid = applyThirteenthExecutableBatchOverlay(loaded.parents.find((r) => r.id === id)!);
      assert.equal(overlaid.group.members[0]?.label, official.clause_text, id);
      assert.equal(overlaid.evidence.summary, official.clause_text, id);
      const expectedCodes = (official.service_codes ?? "")
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean);
      assert.deepEqual([...(overlaid.predicates[0]?.serviceCodes ?? [])], expectedCodes, id);
    }
  });

  it("missing awarded-code fact stays a question — never silent N/A", () => {
    const dsg = thirteenthBatchLiveFactsForRule("REQ-7.5.a");
    assert.equal(dsg[0]?.fact_id, "FACT-015");
    const unanswered = evaluateCatalogFact(dsg[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /DSG|DSP/i);
    assert.equal(thirteenthBatchLiveFactsForRule("REQ-7.5.b")[0]?.fact_id, "FACT-015");
    assert.equal(thirteenthBatchLiveFactsForRule("REQ-8.5.a")[0]?.fact_id, "FACT-019");
    assert.equal(thirteenthBatchLiveFactsForRule("REQ-8.5.b")[0]?.fact_id, "FACT-019");
    assert.equal(thirteenthBatchLiveFactsForRule("REQ-9.6.a")[0]?.fact_id, "FACT-012");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      THIRTEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = thirteenthExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-7.5.a" || r.id === "REQ-9.6.a",
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
