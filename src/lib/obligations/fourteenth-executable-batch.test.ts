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
  FOURTEENTH_BATCH_DEMO_PATH,
  FOURTEENTH_BATCH_ENGINE_BINDINGS,
  FOURTEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyFourteenthExecutableBatchOverlay,
  fourteenthBatchAssignmentOpensClock,
  fourteenthBatchLiveEngineReady,
  fourteenthBatchLiveFactsForRule,
  fourteenthBatchOmitsInventedUmbrellasAndOlDayTwins,
  fourteenthBatchParentIsWired,
  fourteenthBatchPublicationStaysDeliberate,
  fourteenthBatchSharedLiveKeyParents,
  fourteenthExecutableBatchParents,
} from "./fourteenth-executable-batch.ts";
import { applyThirteenthExecutableBatchOverlay } from "./thirteenth-executable-batch.ts";
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

const EXPECTED_LIVE_KEY: Record<(typeof FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number], string> = {
  "REQ-11.3.6": "hhs_evac_drills_quarterly",
  "REQ-20.3.6": "pps_evac_drills_quarterly",
  "REQ-21.3.6": "rhs_evac_drills_quarterly",
};

describe("fourteenth executable batch — quarterly evac drill leftovers", () => {
  it("overlays fixture logic onto the three imported .6 parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = fourteenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 3);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(fourteenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(fourteenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.equal(rule.timing.kind, "calendar_period", rule.id);
      assert.equal(rule.timing.kind === "calendar_period" && rule.timing.cadence, "quarterly", rule.id);
      const expected = EXPECTED_LIVE_KEY[rule.id as keyof typeof EXPECTED_LIVE_KEY];
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.equal(pred?.kind, "awarded_service_codes", rule.id);
      assert.equal(pred?.catalogKey, expected, rule.id);
      assert.ok((pred?.serviceCodes?.length ?? 0) > 0, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-11.3.6");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not invent umbrellas or overlay OL Day twins", () => {
    const loaded = readCommittedCatalog();
    assert.equal(loaded.parents.some((r) => r.id === "REQ-11.3"), false);
    assert.equal(loaded.parents.some((r) => r.id === "REQ-20.3"), false);
    assert.equal(loaded.parents.some((r) => r.id === "REQ-21.3"), false);
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-11.3"], undefined);
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-20.3"], undefined);
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-21.3"], undefined);
    for (const id of ["REQ-7.5.a", "REQ-7.5.b", "REQ-8.5.a", "REQ-8.5.b", "REQ-9.6.a"]) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      assert.equal(applyFourteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(fourteenthBatchParentIsWired(parent), false, id);
    }
    const dayTx = loaded.parents.find((r) => r.id === "REQ-7.5.a");
    assert.ok(dayTx);
    const thirteenth = applyThirteenthExecutableBatchOverlay(dayTx);
    assert.ok(thirteenth.predicates.length > 0);
    assert.equal(fourteenthBatchParentIsWired(thirteenth), false);
  });

  it("keeps child elements off the staff-task queue and uses one drill-log family", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-11.3.6",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "hhs_evac_drills_quarterly",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-11.3.6",
        liveKey: "hhs_evac_drills_quarterly",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(fourteenthBatchSharedLiveKeyParents("ol_day_tx_license_4plus"), []);
    assert.deepEqual(fourteenthBatchSharedLiveKeyParents("hhs_annual_outcome"), []);
    assert.deepEqual(fourteenthBatchSharedLiveKeyParents("hhs_evac_drills_quarterly"), [
      "REQ-11.3.6",
    ]);
    assert.deepEqual(fourteenthBatchSharedLiveKeyParents("pps_evac_drills_quarterly"), [
      "REQ-20.3.6",
    ]);
    assert.deepEqual(fourteenthBatchSharedLiveKeyParents("rhs_evac_drills_quarterly"), [
      "REQ-21.3.6",
    ]);
  });

  it("wires existing pack liveKeys through the live engine", () => {
    assert.deepEqual(
      [...FOURTEENTH_EXECUTABLE_BATCH_LIVE_KEYS],
      ["hhs_evac_drills_quarterly", "pps_evac_drills_quarterly", "rhs_evac_drills_quarterly"],
    );
    assert.equal(FOURTEENTH_BATCH_ENGINE_BINDINGS.length, 3);
    for (const row of FOURTEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = fourteenthBatchLiveEngineReady(row);
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
        assert.equal(entry.due_rule.kind, "calendar_quarter_end", key);
      }
    }
    assert.equal(
      fourteenthBatchAssignmentOpensClock("hhs_evac_drills_quarterly", EMPTY_ORG_FACTS),
      false,
    );
    assert.equal(
      fourteenthBatchAssignmentOpensClock("hhs_evac_drills_quarterly", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      fourteenthBatchAssignmentOpensClock("pps_evac_drills_quarterly", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["PPS"],
      }),
      true,
    );
    assert.equal(
      fourteenthBatchAssignmentOpensClock("rhs_evac_drills_quarterly", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["RHS"],
      }),
      true,
    );
    assert.equal(
      fourteenthBatchAssignmentOpensClock(
        "hhs_evac_drills_quarterly",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["RHS"] },
        ["HHS"],
      ),
      false,
    );
    assert.ok(fourteenthBatchOmitsInventedUmbrellasAndOlDayTwins());
  });

  it("maps official catalog clause_text and article awarded codes — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    const catalog = JSON.parse(
      readFileSync(join(DHHS91172_CATALOG_DIR, "Requirements.json"), "utf8"),
    ) as { rows?: Array<{ requirement_key?: string; clause_text?: string; service_codes?: string }> };
    const rows = catalog.rows ?? [];
    for (const id of FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const official = rows.find((row) => row.requirement_key === id);
      assert.ok(official?.clause_text, id);
      const overlaid = applyFourteenthExecutableBatchOverlay(loaded.parents.find((r) => r.id === id)!);
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
    const hhs = fourteenthBatchLiveFactsForRule("REQ-11.3.6");
    assert.equal(hhs[0]?.fact_id, "FACT-004");
    const unanswered = evaluateCatalogFact(hhs[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /HHS/i);
    assert.equal(fourteenthBatchLiveFactsForRule("REQ-20.3.6")[0]?.fact_id, "FACT-001");
    assert.equal(fourteenthBatchLiveFactsForRule("REQ-21.3.6")[0]?.fact_id, "FACT-007");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      FOURTEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = fourteenthExecutableBatchParents(loaded.parents);
    assert.equal(screens.length, 3);
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
