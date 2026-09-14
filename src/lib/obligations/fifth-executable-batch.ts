/**
 * Fifth shared-behavior executable batch: §1.10(7) service documentation
 * and §1.12 EVV. Independent lanes — a complete note never absorbs EVV,
 * timesheet, signature, or reporting.
 *
 * Overlays Core_Rule_Logic fixtures onto imported catalog parents so those
 * parents reuse the live timesheet / EVV / HHS-billable-day engine. Child
 * elements stay on the parent. Creates_user_task stays no — these are
 * in-platform records, not a second My tasks card. HHS uses the host-home
 * daily note + overnight confirmation, not the five-field punch schema.
 * EVV applies only to mandated codes in src/lib/evv-codes.ts. Do not invent
 * UEVV transmission success. Do not invent PN1/PN2 or quarterly clocks.
 * Publication stays off until VERIFIED_PUBLICATIONS is filled deliberately.
 */

import { isEvvLockedCode } from "../evv-codes.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import { type StaffDutyFacts } from "./duty-applicability.ts";
import { livePathQuestionByDutyKey } from "./setup-facts.ts";
import { PRODUCT_REMINDER_OFFSETS_DAYS } from "./draft-rules/reminders.ts";
import {
  HHS_NOTE_TEMPLATE,
  independentLaneStatus,
  selectNoteTemplate,
} from "./draft-rules/notes.ts";
import type { CatalogFact, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import {
  REQ_1_10_7_NOTES,
  REQ_1_10_7_TIMESHEET,
  REQ_1_10_SIGNATURE,
  REQ_1_12_EVV,
  draftRuleById,
} from "./draft-rules/fixtures.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type { DraftRule } from "./draft-rules/types.ts";

export const FIFTH_EXECUTABLE_BATCH_ID = "documentation_notes_evv" as const;

/** Imported catalog parents this batch overlays. */
export const FIFTH_EXECUTABLE_BATCH_RULE_IDS = ["REQ-1.10.7", "REQ-1.12"] as const;

/** Core_Rule_Logic fixture ids. Companions share the notes live key. */
export const FIFTH_EXECUTABLE_BATCH_FIXTURE_IDS = [
  "REQ-1.10.7",
  "REQ-1.10.7-timesheet",
  "REQ-1.12",
  "REQ-1.10-signature",
] as const;

export const FIFTH_EXECUTABLE_BATCH_COMPANION_RULE_IDS = [
  "REQ-1.10.7-timesheet",
  "REQ-1.10-signature",
] as const;

export const FIFTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "timesheets_attendance",
  "evv_visit_verification",
  "hhs_billable_day",
] as const;

export type FifthExecutableBatchRuleId = (typeof FIFTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type FifthExecutableBatchLiveKey = (typeof FIFTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type FifthBatchLiveFactKey =
  | "service_documentation_assignment"
  | "evv_assignment"
  | "hhs_daily_caseload";

export type FifthBatchEngineBinding = {
  ruleId: string;
  liveKeys: readonly FifthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  mintsStaffTask: false;
  assignment: "caseload_reeval";
  evidence: "in_platform_record";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: FifthBatchLiveFactKey;
  independentLanes: readonly ("note" | "timesheet" | "evv" | "signature")[];
  sharesLiveKeyWith: readonly string[];
};

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.10.7": REQ_1_10_7_NOTES,
  "REQ-1.10.7-timesheet": REQ_1_10_7_TIMESHEET,
  "REQ-1.12": REQ_1_12_EVV,
  "REQ-1.10-signature": REQ_1_10_SIGNATURE,
};

export const FIFTH_BATCH_ENGINE_BINDINGS: readonly FifthBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.10.7",
    liveKeys: ["timesheets_attendance", "hhs_billable_day"],
    parentAssignment: "one",
    mintsElementTasks: false,
    mintsStaffTask: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_record",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "service_documentation_assignment",
    independentLanes: ["note"],
    sharesLiveKeyWith: ["REQ-1.10.7-timesheet", "REQ-1.10-signature"],
  },
  {
    ruleId: "REQ-1.12",
    liveKeys: ["evv_visit_verification"],
    parentAssignment: "one",
    mintsElementTasks: false,
    mintsStaffTask: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_record",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "evv_assignment",
    independentLanes: ["evv"],
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.10.7-timesheet",
    liveKeys: ["timesheets_attendance"],
    parentAssignment: "one",
    mintsElementTasks: false,
    mintsStaffTask: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_record",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "service_documentation_assignment",
    independentLanes: ["timesheet"],
    sharesLiveKeyWith: ["REQ-1.10.7", "REQ-1.10-signature"],
  },
  {
    ruleId: "REQ-1.10-signature",
    liveKeys: ["timesheets_attendance"],
    parentAssignment: "one",
    mintsElementTasks: false,
    mintsStaffTask: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_record",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "service_documentation_assignment",
    independentLanes: ["signature"],
    sharesLiveKeyWith: ["REQ-1.10.7", "REQ-1.10.7-timesheet"],
  },
];

/** Reese E2E: facts → record → independent lanes → review → per-visit renewal. */
export const FIFTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record who received service and which codes were delivered",
    detail:
      "Which persons received a documented service. Which staff are assigned an EVV-mandated code. Empty stays a question. HHS, DSI, and SEI are not EVV-mandated.",
  },
  {
    step: "task",
    title: "One parent record — not a second My tasks card",
    detail:
      "The live note, timesheet, and EVV punch are the parent. Child file items stay on that record. creates_user_task stays no. Completing the note does not mint EVV, payroll, or signature as extra staff cards.",
  },
  {
    step: "evidence",
    title: "Write the note; punch time; geofence only when mandated",
    detail:
      "General five-field note unless the HHS host-home override applies. Timesheet is the attendance record. EVV is a geofence-valid punch for mandated codes only. HIVE does not invent UEVV transmission success.",
  },
  {
    step: "review",
    title: "Supervisor samples the record",
    detail:
      "Note review and audit sampling sit on the service record. Product reminders go to the reviewer. EVV mapping review stays a fixture Release_Gap — this screen does not invent a state-integration fix.",
  },
  {
    step: "renewal",
    title: "Re-open per instance of service",
    detail:
      "Per visit / service date. No invented annual-from-completion. A complete note never absorbs the other lanes on the next visit.",
  },
] as const;

export function isFifthExecutableBatchRuleId(ruleId: string): boolean {
  return (FIFTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isFifthExecutableBatchFixtureId(ruleId: string): boolean {
  return (FIFTH_EXECUTABLE_BATCH_FIXTURE_IDS as readonly string[]).includes(ruleId);
}

export function isFifthExecutableBatchLiveKey(key: string): boolean {
  return (FIFTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function fifthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? draftRuleById(ruleId);
}

export function liveFactIdForFifthBatchKey(factKey: FifthBatchLiveFactKey): string {
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<FifthBatchLiveFactKey, string> = {
  service_documentation_assignment: "Which persons received a documented service?",
  evv_assignment: "Which staff are assigned an EVV-mandated service code?",
  hhs_daily_caseload: "Which persons have an HHS authorization and an overnight stay?",
};

export function fifthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = FIFTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  const fromPath =
    binding.liveKeys.length === 1 ? livePathQuestionByDutyKey(binding.liveKeys[0]) : null;
  const facts: CatalogFact[] = [
    {
      fact_id: liveFactIdForFifthBatchKey(binding.liveFactKey),
      question: fromPath?.question ?? LIVE_FACT_QUESTIONS[binding.liveFactKey],
    },
  ];
  if (ruleId === "REQ-1.10.7") {
    facts.push({
      fact_id: liveFactIdForFifthBatchKey("hhs_daily_caseload"),
      question: LIVE_FACT_QUESTIONS.hhs_daily_caseload,
    });
  }
  return facts;
}

function mergeCatalogFacts(
  existing: CatalogFact[] | undefined,
  added: CatalogFact[],
): CatalogFact[] {
  const seen = new Set<string>();
  const out: CatalogFact[] = [];
  for (const fact of [...(existing ?? []), ...added]) {
    if (!fact.fact_id || seen.has(fact.fact_id)) continue;
    seen.add(fact.fact_id);
    out.push(fact);
  }
  return out;
}

export function applyFifthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = fifthBatchFixtureFor(rule.id);
  if (!fixture || !isFifthExecutableBatchFixtureId(rule.id)) return rule;
  const existingFacts =
    "applicabilityFacts" in rule ? (rule as LoadedDraftRule).applicabilityFacts : undefined;
  return {
    ...rule,
    catalogKeys: fixture.catalogKeys,
    predicates: fixture.predicates,
    group: fixture.group,
    timing: fixture.timing,
    evidence: fixture.evidence,
    completionRoutes: fixture.completionRoutes,
    tests: fixture.tests,
    unresolvedAlternatives: [],
    unresolvedRenewals: [],
    ...(existingFacts
      ? {
          applicabilityFacts: mergeCatalogFacts(
            existingFacts,
            fifthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyFifthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyFifthExecutableBatchOverlay(rule));
}

export function fifthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isFifthExecutableBatchRuleId(rule.id))
    .map((rule) => applyFifthExecutableBatchOverlay(rule));
}

export function fifthBatchBindingForRule(ruleId: string): FifthBatchEngineBinding | null {
  return FIFTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function fifthBatchLiveEngineReady(binding: FifthBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of binding.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== "by_design") {
      reasons.push(`${key} is ${entry.disposition}, not a by_design documentation/EVV path.`);
    }
  }
  if (binding.parentAssignment !== "one") {
    reasons.push("Parent assignment must stay one — no per-element staff tasks.");
  }
  if (binding.mintsElementTasks) {
    reasons.push("Child elements must not mint staff tasks.");
  }
  if (binding.mintsStaffTask) {
    reasons.push("This batch does not mint a My tasks card — the live record is the parent.");
  }
  if (binding.trainingTitle !== null) {
    reasons.push("This batch does not invent an in-Hive course.");
  }
  if (binding.formTitle !== null) {
    reasons.push("This batch does not invent a person form.");
  }
  if (binding.reminders !== "product_default") {
    reasons.push("Reminders must reuse product-default offsets, not invented SOW intervals.");
  }
  if (PRODUCT_REMINDER_OFFSETS_DAYS.length === 0) {
    reasons.push("Product reminder offsets are missing.");
  }
  if (binding.blocksSoloWhenLapsed !== isBlocksSoloWhenLapsedKey(binding.liveKeys[0])) {
    reasons.push(`Solo-lapse wiring mismatch for ${binding.liveKeys[0]}.`);
  }
  const notes = sowCatalogEntryByKey("timesheets_attendance");
  if (binding.ruleId === "REQ-1.10.7") {
    if (notes?.fulfillment !== "in_hive") {
      reasons.push("timesheets_attendance must stay the in-Hive attendance/note record.");
    }
    if (!binding.liveKeys.includes("hhs_billable_day")) {
      reasons.push("REQ-1.10.7 must also bind hhs_billable_day for the host-home override.");
    }
  }
  const evv = sowCatalogEntryByKey("evv_visit_verification");
  if (binding.ruleId === "REQ-1.12") {
    if (evv?.fulfillment !== "in_hive") {
      reasons.push("evv_visit_verification must stay the in-Hive geofence path.");
    }
    if (!isEvvLockedCode("SLN") || isEvvLockedCode("HHS") || isEvvLockedCode("SEI")) {
      reasons.push("EVV mandated-code table drifted — SLN is in, HHS/SEI stay out.");
    }
  }
  return { ready: reasons.length === 0, reasons };
}

export function fifthBatchAssignmentOpensClock(
  liveKey: FifthExecutableBatchLiveKey,
  staff: StaffDutyFacts,
): boolean {
  if (!staff.assignmentsKnown) return false;
  const codes = staff.assignedServiceCodes.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (codes.length === 0) return false;
  if (liveKey === "evv_visit_verification") {
    return codes.some((code) => isEvvLockedCode(code));
  }
  if (liveKey === "hhs_billable_day") {
    return codes.includes("HHS");
  }
  return true;
}

export function fifthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function fifthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isFifthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyFifthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isFifthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function fifthBatchKeepsLanesIndependent(rule: DraftRule): boolean {
  const text = `${rule.group.conditionNote ?? ""} ${rule.evidence.summary} ${rule.evidence.defaultHandlingLabel}`;
  if (rule.id === "REQ-1.10.7") {
    return (
      /never absorbs EVV|does not satisfy EVV|never absorb/i.test(text) &&
      /timesheet|payroll/i.test(text) &&
      /signature|reporting/i.test(text)
    );
  }
  if (rule.id === "REQ-1.12") {
    return /separate requirement from the service note|note never absorbs/i.test(text);
  }
  if (rule.id === "REQ-1.10.7-timesheet") {
    return /independent of the (service-documentation )?note|does not satisfy this lane/i.test(text);
  }
  if (rule.id === "REQ-1.10-signature") {
    return /independent of the note|does not attest/i.test(text);
  }
  return true;
}

export function fifthBatchHhsUsesDailyNoteOverride(): boolean {
  return (
    selectNoteTemplate("HHS", "2026-09-14")?.id === HHS_NOTE_TEMPLATE.id &&
    selectNoteTemplate("SLN", "2026-09-14")?.id !== HHS_NOTE_TEMPLATE.id
  );
}

export function fifthBatchNoteNeverAbsorbsSiblings(): boolean {
  return (
    independentLaneStatus(false) === "separate_incomplete" &&
    independentLaneStatus(null) === "unanswered" &&
    independentLaneStatus(true) === "separate_complete"
  );
}

export function fifthBatchOmitsEmploymentAndUsorVendor(): boolean {
  const keys = FIFTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  return (
    !keys.includes("sei_employment_data_upi") &&
    !keys.includes("sjd_employment_data_upi") &&
    !keys.includes("usor_job_development_sjd") &&
    !keys.includes("sei_annual_outcome")
  );
}
