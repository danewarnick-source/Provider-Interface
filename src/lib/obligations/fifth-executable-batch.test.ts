import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { isEvvLockedCode } from "../evv-codes.ts";
import { UNKNOWN_STAFF_DUTY_FACTS, type StaffDutyFacts } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import {
  REQ_1_10_7_NOTES,
  REQ_1_10_7_TIMESHEET,
  REQ_1_10_SIGNATURE,
  REQ_1_12_EVV,
} from "./draft-rules/fixtures.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  FIFTH_BATCH_DEMO_PATH,
  FIFTH_BATCH_ENGINE_BINDINGS,
  FIFTH_EXECUTABLE_BATCH_LIVE_KEYS,
  FIFTH_EXECUTABLE_BATCH_RULE_IDS,
  applyFifthExecutableBatchOverlay,
  fifthBatchAssignmentOpensClock,
  fifthBatchHhsUsesDailyNoteOverride,
  fifthBatchKeepsLanesIndependent,
  fifthBatchLiveEngineReady,
  fifthBatchLiveFactsForRule,
  fifthBatchNoteNeverAbsorbsSiblings,
  fifthBatchOmitsEmploymentAndUsorVendor,
  fifthBatchParentIsWired,
  fifthBatchPublicationStaysDeliberate,
  fifthExecutableBatchParents,
} from "./fifth-executable-batch.ts";
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

const SLN: StaffDutyFacts = {
  ...DSP,
  staffId: "sln-1",
  assignedServiceCodes: ["SLN"],
};

const SEI: StaffDutyFacts = {
  ...DSP,
  staffId: "sei-1",
  assignedServiceCodes: ["SEI"],
};

const OFFICE: StaffDutyFacts = {
  ...DSP,
  staffId: "office-1",
  role: "admin",
  assignedClientIds: [],
  assignedServiceCodes: [],
};

describe("fifth executable batch — documentation notes and EVV", () => {
  it("overlays fixture logic onto the two imported parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = fifthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, FIFTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.ok(fifthBatchPublicationStaysDeliberate(rule), rule.id);
      assert.ok(fifthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.ok(liveObligationKeyForRule(rule), rule.id);
      assert.ok(fifthBatchKeepsLanesIndependent(rule), rule.id);
    }
    const rawNotes = loaded.parents.find((r) => r.id === "REQ-1.10.7");
    assert.ok(rawNotes);
    assert.equal(canPublish(rawNotes), false);
    const rawEvv = loaded.parents.find((r) => r.id === "REQ-1.12");
    assert.ok(rawEvv);
    assert.equal(canPublish(rawEvv), false);
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-1.10.7")!),
      "timesheets_attendance",
    );
    assert.equal(
      liveObligationKeyForRule(batch.find((r) => r.id === "REQ-1.12")!),
      "evv_visit_verification",
    );
  });

  it("does not overlay first–fourth-batch, SJD USOR vendor, or employment-data parents", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(applyFifthExecutableBatchOverlay(orientation).predicates.length, 0);
    const monthly = loaded.parents.find((r) => r.id === "REQ-1.25");
    assert.ok(monthly);
    assert.equal(applyFifthExecutableBatchOverlay(monthly).predicates.length, 0);
    const sjdVendor = loaded.parents.find((r) => r.id === "REQ-33.5.a");
    assert.ok(sjdVendor);
    assert.equal(applyFifthExecutableBatchOverlay(sjdVendor).predicates.length, 0);
    assert.equal(fifthBatchParentIsWired(sjdVendor), false);
    const employment = loaded.parents.find((r) => r.id === "REQ-30.3.5");
    assert.ok(employment);
    assert.equal(applyFifthExecutableBatchOverlay(employment).predicates.length, 0);
    const sjdEmployment = loaded.parents.find((r) => r.id === "REQ-33.3.7");
    assert.ok(sjdEmployment);
    assert.equal(applyFifthExecutableBatchOverlay(sjdEmployment).predicates.length, 0);
    assert.ok(fifthBatchOmitsEmploymentAndUsorVendor());
  });

  it("keeps child elements off the staff-task queue and does not mint a parent card", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.10.7",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const system = staffTaskPolicy({
      role: "parent",
      createsUserTask: "no",
      parentAssignment: "one",
    });
    assert.equal(system.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "timesheets_attendance",
        id: "b",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.10.7",
        liveKey: "timesheets_attendance",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["b"],
    );
  });

  it("wires each live key through the existing by_design engine surfaces", () => {
    for (const binding of FIFTH_BATCH_ENGINE_BINDINGS) {
      const ready = fifthBatchLiveEngineReady(binding);
      assert.equal(ready.ready, true, `${binding.ruleId}: ${ready.reasons.join("; ")}`);
      assert.equal(binding.parentAssignment, "one", binding.ruleId);
      assert.equal(binding.mintsElementTasks, false, binding.ruleId);
      assert.equal(binding.mintsStaffTask, false, binding.ruleId);
      assert.equal(binding.trainingTitle, null, binding.ruleId);
      assert.equal(binding.formTitle, null, binding.ruleId);
      for (const key of binding.liveKeys) {
        const entry = sowCatalogEntryByKey(key);
        assert.ok(entry, key);
        assert.equal(entry.disposition, "by_design", key);
      }
    }
    for (const key of FIFTH_EXECUTABLE_BATCH_LIVE_KEYS) {
      assert.equal(
        fifthBatchAssignmentOpensClock(key, {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "unknown",
        }),
        false,
        key,
      );
    }
    assert.equal(fifthBatchAssignmentOpensClock("timesheets_attendance", SLN), true);
    assert.equal(fifthBatchAssignmentOpensClock("timesheets_attendance", DSP), true);
    assert.equal(fifthBatchAssignmentOpensClock("timesheets_attendance", OFFICE), false);
    assert.equal(fifthBatchAssignmentOpensClock("evv_visit_verification", SLN), true);
    assert.equal(fifthBatchAssignmentOpensClock("evv_visit_verification", DSP), false);
    assert.equal(fifthBatchAssignmentOpensClock("evv_visit_verification", SEI), false);
    assert.equal(fifthBatchAssignmentOpensClock("hhs_billable_day", DSP), true);
    assert.equal(fifthBatchAssignmentOpensClock("hhs_billable_day", SLN), false);
    assert.equal(isEvvLockedCode("SLN"), true);
    assert.equal(isEvvLockedCode("HHS"), false);
    assert.equal(isEvvLockedCode("SEI"), false);
    assert.equal(isEvvLockedCode("DSI"), false);
    assert.equal(
      FIFTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "usor_job_development_sjd" as (typeof FIFTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
    assert.equal(
      FIFTH_EXECUTABLE_BATCH_LIVE_KEYS.includes(
        "sei_employment_data_upi" as (typeof FIFTH_EXECUTABLE_BATCH_LIVE_KEYS)[number],
      ),
      false,
    );
  });

  it("keeps notes, timesheet, EVV, and signature as independent lanes", () => {
    assert.equal(fifthBatchNoteNeverAbsorbsSiblings(), true);
    assert.equal(fifthBatchHhsUsesDailyNoteOverride(), true);
    assert.ok(fifthBatchKeepsLanesIndependent(REQ_1_10_7_NOTES));
    assert.ok(fifthBatchKeepsLanesIndependent(REQ_1_10_7_TIMESHEET));
    assert.ok(fifthBatchKeepsLanesIndependent(REQ_1_12_EVV));
    assert.ok(fifthBatchKeepsLanesIndependent(REQ_1_10_SIGNATURE));
    const loaded = readCommittedCatalog();
    const notes = applyFifthExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-1.10.7")!,
    );
    assert.match(notes.evidence.summary, /never absorbs EVV|does not satisfy EVV|never absorb/i);
    assert.match(notes.group.conditionNote ?? "", /HHS override|host-home|general five-field/i);
    const evv = applyFifthExecutableBatchOverlay(loaded.parents.find((r) => r.id === "REQ-1.12")!);
    assert.match(evv.evidence.summary, /separate requirement from the service note/i);
    assert.match(evv.group.conditionNote ?? "", /EVV-mandated/);
    assert.ok(canPublish(REQ_1_10_7_NOTES));
    assert.equal(canActivate(REQ_1_10_7_NOTES), false);
    assert.equal(canPublish(REQ_1_12_EVV), false);
    assert.match(REQ_1_12_EVV.releaseGaps.join(" "), /EVV mapping review/);
  });

  it("missing assignment facts stay questions — never silent N/A", () => {
    const notes = fifthBatchLiveFactsForRule("REQ-1.10.7");
    assert.equal(notes[0]?.fact_id, "LIVE-service_documentation_assignment");
    const unanswered = evaluateCatalogFact(notes[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /documented service/i);
    const hhs = evaluateCatalogFact(notes[1]!, EMPTY_ORG_FACTS);
    assert.equal(hhs.status, "unanswered");
    assert.match(hhs.prompt, /HHS/i);
    const evv = evaluateCatalogFact(fifthBatchLiveFactsForRule("REQ-1.12")[0]!, EMPTY_ORG_FACTS);
    assert.equal(evv.status, "unanswered");
    assert.match(evv.prompt, /EVV-mandated/i);
  });

  it("documents a five-step demo path and simulates independent lanes without minting staff tasks", () => {
    assert.deepEqual(
      FIFTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const batch = fifthExecutableBatchParents(loaded.parents);
    const notes = batch.find((r) => r.id === "REQ-1.10.7");
    const evv = batch.find((r) => r.id === "REQ-1.12");
    assert.ok(notes && evv);

    const unknown = simulateDraftRules({
      rules: [notes],
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
      rules: [notes, evv],
      staff: [
        { ...SLN, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...DSP, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...SEI, hireDate: "2026-08-01", acreCertified: false, supervisorAcreCertified: true },
        { ...OFFICE, hireDate: "2026-07-01", acreCertified: false, supervisorAcreCertified: true },
      ],
      orgFacts: { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS", "SLN", "SEI", "DSI"] },
      evidence: [],
      now: new Date("2026-09-14T12:00:00.000Z"),
      orgHasAcreCoverage: true,
    });
    const slnStaff = known.staff.find((s) => s.staffId === "sln-1");
    assert.ok(slnStaff);
    const slnNotes = slnStaff.rules.find((r) => r.ruleId === "REQ-1.10.7");
    assert.equal(slnNotes?.applicability, "applies");
    assert.equal(slnNotes?.parentTaskCount, 0);
    const slnEvv = slnStaff.rules.find((r) => r.ruleId === "REQ-1.12");
    assert.equal(slnEvv?.applicability, "applies");
    assert.equal(slnEvv?.parentTaskCount, 0);
    assert.equal(slnEvv?.members.find((m) => m.memberId === "evv-geofence")?.applicable, true);
    const hhsStaff = known.staff.find((s) => s.staffId === "dsp-1");
    const hhsEvv = hhsStaff?.rules.find((r) => r.ruleId === "REQ-1.12");
    assert.equal(hhsEvv?.applicability, "does_not_apply");
    const seiStaff = known.staff.find((s) => s.staffId === "sei-1");
    const seiEvv = seiStaff?.rules.find((r) => r.ruleId === "REQ-1.12");
    assert.equal(seiEvv?.applicability, "does_not_apply");
    const office = known.staff.find((s) => s.staffId === "office-1");
    assert.ok(office?.rules.every((r) => r.applicability === "does_not_apply"));
  });
});
