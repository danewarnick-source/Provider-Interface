import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { PERIODIC_MONTHLY_CODES, REQ_1_25_PERIODIC } from "./draft-rules/fixtures.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  FOURTH_BATCH_DEMO_PATH,
  FOURTH_BATCH_ENGINE_BINDINGS,
  FOURTH_EXECUTABLE_BATCH_LIVE_KEYS,
  FOURTH_EXECUTABLE_BATCH_RULE_IDS,
  applyFourthExecutableBatchOverlay,
  fourthBatchAssignmentOpensClock,
  fourthBatchKeepsCmpCmsOffUpi,
  fourthBatchLiveEngineReady,
  fourthBatchLiveFactsForRule,
  fourthBatchNeverMintsBothCadencesForOneCode,
  fourthBatchOmitsSlnFromMonthly,
  fourthBatchParentIsWired,
  fourthBatchPublicationStaysDeliberate,
  fourthExecutableBatchParents,
} from "./fourth-executable-batch.ts";
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

const CMP: StaffDutyFacts = {
  ...DSP,
  staffId: "cmp-1",
  assignedServiceCodes: ["CMP"],
};

const SLN: StaffDutyFacts = {
  ...DSP,
  staffId: "sln-1",
  assignedServiceCodes: ["SLN"],
};

const OFFICE: StaffDutyFacts = {
  ...DSP,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
};

describe("fourth executable batch — periodic monthly summaries", () => {
  it("overlays fixture logic onto the four imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = fourthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, FOURTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(fourthBatchPublicationStaysDeliberate(rule), false, rule.id);
      assert.ok(fourthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
      assert.ok(fourthBatchOmitsSlnFromMonthly(rule), rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.25");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-1.25")!),
      "sei_monthly_summary_upi",
    );
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-30.3.4")!),
      "sei_monthly_summary_upi",
    );
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-32.3.2")!),
      "cmp_cms_monthly_summaries",
    );
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-33.3.4")!),
      "sjd_monthly_summary_upi",
    );
  });

  it("does not overlay first/second/third-batch, SJD USOR vendor, or employment-data parents", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applyFourthExecutableBatchOverlay(orientation).predicates.length, 0);
    const usorSei = loaded.parents.find((r) => r.id === "REQ-30.6.a");
    assert.ok(usorSei);
    assert.equal(applyFourthExecutableBatchOverlay(usorSei).predicates.length, 0);
    const sjdVendor = loaded.parents.find((r) => r.id === "REQ-33.5.a");
    assert.ok(sjdVendor);
    assert.equal(applyFourthExecutableBatchOverlay(sjdVendor).predicates.length, 0);
    assert.equal(fourthBatchParentIsWired(sjdVendor), false);
    const employment = loaded.parents.find((r) => r.id === "REQ-30.3.5");
    assert.ok(employment);
    assert.equal(applyFourthExecutableBatchOverlay(employment).predicates.length, 0);
    const sjdEmployment = loaded.parents.find((r) => r.id === "REQ-33.3.7");
    assert.ok(sjdEmployment);
    assert.equal(applyFourthExecutableBatchOverlay(sjdEmployment).predicates.length, 0);
  });

  it("keeps child elements off the staff-task queue", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-30.3.4",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "sei_monthly_summary_upi",
        id: "b",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-30.3.4",
        liveKey: "sei_monthly_summary_upi",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["b"],
    );
  });

  it("wires each live key through the existing engine surfaces", () => {
    for (const binding of FOURTH_BATCH_ENGINE_BINDINGS) {
      const ready = fourthBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      assert.equal(binding.formTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "obligation", key);
        assert.equal(entry.owner, "admin", key);
      }
    }
    for (const key of FOURTH_EXECUTABLE_BATCH_LIVE_KEYS) {
      assert.equal(
        fourthBatchAssignmentOpensClock(key, {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "unknown",
        }),
        false,
        key,
      );
    }
    assert.equal(fourthBatchAssignmentOpensClock("sei_monthly_summary_upi", SEI), true);
    assert.equal(fourthBatchAssignmentOpensClock("sei_monthly_summary_upi", DSP), false);
    assert.equal(fourthBatchAssignmentOpensClock("sjd_monthly_summary_upi", SJD), true);
    assert.equal(fourthBatchAssignmentOpensClock("sjd_monthly_summary_upi", DSP), false);
    assert.equal(fourthBatchAssignmentOpensClock("cmp_cms_monthly_summaries", CMP), true);
    assert.equal(fourthBatchAssignmentOpensClock("cmp_cms_monthly_summaries", SLN), false);
    assert.equal(fourthBatchAssignmentOpensClock("cmp_cms_monthly_summaries", DSP), false);
    assert.deepEqual(sowCatalogEntryByKey("cmp_cms_monthly_summaries")?.service_codes, [
      "CMP",
      "CMS",
    ]);
    assert.equal(
      FOURTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "usor_job_development_sjd" as (typeof FOURTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
    assert.equal(
      FOURTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "sei_employment_data_upi" as (typeof FOURTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
  });

  it("keeps CMP/CMS off UPI, SLN off the monthly clock, and never both cadences on one code", () => {
    assert.equal(fourthBatchNeverMintsBothCadencesForOneCode(), true);
    assert.ok(PERIODIC_MONTHLY_CODES.includes("SEI"));
    assert.equal(PERIODIC_MONTHLY_CODES.includes("SLN"), false);
    const loaded = readCommittedCatalog();
    const cmp = applyFourthExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-32.3.2")!,
    );
    assert.ok(fourthBatchKeepsCmpCmsOffUpi(cmp));
    assert.match(cmp.evidence.summary, /Support Coordinator/);
    assert.match(cmp.evidence.summary, /Not a UPI|not a UPI/i);
    assert.match(cmp.group.conditionNote ?? "", /SLN stays quarterly/);
    assert.equal(cmp.catalogKeys.includes("cmp_cms_monthly_summaries"), true);
    const sei = applyFourthExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-30.3.4")!,
    );
    assert.match(sei.evidence.summary, /UPI/);
    assert.match(sei.group.conditionNote ?? "", /Staff never touch UPI/);
    assert.ok(canPublish(REQ_1_25_PERIODIC));
    assert.equal(canActivate(REQ_1_25_PERIODIC), false);
  });

  it("missing awarded / caseload facts stay questions — never silent N/A", () => {
    const umbrella = fourthBatchLiveFactsForRule("REQ-1.25");
    assert.equal(umbrella[0]?.fact_id, "LIVE-periodic_report_assignment");
    const unanswered = evaluateCatalogFact(umbrella[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /monthly or quarterly|progress report/i);
    const sei = evaluateCatalogFact(fourthBatchLiveFactsForRule("REQ-30.3.4")[0]!, EMPTY_ORG_FACTS);
    assert.equal(sei.status, "unanswered");
    assert.match(sei.prompt, /SEI/i);
    const cmp = evaluateCatalogFact(fourthBatchLiveFactsForRule("REQ-32.3.2")[0]!, EMPTY_ORG_FACTS);
    assert.equal(cmp.status, "unanswered");
    assert.match(cmp.prompt, /CMP|CMS/i);
    const sjd = evaluateCatalogFact(fourthBatchLiveFactsForRule("REQ-33.3.4")[0]!, EMPTY_ORG_FACTS);
    assert.equal(sjd.status, "unanswered");
    assert.match(sjd.prompt, /SJD/i);
  });

  it("documents a five-step demo path and simulates one parent task per applicable cadence", () => {
    assert.deepEqual(
      FOURTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const batch = fourthExecutableBatchParents(loaded.parents);
    const umbrella = batch.find((r) => r.id === "REQ-1.25");
    const seiMonthly = batch.find((r) => r.id === "REQ-30.3.4");
    const cmpMonthly = batch.find((r) => r.id === "REQ-32.3.2");
    const sjdMonthly = batch.find((r) => r.id === "REQ-33.3.4");
    assert.ok(umbrella && seiMonthly && cmpMonthly && sjdMonthly);

    const unknown = simulateDraftRules({
      rules: [umbrella],
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
      rules: [umbrella, seiMonthly, cmpMonthly, sjdMonthly],
      staff: [
        { ...SEI, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...SLN, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...CMP, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...OFFICE, hireDate: "2026-07-01", acreCertified: false, supervisorAcreCertified: true },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["SEI", "SJD", "CMP", "CMS", "SLN", "HHS"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
    });
    const seiStaff = known.staff.find((s) => s.staffId === "sei-1");
    assert.ok(seiStaff);
    const seiUmbrella = seiStaff.rules.find((r) => r.ruleId === "REQ-1.25");
    assert.equal(seiUmbrella?.applicability, "applies");
    assert.equal(seiUmbrella?.parentTaskCount, 1);
    assert.equal(
      seiUmbrella?.members.find((m) => m.memberId === "monthly-report")?.applicable,
      true,
    );
    assert.equal(
      seiUmbrella?.members.find((m) => m.memberId === "quarterly-report")?.applicable,
      false,
    );
    const slnStaff = known.staff.find((s) => s.staffId === "sln-1");
    assert.ok(slnStaff);
    const slnUmbrella = slnStaff.rules.find((r) => r.ruleId === "REQ-1.25");
    assert.equal(
      slnUmbrella?.members.find((m) => m.memberId === "monthly-report")?.applicable,
      false,
    );
    assert.equal(
      slnUmbrella?.members.find((m) => m.memberId === "quarterly-report")?.applicable,
      true,
    );
    const cmpStaff = known.staff.find((s) => s.staffId === "cmp-1");
    const cmpRow = cmpStaff?.rules.find((r) => r.ruleId === "REQ-32.3.2");
    assert.equal(cmpRow?.applicability, "applies");
    assert.equal(cmpRow?.parentTaskCount, 1);
    const office = known.staff.find((s) => s.staffId === "office-1");
    assert.ok(office?.rules.every((r) => r.applicability === "does_not_apply"));
  });
});
