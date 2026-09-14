import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import {
  REQ_30_6_A_USOR,
  REQ_33_5_SJD,
  USOR_PROOF_DESTINATION_AS_PUBLISHED,
} from "./draft-rules/fixtures.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  THIRD_BATCH_DEMO_PATH,
  THIRD_BATCH_ENGINE_BINDINGS,
  THIRD_EXECUTABLE_BATCH_LIVE_KEYS,
  THIRD_EXECUTABLE_BATCH_RULE_IDS,
  applyThirdExecutableBatchOverlay,
  thirdBatchAssignmentOpensClock,
  thirdBatchKeepsPublishedUsorSpelling,
  thirdBatchKeepsSjbTypoAsReleaseGap,
  thirdBatchLiveEngineReady,
  thirdBatchLiveFactsForRule,
  thirdBatchOmitsSeiNamedCourseAlternatives,
  thirdBatchParentIsWired,
  thirdBatchPublicationStaysDeliberate,
  thirdExecutableBatchParents,
} from "./third-executable-batch.ts";
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

const SJD: StaffDutyFacts = {
  ...DSP,
  staffId: "sjd-1",
  assignedServiceCodes: ["SJD"],
};

const OFFICE: StaffDutyFacts = {
  ...DSP,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
};

describe("third executable batch — USOR + SJD clocks", () => {
  it("overlays fixture logic onto the three imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = thirdExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, THIRD_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.ok(thirdBatchPublicationStaysDeliberate(rule), rule.id);
      assert.ok(thirdBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
      assert.ok(thirdBatchOmitsSeiNamedCourseAlternatives(rule), rule.id);
    }
    const rawUsor = loaded.parents.find((r) => r.id === "REQ-30.6.a");
    assert.ok(rawUsor);
    assert.equal(canPublish(rawUsor), false);
    const rawSjd = loaded.parents.find((r) => r.id === "REQ-33.5.b");
    assert.ok(rawSjd);
    assert.equal(canPublish(rawSjd), false);
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-30.6.a")!),
      "usor_job_coaching_sei",
    );
    assert.equal(liveObligationKeyForRule(batch.find((r) => r.id === "REQ-33.5.b")!), "acre_sjd");
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-33.5.c")!),
      "customized_employment_usu",
    );
  });

  it("does not overlay first-batch, second-batch, or SJD USOR vendor parents", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applyThirdExecutableBatchOverlay(orientation).predicates.length, 0);
    const driving = loaded.parents.find((r) => r.id === "REQ-1.30");
    assert.ok(driving);
    assert.equal(applyThirdExecutableBatchOverlay(driving).predicates.length, 0);
    const sjdVendor = loaded.parents.find((r) => r.id === "REQ-33.5.a");
    assert.ok(sjdVendor);
    assert.equal(applyThirdExecutableBatchOverlay(sjdVendor).predicates.length, 0);
    assert.equal(thirdBatchParentIsWired(sjdVendor), false);
  });

  it("keeps child elements off the staff-task queue", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-33.5.b",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      { requirementRole: "parent", parentRequirementKey: null, liveKey: "acre_sjd", id: "b" },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-33.5.b",
        liveKey: "acre_sjd",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["b"],
    );
  });

  it("wires each live key through the existing engine surfaces", () => {
    for (const binding of THIRD_BATCH_ENGINE_BINDINGS) {
      const ready = thirdBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      assert.equal(binding.formTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "obligation", key);
      }
    }
    for (const key of THIRD_EXECUTABLE_BATCH_LIVE_KEYS) {
      assert.equal(
        thirdBatchAssignmentOpensClock(key, {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "unknown",
        }),
        false,
        key,
      );
    }
    assert.equal(thirdBatchAssignmentOpensClock("usor_job_coaching_sei", SEI), true);
    assert.equal(thirdBatchAssignmentOpensClock("usor_job_coaching_sei", DSP), false);
    assert.equal(thirdBatchAssignmentOpensClock("acre_sjd", SJD), true);
    assert.equal(thirdBatchAssignmentOpensClock("acre_sjd", DSP), false);
    assert.equal(thirdBatchAssignmentOpensClock("customized_employment_usu", SJD), true);
    assert.equal(thirdBatchAssignmentOpensClock("customized_employment_usu", DSP), false);
    assert.equal(sowCatalogEntryByKey("usor_job_coaching_sei")?.owner, "admin");
    assert.notEqual(
      THIRD_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "usor_job_development_sjd" as (typeof THIRD_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      true,
    );
  });

  it("keeps USOR email spelling and the SJB typo as Release_Gaps — no invented fix", () => {
    assert.equal(thirdBatchKeepsPublishedUsorSpelling(), true);
    assert.equal(thirdBatchKeepsSjbTypoAsReleaseGap(), true);
    assert.match(USOR_PROOF_DESTINATION_AS_PUBLISHED, /osrprovider@utah\.gov/);
    assert.equal(canPublish(REQ_30_6_A_USOR), false);
    assert.equal(canPublish(REQ_33_5_SJD), false);
    const loaded = readCommittedCatalog();
    const usor = applyThirdExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-30.6.a")!,
    );
    assert.match(usor.evidence.summary, /osrprovider@utah\.gov/);
    assert.equal(
      usor.releaseGaps.some((g) => /osrprovider@utah\.gov/.test(g)),
      false,
    );
    const sjd = applyThirdExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-33.5.b")!,
    );
    assert.equal(
      sjd.releaseGaps.some((g) => /SJB/.test(g)),
      false,
    );
    assert.ok(thirdBatchOmitsSeiNamedCourseAlternatives(REQ_33_5_SJD));
  });

  it("missing award / assignment / Discovery facts stay questions — never silent N/A", () => {
    const usorFacts = thirdBatchLiveFactsForRule("REQ-30.6.a");
    assert.equal(usorFacts[0]?.fact_id, "LIVE-sei_award_date");
    const unanswered = evaluateCatalogFact(usorFacts[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /awarded SEI|SEI/i);
    const sjd = evaluateCatalogFact(thirdBatchLiveFactsForRule("REQ-33.5.b")[0]!, EMPTY_ORG_FACTS);
    assert.equal(sjd.status, "unanswered");
    assert.match(sjd.prompt, /SJD/i);
    const discoveryFacts = thirdBatchLiveFactsForRule("REQ-33.5.c");
    assert.ok(discoveryFacts.some((f) => f.fact_id === "LIVE-sjd_discovery"));
    const discovery = evaluateCatalogFact(
      discoveryFacts.find((f) => f.fact_id === "LIVE-sjd_discovery")!,
      EMPTY_ORG_FACTS,
    );
    assert.equal(discovery.status, "unanswered");
    assert.match(discovery.prompt, /Discovery/i);
  });

  it("documents a five-step demo path and simulates one parent task per live key", () => {
    assert.deepEqual(
      THIRD_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const batch = thirdExecutableBatchParents(loaded.parents);
    const usor = batch.find((r) => r.id === "REQ-30.6.a");
    const acre = batch.find((r) => r.id === "REQ-33.5.b");
    const ce = batch.find((r) => r.id === "REQ-33.5.c");
    assert.ok(usor && acre && ce);

    const usorSim = simulateDraftRules({
      rules: [usor],
      staff: [
        { ...OFFICE, hireDate: "2026-07-01", acreCertified: false, supervisorAcreCertified: true },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["SEI"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
      seiAwardDate: null,
    });
    assert.equal(usorSim.wroteDatabase, false);
    assert.equal(usorSim.createdLiveAssignments, false);
    assert.equal(usorSim.activatedRules, false);
    const admin = usorSim.staff.find((s) => s.staffId === "office-1")?.rules[0];
    assert.equal(admin?.applicability, "unanswered");
    assert.ok(admin?.issues.some((i) => i.kind === "missing_information"));

    const usorKnown = simulateDraftRules({
      rules: [usor],
      staff: [
        { ...OFFICE, hireDate: "2026-07-01", acreCertified: false, supervisorAcreCertified: true },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["SEI"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
      seiAwardDate: "2025-01-01",
    });
    const adminKnown = usorKnown.staff.find((s) => s.staffId === "office-1")?.rules[0];
    assert.equal(adminKnown?.applicability, "applies");
    assert.equal(adminKnown?.parentTaskCount, 1);

    const sjdSim = simulateDraftRules({
      rules: [acre, ce],
      staff: [
        {
          ...SJD,
          hireDate: "2026-08-01",
          acreCertified: false,
          supervisorAcreCertified: true,
          sjdPerformsDiscovery: false,
        },
        {
          ...OFFICE,
          hireDate: "2026-07-01",
          acreCertified: false,
          supervisorAcreCertified: true,
        },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["SJD"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
    });
    const sjdStaff = sjdSim.staff.find((s) => s.staffId === "sjd-1");
    assert.ok(sjdStaff);
    const acreRow = sjdStaff.rules.find((r) => r.ruleId === "REQ-33.5.b");
    const ceRow = sjdStaff.rules.find((r) => r.ruleId === "REQ-33.5.c");
    assert.equal(acreRow?.applicability, "applies");
    assert.equal(acreRow?.parentTaskCount, 1);
    assert.equal(
      ceRow?.members.find((m) => m.memberId === "sjd-customized-employment")?.applicable,
      false,
    );
    const office = sjdSim.staff.find((s) => s.staffId === "office-1");
    assert.ok(office?.rules.every((r) => r.applicability === "does_not_apply"));
  });
});
