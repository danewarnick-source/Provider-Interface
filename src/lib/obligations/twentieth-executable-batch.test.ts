import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTasksWithoutElementDuplicates } from "../staff-my-tasks.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { UNKNOWN_STAFF_DUTY_FACTS } from "./duty-applicability.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { simulateDraftRules } from "./draft-rules/simulation.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import { EMPTY_ORG_FACTS } from "./applicability.ts";
import {
  TWENTIETH_BATCH_ADMIN_ONLY_LIVE_KEYS,
  TWENTIETH_BATCH_DEMO_PATH,
  TWENTIETH_BATCH_ENGINE_BINDINGS,
  TWENTIETH_BATCH_FALSE_FRIEND_KEYS,
  TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS,
  TWENTIETH_EXECUTABLE_BATCH_RULE_IDS,
  applyTwentiethExecutableBatchOverlay,
  twentiethBatchAssignmentOpensClock,
  twentiethBatchExpectedLiveKey,
  twentiethBatchLiveEngineReady,
  twentiethBatchLiveFactsForRule,
  twentiethBatchOfficialClause,
  twentiethBatchOmitsFalseFriends,
  twentiethBatchParentIsWired,
  twentiethBatchPublicationStaysDeliberate,
  twentiethBatchSharedLiveKeyParents,
  twentiethExecutableBatchParents,
} from "./twentieth-executable-batch.ts";
import { applyNineteenthExecutableBatchOverlay } from "./nineteenth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { EXPLICIT_REQ_TO_LIVE_KEY, liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

describe("twentieth executable batch — unlocked blocked leftovers", () => {
  it("overlays fixture logic onto the 26 leftover parents without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = twentiethExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, TWENTIETH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(TWENTIETH_EXECUTABLE_BATCH_RULE_IDS.length, 26);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (TWENTIETH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(twentiethBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(twentiethBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      const expected = twentiethBatchExpectedLiveKey(
        rule.id as (typeof TWENTIETH_EXECUTABLE_BATCH_RULE_IDS)[number],
      );
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.ok(pred, rule.id);
      assert.equal(pred.catalogKey, expected, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-7.3.5");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not reuse false-friend keys and leaves already-wired leftovers on their batches", () => {
    const loaded = readCommittedCatalog();
    const nineteenth = loaded.parents.find((r) => r.id === "REQ-1.10.14");
    assert.ok(nineteenth);
    assert.equal(applyTwentiethExecutableBatchOverlay(nineteenth).predicates.length, 0);
    const overlaid = applyNineteenthExecutableBatchOverlay(nineteenth);
    assert.ok(overlaid.predicates.length > 0);
    assert.equal(twentiethBatchParentIsWired(overlaid), false);
    assert.ok(twentiethBatchOmitsFalseFriends());
    for (const key of TWENTIETH_BATCH_FALSE_FRIEND_KEYS) {
      assert.equal(
        (TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key),
        false,
        key,
      );
    }
    assert.equal(sowCatalogEntryByKey("ol_capacity_comply")?.key, "ol_capacity_comply");
    assert.notEqual(sowCatalogEntryByKey("ol_capacity_comply")?.key, "ol_rhs_license_4plus");
    assert.notEqual(sowCatalogEntryByKey("agency_license_register")?.key, "ol_day_tx_license_4plus");
    assert.notEqual(sowCatalogEntryByKey("els_residential_eligibility")?.key, "els_school_age");
    assert.notEqual(sowCatalogEntryByKey("sec_requires_sei")?.key, "sec_pass_documentation");
    assert.notEqual(sowCatalogEntryByKey("sjp_requires_sjd")?.key, "milestone_rfs");
    assert.notEqual(
      sowCatalogEntryByKey("group_service_review_historical")?.key,
      "residential_group_mix",
    );
    assert.notEqual(sowCatalogEntryByKey("dlbc_group_variance")?.key, "residential_group_mix");
    assert.notEqual(sowCatalogEntryByKey("staff_minimum_age")?.key, "host_staff_qualifications");
    assert.notEqual(sowCatalogEntryByKey("person_record_file")?.key, "dnr_order_access");
    assert.notEqual(sowCatalogEntryByKey("upi_employee_registry")?.key, "upi_form_0_9_designee");
    assert.notEqual(sowCatalogEntryByKey("upi_employee_timesheet")?.key, "sei_employment_data_upi");
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-11.3"], undefined);
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-20.3"], undefined);
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-21.3"], undefined);
  });

  it("keeps leftover children on the parent card and uses the fourteen invented liveKeys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-11.3.2",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "home_condition_checklist",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-11.3.2",
        liveKey: "home_condition_checklist",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("ol_capacity_comply"), [
      "REQ-7.3.5",
      "REQ-8.3.3",
      "REQ-9.3.5",
      "REQ-22.3.3",
      "REQ-23.3.4",
      "REQ-24.3.3",
      "REQ-25.3.4",
      "REQ-26.3.2",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("upi_employee_registry"), [
      "REQ-30.8.1",
      "REQ-33.7.1",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("upi_employee_timesheet"), [
      "REQ-30.8.2",
      "REQ-33.7.2",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("agency_license_register"), [
      "REQ-1.4.3",
      "REQ-1.34",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("els_residential_eligibility"), [
      "REQ-10.5",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("home_condition_checklist"), [
      "REQ-11.3.2",
      "REQ-20.3.2",
      "REQ-21.3.2",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("sec_requires_sei"), ["REQ-27.5"]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("sjp_requires_sjd"), ["REQ-34.5"]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("sjr_requires_see_or_sei"), ["REQ-35.5"]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("group_service_review_historical"), [
      "REQ-1.32.a",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("dlbc_group_variance"), ["REQ-1.32.c"]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("medicaid_provider_training_offered"), [
      "REQ-1.13.4",
    ]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("person_record_file"), ["REQ-1.10"]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("staff_minimum_age"), ["REQ-1.5"]);
    assert.deepEqual(twentiethBatchSharedLiveKeyParents("residential_group_mix"), []);
  });

  it("wires the invented pack liveKeys through the live engine", () => {
    assert.deepEqual([...TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS], [
      "ol_capacity_comply",
      "upi_employee_registry",
      "upi_employee_timesheet",
      "agency_license_register",
      "els_residential_eligibility",
      "home_condition_checklist",
      "sec_requires_sei",
      "sjp_requires_sjd",
      "sjr_requires_see_or_sei",
      "group_service_review_historical",
      "dlbc_group_variance",
      "medicaid_provider_training_offered",
      "person_record_file",
      "staff_minimum_age",
    ]);
    assert.equal(TWENTIETH_BATCH_ENGINE_BINDINGS.length, 26);
    for (const row of TWENTIETH_BATCH_ENGINE_BINDINGS) {
      const ready = twentiethBatchLiveEngineReady(row);
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
    for (const key of TWENTIETH_BATCH_ADMIN_ONLY_LIVE_KEYS) {
      assert.equal(sowCatalogEntryByKey(key)?.owner, "admin", key);
    }
    assert.equal(
      twentiethBatchAssignmentOpensClock("ol_capacity_comply", EMPTY_ORG_FACTS, ["DSG", "DSP"]),
      false,
    );
    assert.equal(
      twentiethBatchAssignmentOpensClock(
        "ol_capacity_comply",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["DSG"] },
        ["DSG", "DSP"],
      ),
      true,
    );
    assert.equal(
      twentiethBatchAssignmentOpensClock("els_residential_eligibility", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["ELS"],
      }, ["ELS"], ["RHS", "PPS", "HHS"]),
      false,
    );
    assert.equal(
      twentiethBatchAssignmentOpensClock("els_residential_eligibility", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["ELS", "HHS"],
      }, ["ELS"], ["RHS", "PPS", "HHS"]),
      true,
    );
    assert.equal(
      twentiethBatchAssignmentOpensClock("sjr_requires_see_or_sei", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["SJR", "SEI"],
      }, ["SJR"], ["SEE", "SEI"]),
      true,
    );
    assert.equal(
      twentiethBatchAssignmentOpensClock("agency_license_register", EMPTY_ORG_FACTS),
      true,
    );
    assert.equal(
      twentiethBatchAssignmentOpensClock("staff_minimum_age", EMPTY_ORG_FACTS),
      true,
    );
    const staffAge = sowCatalogEntryByKey("staff_minimum_age");
    assert.ok(staffAge);
    assert.equal(staffAge.fulfillment, "standing");
    assert.notEqual(staffAge.category, "training");
  });

  it("maps official catalog parent clause_text — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    for (const id of TWENTIETH_EXECUTABLE_BATCH_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      const official = twentiethBatchOfficialClause(id);
      const workbook = parent.workbookRow.clause_text;
      assert.equal(typeof workbook, "string", id);
      assert.equal(official, workbook, id);
      const overlaid = applyTwentiethExecutableBatchOverlay(parent);
      assert.equal(overlaid.group.members[0]?.label, official, id);
      assert.equal(overlaid.evidence.summary, official, id);
    }
  });

  it("missing awarded-code facts stay questions — never silent N/A", () => {
    const ol = twentiethBatchLiveFactsForRule("REQ-7.3.5");
    assert.equal(ol[0]?.fact_id, "FACT-015");
    const unanswered = evaluateCatalogFact(ol[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /DSG|DSP/i);
    const els = twentiethBatchLiveFactsForRule("REQ-10.5");
    assert.equal(els[0]?.fact_id, "FACT-026");
    assert.equal(evaluateCatalogFact(els[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    assert.deepEqual(twentiethBatchLiveFactsForRule("REQ-1.13.4"), []);
    assert.deepEqual(twentiethBatchLiveFactsForRule("REQ-1.5"), []);
  });

  it("keeps UPI leftovers off DSP My Tasks and 1.5 off a training upload", () => {
    const loaded = readCommittedCatalog();
    const registry = applyTwentiethExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-30.8.1")!,
    );
    assert.deepEqual(registry.completionRoutes, ["IN_PLATFORM"]);
    assert.equal(sowCatalogEntryByKey("upi_employee_registry")?.owner, "admin");
    assert.equal(sowCatalogEntryByKey("upi_employee_timesheet")?.owner, "admin");
    const age = applyTwentiethExecutableBatchOverlay(loaded.parents.find((r) => r.id === "REQ-1.5")!);
    assert.deepEqual(age.completionRoutes, ["SYSTEM"]);
    assert.equal(age.timing.kind, "none");
    const offered = applyTwentiethExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-1.13.4")!,
    );
    assert.equal(offered.timing.kind, "none");
    assert.equal(offered.predicates[0]?.kind, "as_offered_event");
    const tenFive = applyTwentiethExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-10.5")!,
    );
    assert.equal(tenFive.predicates.length, 2);
    assert.ok(tenFive.predicates.every((p) => p.kind === "eligibility_gate"));
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      TWENTIETH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = twentiethExecutableBatchParents(loaded.parents);
    assert.equal(screens.length, 26);
    const result = simulateDraftRules({
      rules: screens,
      staff: [
        {
          ...UNKNOWN_STAFF_DUTY_FACTS,
          staffId: "admin-1",
          role: "admin",
          hireDate: "2026-07-01",
          acreCertified: null,
          supervisorAcreCertified: null,
        },
      ],
      orgFacts: EMPTY_ORG_FACTS,
      evidence: [],
      now: new Date("2026-09-15T12:00:00.000Z"),
    });
    assert.equal(result.wroteDatabase, false);
    assert.equal(result.createdLiveAssignments, false);
    assert.equal(result.activatedRules, false);
  });
});
