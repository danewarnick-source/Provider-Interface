import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { REQ_ART15_PBA } from "./draft-rules/fixtures.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  SIXTH_BATCH_DEMO_PATH,
  SIXTH_BATCH_ENGINE_BINDINGS,
  SIXTH_EXECUTABLE_BATCH_LIVE_KEYS,
  SIXTH_EXECUTABLE_BATCH_RULE_IDS,
  applySixthExecutableBatchOverlay,
  sixthBatchAssignmentOpensClock,
  sixthBatchKeepsReviewsIndependent,
  sixthBatchLiveEngineReady,
  sixthBatchLiveFactsForRule,
  sixthBatchOmitsEmploymentAnnualUsorAndArt2,
  sixthBatchParentIsWired,
  sixthBatchPublicationStaysDeliberate,
  sixthBatchReviewsStayDistinct,
  sixthExecutableBatchParents,
} from "./sixth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

const PBA: StaffDutyFacts = {
  ...UNKNOWN_STAFF_DUTY_FACTS,
  staffId: "pba-1",
  role: "employee",
  assignmentsKnown: true,
  assignedClientIds: ["c1"],
  assignedServiceCodes: ["PBA"],
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

const HHS: StaffDutyFacts = {
  ...PBA,
  staffId: "hhs-1",
  assignedServiceCodes: ["HHS"],
};

const OFFICE: StaffDutyFacts = {
  ...PBA,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
};

describe("sixth executable batch — PBA financial reviews", () => {
  it("overlays fixture slices onto the two imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = sixthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, SIXTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.ok(sixthBatchPublicationStaysDeliberate(rule), rule.id);
      assert.ok(sixthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
      assert.ok(sixthBatchKeepsReviewsIndependent(rule), rule.id);
    }
    const rawPerson = loaded.parents.find((r) => r.id === "REQ-1.28.5");
    assert.ok(rawPerson);
    assert.equal(canPublish(rawPerson), false);
    const rawAdmin = loaded.parents.find((r) => r.id === "REQ-15.3.7");
    assert.ok(rawAdmin);
    assert.equal(canPublish(rawAdmin), false);
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-1.28.5")!),
      "pba_financial_review",
    );
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-15.3.7")!),
      "pba_financial_review",
    );
    const person = batch.find((r) => r.id === "REQ-1.28.5");
    assert.deepEqual(
      person?.group.members.map((m) => m.id),
      ["monthly-person-review"],
    );
    const admin = batch.find((r) => r.id === "REQ-15.3.7");
    assert.deepEqual(
      admin?.group.members.map((m) => m.id),
      ["monthly-administrator-review", "quarterly-third-person-sample"],
    );
    assert.equal(
      /10\s*%/.test(`${admin?.group.conditionNote ?? ""} ${admin?.evidence.summary}`),
      false,
    );
  });

  it("does not overlay first–fifth-batch, SJD USOR vendor, employment, ART2, or 15.3.8", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applySixthExecutableBatchOverlay(orientation).predicates.length, 0);
    const notes = loaded.parents.find((r) => r.id === "REQ-1.10.7");
    assert.ok(notes);
    assert.equal(applySixthExecutableBatchOverlay(notes).predicates.length, 0);
    const sjdVendor = loaded.parents.find((r) => r.id === "REQ-33.5.a");
    assert.ok(sjdVendor);
    assert.equal(applySixthExecutableBatchOverlay(sjdVendor).predicates.length, 0);
    assert.equal(sixthBatchParentIsWired(sjdVendor), false);
    const employment = loaded.parents.find((r) => r.id === "REQ-30.3.5");
    assert.ok(employment);
    assert.equal(applySixthExecutableBatchOverlay(employment).predicates.length, 0);
    const sjdEmployment = loaded.parents.find((r) => r.id === "REQ-33.3.7");
    assert.ok(sjdEmployment);
    assert.equal(applySixthExecutableBatchOverlay(sjdEmployment).predicates.length, 0);
    const scSend = loaded.parents.find((r) => r.id === "REQ-15.3.8");
    assert.ok(scSend);
    assert.equal(applySixthExecutableBatchOverlay(scSend).predicates.length, 0);
    assert.equal(sixthBatchParentIsWired(scSend), false);
    assert.ok(sixthBatchOmitsEmploymentAnnualUsorAndArt2());
  });

  it("keeps child elements off the staff-task queue and shares one live key", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-15.3.7",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "pba_financial_review",
        id: "b",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-15.3.7",
        liveKey: "pba_financial_review",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["b"],
    );
  });

  it("wires the live PBA key through the existing by_design engine surface", () => {
    for (const binding of SIXTH_BATCH_ENGINE_BINDINGS) {
      const ready = sixthBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      assert.equal(binding.formTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "by_design", key);
        assert.ok(entry.service_codes.includes("PBA"), key);
      }
    }
    for (const key of SIXTH_EXECUTABLE_BATCH_LIVE_KEYS) {
      assert.equal(
        sixthBatchAssignmentOpensClock(key, {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "unknown",
        }),
        false,
        key,
      );
    }
    assert.equal(sixthBatchAssignmentOpensClock("pba_financial_review", PBA), true);
    assert.equal(sixthBatchAssignmentOpensClock("pba_financial_review", HHS), false);
    assert.equal(sixthBatchAssignmentOpensClock("pba_financial_review", OFFICE), false);
    assert.equal(
      SIXTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "usor_job_development_sjd" as (typeof SIXTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
    assert.equal(
      SIXTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "sei_employment_data_upi" as (typeof SIXTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
    assert.equal(
      SIXTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "billing_service_match" as (typeof SIXTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
  });

  it("keeps the three reviews distinct and does not invent a sample percentage", () => {
    assert.equal(sixthBatchReviewsStayDistinct(), true);
    assert.ok(sixthBatchKeepsReviewsIndependent(REQ_ART15_PBA));
    const loaded = readCommittedCatalog();
    const person = applySixthExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-1.28.5")!,
    );
    assert.match(
      person.evidence.summary,
      /does not satisfy the administrator|generic attestation/i,
    );
    const admin = applySixthExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-15.3.7")!,
    );
    assert.match(admin.group.conditionNote ?? "", /Do not invent a sample percentage/i);
    assert.match(admin.evidence.summary, /Reviewers must differ/i);
    assert.ok(canPublish(REQ_ART15_PBA));
    assert.equal(canActivate(REQ_ART15_PBA), false);
  });

  it("missing assignment facts stay questions — never silent N/A", () => {
    const person = sixthBatchLiveFactsForRule("REQ-1.28.5");
    assert.equal(person[0]?.fact_id, "LIVE-personal_funds_assistance");
    const unanswered = evaluateCatalogFact(person[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /personal funds/i);
    const pba = evaluateCatalogFact(sixthBatchLiveFactsForRule("REQ-15.3.7")[0]!, EMPTY_ORG_FACTS);
    assert.equal(pba.status, "unanswered");
    assert.match(pba.prompt, /PBA/i);
  });

  it("documents a five-step demo path and simulates PBA assignment without inventing clocks", () => {
    assert.deepEqual(
      SIXTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const batch = sixthExecutableBatchParents(loaded.parents);
    const person = batch.find((r) => r.id === "REQ-1.28.5");
    const admin = batch.find((r) => r.id === "REQ-15.3.7");
    assert.ok(person && admin);

    const unknown = simulateDraftRules({
      rules: [person],
      staff: [
        { ...OFFICE, hireDate: "2026-07-01", acreCertified: false, supervisorAcreCertified: true },
      ],
      orgFacts: EMPTY_ORG_FACTS,
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
    });
    assert.equal(unknown.wroteDatabase, false);
    assert.equal(unknown.createdLiveAssignments, false);
    assert.equal(unknown.activatedRules, false);
    const officeUnknown = unknown.staff.find((s) => s.staffId === "office-1")?.rules[0];
    assert.equal(officeUnknown?.applicability, "does_not_apply");

    const known = simulateDraftRules({
      rules: [person, admin],
      staff: [
        { ...PBA, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...HHS, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...OFFICE, hireDate: "2026-07-01", acreCertified: false, supervisorAcreCertified: true },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS", "PBA"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
    });
    const pbaStaff = known.staff.find((s) => s.staffId === "pba-1");
    assert.ok(pbaStaff);
    const pbaPerson = pbaStaff.rules.find((r) => r.ruleId === "REQ-1.28.5");
    assert.equal(pbaPerson?.applicability, "applies");
    assert.equal(pbaPerson?.parentTaskCount, 1);
    const pbaAdmin = pbaStaff.rules.find((r) => r.ruleId === "REQ-15.3.7");
    assert.equal(pbaAdmin?.applicability, "applies");
    assert.equal(pbaAdmin?.parentTaskCount, 1);
    const hhsStaff = known.staff.find((s) => s.staffId === "hhs-1");
    assert.ok(hhsStaff?.rules.every((r) => r.applicability === "does_not_apply"));
    const office = known.staff.find((s) => s.staffId === "office-1");
    assert.ok(office?.rules.every((r) => r.applicability === "does_not_apply"));
  });
});
