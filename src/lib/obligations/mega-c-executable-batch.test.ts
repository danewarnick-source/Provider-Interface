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
  MEGA_C_BATCH_DEMO_PATH,
  MEGA_C_BATCH_ENGINE_BINDINGS,
  MEGA_C_EXECUTABLE_BATCH_LIVE_KEYS,
  MEGA_C_EXECUTABLE_BATCH_RULE_IDS,
  applyMegaCExecutableBatchOverlay,
  megaCBatchAssignmentOpensClock,
  megaCBatchLiveEngineReady,
  megaCBatchLiveFactsForRule,
  megaCBatchOmitsInventedEvacOutcomesAndPn,
  megaCBatchParentIsWired,
  megaCBatchPublicationStaysDeliberate,
  megaCBatchSharedLiveKeyParents,
  megaCExecutableBatchParents,
} from "./mega-c-executable-batch.ts";
import {
  applyFirstExecutableBatchOverlay,
  firstBatchParentIsWired,
} from "./first-executable-batch.ts";
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

const RHS: StaffDutyFacts = {
  ...DSP,
  staffId: "rhs-1",
  assignedServiceCodes: ["RHS"],
};

const OFFICE: StaffDutyFacts = {
  ...DSP,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
};

describe("mega C executable batch — person-file and site leftovers", () => {
  it("overlays fixture logic onto the nine imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = megaCExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, MEGA_C_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(megaCBatchPublicationStaysDeliberate(rule), false, rule.id);
      assert.ok(megaCBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.10.11");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
    assert.equal(liveObligationKeyForRule(batch.find((r) => r.id === "REQ-1.9")!), "ce_12h_annual");
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-1.10.11")!),
      "grievance_acknowledgment",
    );
  });

  it("wires REQ-1.9 as a companion of batch 1 and does not steal the hire overlay", () => {
    const loaded = readCommittedCatalog();
    const umbrella = loaded.parents.find((r) => r.id === "REQ-1.9");
    assert.ok(umbrella);
    assert.equal(applyFirstExecutableBatchOverlay(umbrella).predicates.length, 0);
    assert.equal(firstBatchParentIsWired(umbrella), false);
    const overlaid = applyMegaCExecutableBatchOverlay(umbrella);
    assert.equal(liveObligationKeyForRule(overlaid), "ce_12h_annual");
    assert.equal(overlaid.timing.kind, "none");
    assert.match(overlaid.timing.reason, /missing-information|REQ-1\.8\.7/i);
    assert.deepEqual(megaCBatchSharedLiveKeyParents("ce_12h_annual"), ["REQ-1.9"]);
    const hire = loaded.parents.find((r) => r.id === "REQ-1.8.7");
    assert.ok(hire);
    assert.equal(applyMegaCExecutableBatchOverlay(hire).id, "REQ-1.8.7");
    assert.equal(applyMegaCExecutableBatchOverlay(hire).predicates.length, hire.predicates.length);
  });

  it("does not overlay hire clocks, Mega A credentials, or Mega B policy files", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applyMegaCExecutableBatchOverlay(orientation).predicates.length, 0);
    const background = loaded.parents.find((r) => r.id === "REQ-1.9.2");
    assert.ok(background);
    assert.equal(applyMegaCExecutableBatchOverlay(background).predicates.length, 0);
    const zoning = loaded.parents.find((r) => r.id === "REQ-1.11");
    assert.ok(zoning);
    assert.equal(applyMegaCExecutableBatchOverlay(zoning).predicates.length, 0);
    assert.equal(megaCBatchParentIsWired(zoning), false);
    const outcome = loaded.parents.find((r) => r.id === "REQ-11.7");
    if (outcome) {
      assert.equal(applyMegaCExecutableBatchOverlay(outcome).predicates.length, 0);
    }
    const disclosure = loaded.parents.find((r) => r.id === "REQ-1.9.6");
    if (disclosure) {
      assert.equal(applyMegaCExecutableBatchOverlay(disclosure).predicates.length, 0);
    }
    assert.ok(megaCBatchOmitsInventedEvacOutcomesAndPn());
  });

  it("keeps child elements off the staff-task queue and shares the CE live key", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.10.11",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "ce_12h_annual",
        id: "a",
      },
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "ce_12h_annual",
        id: "b",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.9",
        liveKey: "ce_12h_annual",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
  });

  it("wires each live key through the existing engine surfaces", () => {
    for (const binding of MEGA_C_BATCH_ENGINE_BINDINGS) {
      const ready = megaCBatchLiveEngineReady(binding);
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
    assert.equal(megaCBatchAssignmentOpensClock("ce_12h_annual", DSP), true);
    assert.equal(megaCBatchAssignmentOpensClock("ce_12h_annual", OFFICE), false);
    assert.equal(megaCBatchAssignmentOpensClock("grievance_acknowledgment", DSP), true);
    assert.equal(megaCBatchAssignmentOpensClock("grievance_acknowledgment", OFFICE), false);
    assert.equal(megaCBatchAssignmentOpensClock("support_strategies", DSP), true);
    assert.equal(
      megaCBatchAssignmentOpensClock("housemate_informed_choice", DSP, EMPTY_ORG_FACTS),
      false,
    );
    assert.equal(
      megaCBatchAssignmentOpensClock("housemate_informed_choice", DSP, {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      megaCBatchAssignmentOpensClock("housemate_informed_choice", DSP, {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["SEI"],
      }),
      false,
    );
    assert.equal(
      megaCBatchAssignmentOpensClock("hhs_home_cert_annual", OFFICE, {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      megaCBatchAssignmentOpensClock("ol_rhs_license_4plus", OFFICE, {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["RHS"],
      }),
      true,
    );
    assert.equal(
      megaCBatchAssignmentOpensClock("ol_rhs_license_4plus", OFFICE, {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      false,
    );
    assert.equal(
      megaCBatchAssignmentOpensClock("rhs_lease_agreement", RHS, {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["RHS"],
      }),
      true,
    );
    assert.ok(
      !(MEGA_C_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(
        "hhs_evac_drills_quarterly",
      ),
    );
  });

  it("missing assignment and awarded-code facts stay questions — never silent N/A", () => {
    const ce = megaCBatchLiveFactsForRule("REQ-1.9");
    assert.equal(ce[0]?.fact_id, "LIVE-direct_support_assignment");
    assert.equal(evaluateCatalogFact(ce[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    const grievance = megaCBatchLiveFactsForRule("REQ-1.10.11");
    assert.equal(grievance[0]?.fact_id, "LIVE-person_file_intake");
    assert.equal(evaluateCatalogFact(grievance[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    const housemate = megaCBatchLiveFactsForRule("REQ-1.35");
    assert.equal(housemate[0]?.fact_id, "LIVE-residential_housemates");
    const houseQ = evaluateCatalogFact(housemate[0]!, EMPTY_ORG_FACTS);
    assert.equal(houseQ.status, "unanswered");
    assert.equal(houseQ.source, "awarded_service_codes");
    const hhs = megaCBatchLiveFactsForRule("REQ-11.5");
    assert.equal(hhs[0]?.fact_id, "FACT-004");
    assert.equal(evaluateCatalogFact(hhs[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    const rhs = megaCBatchLiveFactsForRule("REQ-21.5");
    assert.equal(rhs[0]?.fact_id, "FACT-007");
    assert.equal(evaluateCatalogFact(rhs[0]!, EMPTY_ORG_FACTS).status, "unanswered");
  });

  it("documents a five-step demo path and simulates without inventing clocks", () => {
    assert.deepEqual(
      MEGA_C_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const batch = megaCExecutableBatchParents(loaded.parents);
    const ce = batch.find((r) => r.id === "REQ-1.9");
    const grievance = batch.find((r) => r.id === "REQ-1.10.11");
    const cert = batch.find((r) => r.id === "REQ-11.5");
    assert.ok(ce && grievance && cert);

    const result = simulateDraftRules({
      rules: [ce, grievance, cert],
      staff: [
        { ...DSP, hireDate: "2026-07-01" },
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
    const dspCe = dsp.rules.find((r) => r.ruleId === "REQ-1.9");
    assert.equal(dspCe?.applicability, "applies");
    assert.equal(dspCe?.parentTaskCount, 1);
    const dspGrievance = dsp.rules.find((r) => r.ruleId === "REQ-1.10.11");
    assert.equal(dspGrievance?.applicability, "applies");
    const dspCert = dsp.rules.find((r) => r.ruleId === "REQ-11.5");
    assert.equal(dspCert?.applicability, "applies");
    const office = result.staff.find((s) => s.staffId === "office-1");
    assert.ok(office);
    assert.equal(office.rules.find((r) => r.ruleId === "REQ-1.9")?.applicability, "does_not_apply");
    assert.equal(
      office.rules.find((r) => r.ruleId === "REQ-1.10.11")?.applicability,
      "does_not_apply",
    );
    assert.equal(office.rules.find((r) => r.ruleId === "REQ-11.5")?.applicability, "applies");
  });
});
