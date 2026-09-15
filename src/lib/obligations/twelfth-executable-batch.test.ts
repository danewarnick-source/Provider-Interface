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
  TWELFTH_BATCH_DEMO_PATH,
  TWELFTH_BATCH_ENGINE_BINDINGS,
  TWELFTH_EXECUTABLE_BATCH_LIVE_KEYS,
  TWELFTH_EXECUTABLE_BATCH_RULE_IDS,
  applyTwelfthExecutableBatchOverlay,
  twelfthBatchAssignmentOpensClock,
  twelfthBatchLiveEngineReady,
  twelfthBatchLiveFactsForRule,
  twelfthBatchOmitsFyGoogleFormMonthlySummariesAndInventedKeys,
  twelfthBatchParentIsWired,
  twelfthBatchPublicationStaysDeliberate,
  twelfthBatchSharedLiveKeyParents,
  twelfthExecutableBatchParents,
} from "./twelfth-executable-batch.ts";
import { applyEleventhExecutableBatchOverlay } from "./eleventh-executable-batch.ts";
import { applyFourthExecutableBatchOverlay } from "./fourth-executable-batch.ts";
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

const EXPECTED_LIVE_KEY: Record<(typeof TWELFTH_EXECUTABLE_BATCH_RULE_IDS)[number], string> = {
  "REQ-30.3.5": "sei_employment_data_upi",
  "REQ-30.3.6": "sei_employment_strategies_upi",
  "REQ-33.3.1": "sjd_usor_contact_monthly",
  "REQ-33.3.4.I": "sjd_usor_contact_monthly",
  "REQ-33.3.5": "sei_employment_strategies_upi",
  "REQ-33.3.7": "sjd_employment_data_upi",
};

describe("twelfth executable batch — SEI/SJD UPI employment leftovers", () => {
  it("overlays fixture logic onto the six imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = twelfthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, TWELFTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(TWELFTH_EXECUTABLE_BATCH_RULE_IDS.length, 6);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (TWELFTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(twelfthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(twelfthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.equal(rule.timing.kind, "none", rule.id);
      const expected = EXPECTED_LIVE_KEY[rule.id as keyof typeof EXPECTED_LIVE_KEY];
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.equal(pred?.kind, "awarded_service_codes", rule.id);
      assert.equal(pred?.catalogKey, expected, rule.id);
      assert.ok((pred?.serviceCodes?.length ?? 0) > 0, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-30.3.5");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay monthly summaries, FY Google Form twins, or UPI 1.15", () => {
    const loaded = readCommittedCatalog();
    const seiMonthly = loaded.parents.find((r) => r.id === "REQ-30.3.4");
    assert.ok(seiMonthly);
    assert.equal(applyTwelfthExecutableBatchOverlay(seiMonthly).predicates.length, 0);
    assert.equal(twelfthBatchParentIsWired(seiMonthly), false);
    const fourth = applyFourthExecutableBatchOverlay(seiMonthly);
    assert.ok(fourth.predicates.length > 0);
    const sjdMonthly = loaded.parents.find((r) => r.id === "REQ-33.3.4");
    assert.ok(sjdMonthly);
    assert.equal(twelfthBatchParentIsWired(sjdMonthly), false);
    const fy = loaded.parents.find((r) => r.id === "REQ-11.7.c");
    assert.ok(fy);
    assert.equal(applyTwelfthExecutableBatchOverlay(fy).predicates.length, fy.predicates.length);
    assert.equal(twelfthBatchParentIsWired(fy), false);
    const eleventh = applyEleventhExecutableBatchOverlay(fy);
    assert.ok(eleventh.predicates.length > 0);
    const upi = loaded.parents.find((r) => r.id === "REQ-1.15.1");
    assert.ok(upi);
    assert.equal(twelfthBatchParentIsWired(upi), false);
  });

  it("keeps child elements off the staff-task queue and shares leftover keys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-30.3.5",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "sei_employment_data_upi",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-30.3.5",
        liveKey: "sei_employment_data_upi",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(twelfthBatchSharedLiveKeyParents("sei_monthly_summary_upi"), []);
    assert.deepEqual(twelfthBatchSharedLiveKeyParents("hhs_annual_outcome"), []);
    assert.deepEqual(twelfthBatchSharedLiveKeyParents("sei_employment_data_upi"), ["REQ-30.3.5"]);
    assert.deepEqual(twelfthBatchSharedLiveKeyParents("sei_employment_strategies_upi"), [
      "REQ-30.3.6",
      "REQ-33.3.5",
    ]);
    assert.deepEqual(twelfthBatchSharedLiveKeyParents("sjd_employment_data_upi"), ["REQ-33.3.7"]);
    assert.deepEqual(twelfthBatchSharedLiveKeyParents("sjd_usor_contact_monthly"), [
      "REQ-33.3.1",
      "REQ-33.3.4.I",
    ]);
    assert.equal(sowCatalogEntryByKey("sjd_employment_strategies_upi"), null);
  });

  it("wires unused employment-file keys through the live engine", () => {
    assert.deepEqual(
      [...TWELFTH_EXECUTABLE_BATCH_LIVE_KEYS],
      [
        "sei_employment_data_upi",
        "sei_employment_strategies_upi",
        "sjd_employment_data_upi",
        "sjd_usor_contact_monthly",
      ],
    );
    assert.equal(TWELFTH_BATCH_ENGINE_BINDINGS.length, 6);
    for (const row of TWELFTH_BATCH_ENGINE_BINDINGS) {
      const ready = twelfthBatchLiveEngineReady(row);
      assert.equal(ready.ready, true, `${row.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(row.parentAssignment, "one", row.ruleId);
      assert.equal(row.mintsElementTasks, false, row.ruleId);
      assert.equal(row.trainingTitle, null, row.ruleId);
      assert.equal(row.formTitle, null, row.ruleId);
      assert.equal(row.disposition, "obligation", row.ruleId);
      for (const key of row.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "obligation", key);
      }
    }
    assert.equal(twelfthBatchAssignmentOpensClock("sei_employment_data_upi", EMPTY_ORG_FACTS), false);
    assert.equal(
      twelfthBatchAssignmentOpensClock("sei_employment_data_upi", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["SEI"],
      }),
      true,
    );
    assert.equal(
      twelfthBatchAssignmentOpensClock("sjd_employment_data_upi", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["SJD"],
      }),
      true,
    );
    assert.equal(
      twelfthBatchAssignmentOpensClock(
        "sei_employment_strategies_upi",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["SJD"] },
        ["SJD"],
      ),
      true,
    );
    assert.equal(
      twelfthBatchAssignmentOpensClock(
        "sei_employment_strategies_upi",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["SEI"] },
        ["SJD"],
      ),
      false,
    );
    assert.ok(twelfthBatchOmitsFyGoogleFormMonthlySummariesAndInventedKeys());
  });

  it("maps official catalog clause_text and article awarded codes — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    const catalog = JSON.parse(
      readFileSync(join(DHHS91172_CATALOG_DIR, "Requirements.json"), "utf8"),
    ) as { rows?: Array<{ requirement_key?: string; clause_text?: string; service_codes?: string }> };
    const rows = catalog.rows ?? [];
    for (const id of TWELFTH_EXECUTABLE_BATCH_RULE_IDS) {
      const official = rows.find((row) => row.requirement_key === id);
      assert.ok(official?.clause_text, id);
      const overlaid = applyTwelfthExecutableBatchOverlay(loaded.parents.find((r) => r.id === id)!);
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
    const sei = twelfthBatchLiveFactsForRule("REQ-30.3.5");
    assert.equal(sei[0]?.fact_id, "FACT-008");
    const unanswered = evaluateCatalogFact(sei[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /SEI/i);
    assert.equal(twelfthBatchLiveFactsForRule("REQ-30.3.6")[0]?.fact_id, "FACT-008");
    assert.equal(twelfthBatchLiveFactsForRule("REQ-33.3.5")[0]?.fact_id, "FACT-002");
    assert.equal(twelfthBatchLiveFactsForRule("REQ-33.3.7")[0]?.fact_id, "FACT-002");
    assert.equal(twelfthBatchLiveFactsForRule("REQ-33.3.1")[0]?.fact_id, "FACT-002");
    assert.equal(twelfthBatchLiveFactsForRule("REQ-33.3.4.I")[0]?.fact_id, "FACT-002");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      TWELFTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = twelfthExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-30.3.5" || r.id === "REQ-33.3.5",
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
