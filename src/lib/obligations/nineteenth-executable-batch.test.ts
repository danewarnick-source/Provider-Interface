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
  NINETEENTH_BATCH_DEMO_PATH,
  NINETEENTH_BATCH_ENGINE_BINDINGS,
  NINETEENTH_BATCH_HOLD_OUT_RULE_IDS,
  NINETEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  NINETEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyNineteenthExecutableBatchOverlay,
  nineteenthBatchAssignmentOpensClock,
  nineteenthBatchExpectedLiveKey,
  nineteenthBatchLiveEngineReady,
  nineteenthBatchLiveFactsForRule,
  nineteenthBatchOfficialClause,
  nineteenthBatchOmitsBlockedFamilies,
  nineteenthBatchParentIsWired,
  nineteenthBatchPublicationStaysDeliberate,
  nineteenthBatchSharedLiveKeyParents,
  nineteenthExecutableBatchParents,
} from "./nineteenth-executable-batch.ts";
import { applyEighteenthExecutableBatchOverlay } from "./eighteenth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { EXPLICIT_REQ_TO_LIVE_KEY, liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

describe("nineteenth executable batch — remaining inventable leftovers", () => {
  it("overlays fixture logic onto the 25 leftover children without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = nineteenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, NINETEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(NINETEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 25);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (NINETEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(nineteenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(nineteenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      const expected = nineteenthBatchExpectedLiveKey(
        rule.id as (typeof NINETEENTH_EXECUTABLE_BATCH_RULE_IDS)[number],
      );
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.ok(pred, rule.id);
      assert.equal(pred.catalogKey, expected, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.10.14");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("leaves product-blocked families unwired and does not invent UPI or umbrellas", () => {
    const loaded = readCommittedCatalog();
    for (const id of NINETEENTH_BATCH_HOLD_OUT_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      if (!parent) continue;
      assert.equal(applyNineteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(nineteenthBatchParentIsWired(parent), false, id);
      assert.equal(EXPLICIT_REQ_TO_LIVE_KEY[id], undefined, id);
    }
    const eighteenth = loaded.parents.find((r) => r.id === "REQ-33.2.a");
    assert.ok(eighteenth);
    assert.equal(applyNineteenthExecutableBatchOverlay(eighteenth).predicates.length, 0);
    const overlaid = applyEighteenthExecutableBatchOverlay(eighteenth);
    assert.ok(overlaid.predicates.length > 0);
    assert.equal(nineteenthBatchParentIsWired(overlaid), false);
    assert.ok(nineteenthBatchOmitsBlockedFamilies());
    assert.equal(sowCatalogEntryByKey("dnr_order_access")?.key, "dnr_order_access");
    assert.equal(sowCatalogEntryByKey("pba_monthly_fiduciary")?.key, "pba_monthly_fiduciary");
    assert.notEqual(sowCatalogEntryByKey("pba_monthly_fiduciary")?.key, "pba_financial_review");
    assert.notEqual(sowCatalogEntryByKey("see_staff_training")?.key, "acre_sei");
  });

  it("keeps leftover children on the parent card and uses the sixteen invented liveKeys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.10.14",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "dnr_order_access",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.10.14",
        liveKey: "dnr_order_access",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("dnr_order_access"), ["REQ-1.10.14"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("pcsp_person_review"), [
      "REQ-1.24.7",
      "REQ-1.24.9",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("fatality_notification"), ["REQ-1.26"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("sc_records_on_request"), [
      "REQ-1.31.2",
      "REQ-1.31.3",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("residential_group_mix"), ["REQ-1.32.b"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("usdc_transition"), [
      "REQ-1.36.a",
      "REQ-1.36.b",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("els_school_age"), ["REQ-10.3.3"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("host_contractor_change"), [
      "REQ-11.3.8",
      "REQ-20.3.8",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("host_staff_qualifications"), [
      "REQ-11.6",
      "REQ-20.6",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("pba_monthly_fiduciary"), [
      "REQ-15.2.6",
      "REQ-15.2.10",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("rhs_form_930"), ["REQ-21.3.4"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("form_929_exceptional_care"), [
      "REQ-23.3.1",
      "REQ-25.3.1",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("sec_pass_documentation"), ["REQ-27.3"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("see_staff_training"), [
      "REQ-29.4.1",
      "REQ-29.4.2",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("sei_job_termination"), ["REQ-30.3.3"]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("tfb_staff_qualifications"), [
      "REQ-36.4.1",
      "REQ-36.4.2",
    ]);
    assert.deepEqual(nineteenthBatchSharedLiveKeyParents("client_specific_training"), []);
  });

  it("wires the invented pack liveKeys through the live engine", () => {
    assert.deepEqual([...NINETEENTH_EXECUTABLE_BATCH_LIVE_KEYS], [
      "dnr_order_access",
      "pcsp_person_review",
      "fatality_notification",
      "sc_records_on_request",
      "residential_group_mix",
      "usdc_transition",
      "els_school_age",
      "host_contractor_change",
      "host_staff_qualifications",
      "pba_monthly_fiduciary",
      "rhs_form_930",
      "form_929_exceptional_care",
      "sec_pass_documentation",
      "see_staff_training",
      "sei_job_termination",
      "tfb_staff_qualifications",
    ]);
    assert.equal(NINETEENTH_BATCH_ENGINE_BINDINGS.length, 25);
    for (const row of NINETEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = nineteenthBatchLiveEngineReady(row);
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
    assert.equal(nineteenthBatchAssignmentOpensClock("els_school_age", EMPTY_ORG_FACTS), false);
    assert.equal(
      nineteenthBatchAssignmentOpensClock("els_school_age", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["ELS"],
      }),
      true,
    );
    assert.equal(
      nineteenthBatchAssignmentOpensClock(
        "els_school_age",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] },
        ["ELS"],
      ),
      false,
    );
    assert.equal(
      nineteenthBatchAssignmentOpensClock("residential_group_mix", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      nineteenthBatchAssignmentOpensClock("dnr_order_access", EMPTY_ORG_FACTS),
      true,
    );
    assert.equal(
      nineteenthBatchAssignmentOpensClock("fatality_notification", EMPTY_ORG_FACTS),
      true,
    );
  });

  it("maps official catalog parent clause_text — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    for (const id of NINETEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      const official = nineteenthBatchOfficialClause(id);
      const workbook = parent.workbookRow.clause_text;
      assert.equal(typeof workbook, "string", id);
      assert.equal(official, workbook, id);
      const overlaid = applyNineteenthExecutableBatchOverlay(parent);
      assert.equal(overlaid.group.members[0]?.label, official, id);
      assert.equal(overlaid.evidence.summary, official, id);
    }
  });

  it("missing awarded-code facts stay questions — never silent N/A", () => {
    const els = nineteenthBatchLiveFactsForRule("REQ-10.3.3");
    assert.equal(els[0]?.fact_id, "FACT-026");
    const unanswered = evaluateCatalogFact(els[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /ELS/i);
    const dnr = nineteenthBatchLiveFactsForRule("REQ-1.10.14");
    assert.equal(dnr[0]?.fact_id, "FACT-068");
    assert.equal(evaluateCatalogFact(dnr[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    assert.deepEqual(nineteenthBatchLiveFactsForRule("REQ-1.26"), []);
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      NINETEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = nineteenthExecutableBatchParents(loaded.parents);
    assert.equal(screens.length, 25);
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
