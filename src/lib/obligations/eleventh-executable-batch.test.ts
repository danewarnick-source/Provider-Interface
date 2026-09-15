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
  ELEVENTH_BATCH_DEMO_PATH,
  ELEVENTH_BATCH_ENGINE_BINDINGS,
  ELEVENTH_EXECUTABLE_BATCH_LIVE_KEYS,
  ELEVENTH_EXECUTABLE_BATCH_RULE_IDS,
  applyEleventhExecutableBatchOverlay,
  eleventhBatchAssignmentOpensClock,
  eleventhBatchLiveEngineReady,
  eleventhBatchLiveFactsForRule,
  eleventhBatchOmitsInventedMonthlyUpiUmbrellasAndClusterB,
  eleventhBatchParentIsWired,
  eleventhBatchPublicationStaysDeliberate,
  eleventhBatchSharedLiveKeyParents,
  eleventhExecutableBatchParents,
} from "./eleventh-executable-batch.ts";
import { applyTenthExecutableBatchOverlay } from "./tenth-executable-batch.ts";
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

const EXPECTED_LIVE_KEY: Record<string, string> = {
  "REQ-8.6.c": "dsi_annual_outcome",
  "REQ-11.7.c": "hhs_annual_outcome",
  "REQ-30.7.c": "sei_annual_outcome",
  "REQ-31.5.c": "sl_annual_outcome",
  "REQ-32.7.c": "sl_annual_outcome",
};

describe("eleventh executable batch — FY Google Form annual twins", () => {
  it("overlays fixture logic onto the 34 imported twins without publishing", () => {
    const loaded = readCommittedCatalog();
    const batch = eleventhExecutableBatchParents(loaded.parents);
    assert.equal(batch.length, ELEVENTH_EXECUTABLE_BATCH_RULE_IDS.length);
    assert.equal(ELEVENTH_EXECUTABLE_BATCH_RULE_IDS.length, 34);
    assert.equal(VERIFIED_PUBLICATIONS.length, 50);
    assert.equal(
      VERIFIED_PUBLICATIONS.some((row) =>
        (ELEVENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(row.ruleId),
      ),
      false,
    );
    for (const rule of batch) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.ok(canPublish(rule), `${rule.id} ${JSON.stringify(rule.predicates)}`);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(eleventhBatchPublicationStaysDeliberate(rule), true, rule.id);
      assert.ok(eleventhBatchParentIsWired(rule), rule.id);
      assert.equal(rule.group.parentAssignment, "one", rule.id);
      assert.equal(rule.timing.kind, "none", rule.id);
      const expected = EXPECTED_LIVE_KEY[rule.id] ?? "hhs_annual_outcome";
      assert.equal(liveObligationKeyForRule(rule), expected, rule.id);
      const pred = rule.predicates[0];
      assert.equal(pred?.kind, "awarded_service_codes", rule.id);
      assert.equal(pred?.catalogKey, expected, rule.id);
      assert.ok((pred?.serviceCodes?.length ?? 0) > 0, rule.id);
    }
    const raw = loaded.parents.find((r) => r.id === "REQ-11.7.c");
    assert.ok(raw);
    assert.equal(canPublish(raw), false);
  });

  it("does not overlay FBA/BSP, UPI 1.15, monthly summaries, or invented umbrellas", () => {
    const loaded = readCommittedCatalog();
    const fba = loaded.parents.find((r) => r.id === "REQ-3.3.1");
    assert.ok(fba);
    assert.equal(applyEleventhExecutableBatchOverlay(fba).predicates.length, fba.predicates.length);
    assert.equal(eleventhBatchParentIsWired(fba), false);
    const tenth = applyTenthExecutableBatchOverlay(loaded.parents.find((r) => r.id === "REQ-11.7.c")!);
    assert.equal(tenth.predicates.length, 0);
    const upi = loaded.parents.find((r) => r.id === "REQ-1.15.1");
    assert.ok(upi);
    assert.equal(eleventhBatchParentIsWired(upi), false);
    const seiMonthly = loaded.parents.find((r) => r.id === "REQ-30.3.4");
    assert.ok(seiMonthly);
    assert.equal(eleventhBatchParentIsWired(seiMonthly), false);
    assert.equal(loaded.parents.some((r) => r.id === "REQ-8.6"), false);
    assert.equal(loaded.parents.some((r) => r.id === "REQ-11.7"), false);
    assert.equal(loaded.parents.some((r) => r.id === "REQ-30.7"), false);
  });

  it("keeps child elements off the staff-task queue and shares the annual-outcome family", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-11.7.c",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    const filtered = staffTasksWithoutElementDuplicates([
      {
        requirementRole: "parent",
        parentRequirementKey: null,
        liveKey: "hhs_annual_outcome",
        id: "a",
      },
      {
        requirementRole: "element",
        parentRequirementKey: "REQ-11.7.c",
        liveKey: "hhs_annual_outcome",
        id: "e",
      },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["a"],
    );
    assert.deepEqual(eleventhBatchSharedLiveKeyParents("fba_bsp"), []);
    assert.ok(eleventhBatchSharedLiveKeyParents("hhs_annual_outcome").includes("REQ-11.7.c"));
    assert.ok(eleventhBatchSharedLiveKeyParents("hhs_annual_outcome").includes("REQ-3.7.c"));
    assert.ok(eleventhBatchSharedLiveKeyParents("hhs_annual_outcome").includes("REQ-18.6.c"));
    assert.ok(eleventhBatchSharedLiveKeyParents("hhs_annual_outcome").includes("REQ-19.6.c"));
    assert.equal(eleventhBatchSharedLiveKeyParents("hhs_annual_outcome").length, 30);
    assert.deepEqual(eleventhBatchSharedLiveKeyParents("dsi_annual_outcome"), ["REQ-8.6.c"]);
    assert.deepEqual(eleventhBatchSharedLiveKeyParents("sei_annual_outcome"), ["REQ-30.7.c"]);
    assert.ok(eleventhBatchSharedLiveKeyParents("sl_annual_outcome").includes("REQ-31.5.c"));
    assert.ok(eleventhBatchSharedLiveKeyParents("sl_annual_outcome").includes("REQ-32.7.c"));
    assert.deepEqual(eleventhBatchSharedLiveKeyParents("fy_google_form_annual"), []);
  });

  it("wires the existing annual-outcome family through the live engine", () => {
    assert.deepEqual(
      [...ELEVENTH_EXECUTABLE_BATCH_LIVE_KEYS],
      [
        "hhs_annual_outcome",
        "dsi_annual_outcome",
        "sei_annual_outcome",
        "sl_annual_outcome",
      ],
    );
    assert.equal(ELEVENTH_BATCH_ENGINE_BINDINGS.length, 34);
    for (const row of ELEVENTH_BATCH_ENGINE_BINDINGS) {
      const ready = eleventhBatchLiveEngineReady(row);
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
    assert.equal(eleventhBatchAssignmentOpensClock("hhs_annual_outcome", EMPTY_ORG_FACTS), false);
    assert.equal(
      eleventhBatchAssignmentOpensClock("hhs_annual_outcome", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["HHS"],
      }),
      true,
    );
    assert.equal(
      eleventhBatchAssignmentOpensClock("dsi_annual_outcome", {
        ...EMPTY_ORG_FACTS,
        servicesOffered: ["DSI"],
      }),
      true,
    );
    assert.equal(
      eleventhBatchAssignmentOpensClock(
        "hhs_annual_outcome",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["PN1"] },
        ["PN1"],
      ),
      true,
    );
    assert.equal(
      eleventhBatchAssignmentOpensClock(
        "hhs_annual_outcome",
        { ...EMPTY_ORG_FACTS, servicesOffered: ["HHS"] },
        ["PN1"],
      ),
      false,
    );
    const loaded = readCommittedCatalog();
    const pn1 = applyEleventhExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-18.6.c")!,
    );
    assert.deepEqual(pn1.predicates[0]?.serviceCodes, ["PN1"]);
    const bc1 = applyEleventhExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-3.7.c")!,
    );
    assert.deepEqual(bc1.predicates[0]?.serviceCodes, ["BC1"]);
    const sln = applyEleventhExecutableBatchOverlay(
      loaded.parents.find((r) => r.id === "REQ-32.7.c")!,
    );
    assert.deepEqual(sln.predicates[0]?.serviceCodes, ["CMP", "CMS", "SLN"]);
    assert.ok(eleventhBatchOmitsInventedMonthlyUpiUmbrellasAndClusterB());
  });

  it("maps official catalog clause_text and article awarded codes — no invented SOW text", () => {
    const loaded = readCommittedCatalog();
    const catalog = JSON.parse(
      readFileSync(join(DHHS91172_CATALOG_DIR, "Requirements.json"), "utf8"),
    ) as { rows?: Array<{ requirement_key?: string; clause_text?: string; service_codes?: string }> };
    const rows = catalog.rows ?? [];
    for (const id of ELEVENTH_EXECUTABLE_BATCH_RULE_IDS) {
      const official = rows.find((row) => row.requirement_key === id);
      assert.ok(official?.clause_text, id);
      const overlaid = applyEleventhExecutableBatchOverlay(loaded.parents.find((r) => r.id === id)!);
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
    const hhs = eleventhBatchLiveFactsForRule("REQ-11.7.c");
    assert.equal(hhs[0]?.fact_id, "FACT-004");
    const unanswered = evaluateCatalogFact(hhs[0]!, EMPTY_ORG_FACTS);
    assert.equal(unanswered.status, "unanswered");
    assert.match(unanswered.prompt, /HHS/i);
    assert.equal(eleventhBatchLiveFactsForRule("REQ-8.6.c")[0]?.fact_id, "FACT-019");
    assert.equal(eleventhBatchLiveFactsForRule("REQ-30.7.c")[0]?.fact_id, "FACT-008");
    assert.equal(eleventhBatchLiveFactsForRule("REQ-18.6.c")[0]?.fact_id, "FACT-037");
    assert.equal(eleventhBatchLiveFactsForRule("REQ-19.6.c")[0]?.fact_id, "FACT-014");
    assert.equal(eleventhBatchLiveFactsForRule("REQ-3.7.c")[0]?.fact_id, "FACT-010");
  });

  it("documents a five-step demo path and simulates without activating", () => {
    assert.deepEqual(
      ELEVENTH_BATCH_DEMO_PATH.map((s) => s.step),
      ["facts", "task", "evidence", "review", "renewal"],
    );
    const loaded = readCommittedCatalog();
    const screens = eleventhExecutableBatchParents(loaded.parents).filter(
      (r) => r.id === "REQ-11.7.c" || r.id === "REQ-18.6.c",
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
