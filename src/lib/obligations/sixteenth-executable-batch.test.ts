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
  SIXTEENTH_BATCH_DEMO_PATH,
  SIXTEENTH_BATCH_ENGINE_BINDINGS,
  SIXTEENTH_BATCH_INVENT_BLOCKED_RULE_IDS,
  SIXTEENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS,
  applySixteenthExecutableBatchOverlay,
  sixteenthBatchAssignmentOpensClock,
  sixteenthBatchExpectedLiveKey,
  sixteenthBatchLiveEngineReady,
  sixteenthBatchLiveFactsForRule,
  sixteenthBatchOfficialClause,
  sixteenthBatchOmitsInventedKeysAndBlockedFamilies,
  sixteenthBatchParentIsWired,
  sixteenthBatchPublicationStaysDeliberate,
  sixteenthBatchSharedLiveKeyParents,
  sixteenthExecutableBatchParents,
} from "./sixteenth-executable-batch.ts";
import { applyFifteenthExecutableBatchOverlay } from "./fifteenth-executable-batch.ts";
import { evaluateCatalogFact } from "./catalog-fact-questions.ts";
import { liveObligationKeyForRule, staffTaskPolicy } from "./catalog-live-bridge.ts";

describe("sixteenth executable batch — remaining pack-key-ready leftovers", () => {
  it("overlays fixture logic onto the 26 leftover children without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = sixteenthExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS.length, 26);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(sixteenthBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(sixteenthBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      const expected = sixteenthBatchExpectedLiveKey(
        rule.id as (typeof SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number],
      );
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.ok(pred, rule.id);
      assert.equal(pred.catalogKey, expected, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-1.27.1");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("leaves invent-blocked rows unwired and does not invent keys", () => {
    const loaded = readCommittedCatalog();
    for (const id of SIXTEENTH_BATCH_INVENT_BLOCKED_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      if (!parent) continue;
      assert.equal(applySixteenthExecutableBatchOverlay(parent).predicates.length, 0, id);
      assert.equal(sixteenthBatchParentIsWired(parent), false, id);
    }
    const standing = loaded.parents.find((r) => r.id === "REQ-1.6.1");
    assert.ok(standing);
    assert.equal(applySixteenthExecutableBatchOverlay(standing).predicates.length, 0);
    const fifteenth = applyFifteenthExecutableBatchOverlay(standing);
    assert.ok(fifteenth.predicates.length > 0);
    assert.equal(sixteenthBatchParentIsWired(fifteenth), false);
    assert.ok(sixteenthBatchOmitsInventedKeysAndBlockedFamilies());
  });

  it("keeps leftover children on the parent card and uses existing liveKeys only", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.27.1",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "incident_reporting_process",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-1.27.1",
        liveKey: "incident_reporting_process",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(sixteenthBatchSharedLiveKeyParents("incident_reporting_process"), [
      "REQ-1.27.1",
      "REQ-1.27.1.A",
      "REQ-1.27.1.B",
      "REQ-1.27.2",
      "REQ-1.27.3",
      "REQ-1.27.4",
      "REQ-1.27.5",
      "REQ-1.27.6",
    ]);
    assert.deepEqual(sixteenthBatchSharedLiveKeyParents("hrc_committee"), ["REQ-1.20.a"]);
    assert.deepEqual(sixteenthBatchSharedLiveKeyParents("rights_restriction_record"), [
      "REQ-1.20.b",
      "REQ-1.20.b.6",
      "REQ-1.28.6",
      "REQ-1.33.2",
    ]);
    assert.deepEqual(sixteenthBatchSharedLiveKeyParents("belongings_inventory"), [
      "REQ-20.3.5",
      "REQ-21.3.7",
      "REQ-31.3.3",
    ]);
    assert.deepEqual(sixteenthBatchSharedLiveKeyParents("pba_financial_review"), [
      "REQ-15.3.1",
      "REQ-15.3.6",
      "REQ-15.3.8",
      "REQ-15.3.9",
      "REQ-15.3.10",
    ]);
    assert.deepEqual(sixteenthBatchSharedLiveKeyParents("volunteer_training_file"), []);
  });

  it("wires existing pack liveKeys through the live engine", () => {
    assert.deepEqual([...SIXTEENTH_EXECUTABLE_BATCH_LIVE_KEYS], [
      "incident_reporting_process",
      "hrc_committee",
      "rights_restriction_record",
      "belongings_inventory",
      "pps_room_board_agreement",
      "pps_foster_license",
      "pba_financial_review",
      "hsq_safe_environment",
      "usor_job_development_sjd",
    ]);
    assert.equal(SIXTEENTH_BATCH_ENGINE_BINDINGS.length, 26);
    for (const row of SIXTEENTH_BATCH_ENGINE_BINDINGS) {
      const ready = sixteenthBatchLiveEngineReady(row);
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
    assert.equal(
      sixteenthBatchAssignmentOpensClock("incident_reporting_process", EMPTY_ORG_FACTS),
      true,
    );
    assert.equal(sixteenthBatchAssignmentOpensClock("hsq_safe_environment", EMPTY_ORG_FACTS), false);
    assert.equal(
      sixteenthBatchAssignmentOpensClock("hsq_safe_environment", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HSQ"],
      }),
      true,
    );
    assert.equal(
      sixteenthBatchAssignmentOpensClock("pps_foster_license", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      false,
    );
    assert.equal(
      sixteenthBatchAssignmentOpensClock("pps_foster_license", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["PPS"],
      }),
      true,
    );
    assert.equal(
      sixteenthBatchAssignmentOpensClock("usor_job_development_sjd", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["SJD"],
      }),
      true,
    );
    assert.equal(
      sixteenthBatchAssignmentOpensClock(
        "belongings_inventory",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["PPS"] },
        ["PPS"],
      ),
      true,
    );
    assert.equal(
      sixteenthBatchAssignmentOpensClock(
        "belongings_inventory",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["SEI"] },
        ["PPS"],
      ),
      false,
    );
  });

  it("maps official catalog parent clause_text — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    for (const id of SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const parent = loaded.parents.find((r) => r.id === id);
      assert.ok(parent, id);
      const official = sixteenthBatchOfficialClause(id);
      const workbook = parent.workbookRow.clause_text;
      assert.equal(typeof workbook, "string", id);
      assert.equal(official, workbook, id);
      const overlaid = applySixteenthExecutableBatchOverlay(parent);
      assert.equal(overlaid.group.members[0]?.label, official, id);
      assert.equal(overlaid.evidence.summary, official, id);
    }
  });

  it("missing awarded-code facts stay questions — never silent N/A", () => {
    const hsq = sixteenthBatchLiveFactsForRule("REQ-12.4");
    assert.equal(hsq[0]?.fact_id, "FACT-045");
    const unanswered = evaluateCatalogFact(hsq[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /HSQ/i);
    const pps = sixteenthBatchLiveFactsForRule("REQ-20.3.9");
    assert.equal(pps[0]?.fact_id, "FACT-001");
    assert.equal(evaluateCatalogFact(pps[0]!, EMPTY_ORG_FACTS).status, "unanswered");
    assert.equal(sixteenthBatchLiveFactsForRule("REQ-1.27.1").length, 0);
    assert.equal(sixteenthBatchLiveFactsForRule("REQ-1.20.a").length, 0);
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      SIXTEENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = sixteenthExecutableBatchParents(loaded.parents);
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
