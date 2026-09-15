/**
 * Fourth shared-behavior executable batch: §1.25 periodic progress reports
 * with monthly substitutes (SEI UPI, SJD UPI, CMP/CMS to Support Coordinator).
 *
 * Overlays the Core_Rule_Logic REQ-1.25 fixture onto imported catalog parents
 * so those parents reuse the live company_obligations engine. Child elements
 * stay on the parent. One applicable report per code — never monthly+quarterly
 * on the same code. Do not invent PN1/PN2 or quarterly live keys. Do not copy
 * SLN onto the CMP/CMS monthly clock. CMP/CMS is Support Coordinator, not UPI.
 * Staff never touch UPI. Publication stays off until VERIFIED_PUBLICATIONS
 * is filled deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import {
  evaluateStaffDuty,
  staffReceivesDutyClock,
  type StaffDutyFacts,
} from "./duty-applicability.ts";
import { livePathQuestionByDutyKey } from "./setup-facts.ts";
import { PRODUCT_REMINDER_OFFSETS_DAYS } from "./draft-rules/reminders.ts";
import type { CatalogFact, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import {
  PERIODIC_MONTHLY_CODES,
  REQ_1_25_PERIODIC,
  draftRuleById,
} from "./draft-rules/fixtures.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type { DraftRule, GroupMember } from "./draft-rules/types.ts";

export const FOURTH_EXECUTABLE_BATCH_ID = "periodic_monthly_summaries" as const;

/** Imported catalog parents this batch overlays. */
export const FOURTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.25",
  "REQ-30.3.4",
  "REQ-32.3.2",
  "REQ-33.3.4",
] as const;

/** Core_Rule_Logic fixture id. Service-article parents reuse slices of 1.25. */
export const FOURTH_EXECUTABLE_BATCH_FIXTURE_IDS = ["REQ-1.25"] as const;

export const FOURTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "sei_monthly_summary_upi",
  "cmp_cms_monthly_summaries",
  "sjd_monthly_summary_upi",
] as const;

export type FourthExecutableBatchRuleId = (typeof FOURTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type FourthExecutableBatchLiveKey = (typeof FOURTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type FourthBatchLiveFactKey =
  | "periodic_report_assignment"
  | "sei_monthly_caseload"
  | "cmp_cms_monthly_caseload"
  | "sjd_monthly_caseload";

export type FourthBatchEngineBinding = {
  ruleId: string;
  liveKeys: readonly FourthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "caseload_reeval" | "org_award_reeval";
  evidence: "attestation";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "attestation_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: FourthBatchLiveFactKey;
  destination: "upi" | "support_coordinator" | "by_code";
  sharesLiveKeyWith: readonly string[];
};

function membersById(ids: readonly string[]): GroupMember[] {
  return REQ_1_25_PERIODIC.group.members.filter((member) => ids.includes(member.id));
}

function monthlyMember(
  catalogKey: FourthExecutableBatchLiveKey,
  sourceClauseId: string,
): GroupMember {
  const base = membersById(["monthly-report"])[0];
  if (!base) {
    throw new Error("REQ-1.25 fixture is missing the monthly-report member.");
  }
  return {
    ...base,
    catalogKey,
    sourceClauseId,
    completionRoutes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
    condition: "monthly_summary_codes",
  };
}

/** Imported 30.3(4): SEI monthly summary typed into UPI. Not CMP/CMS. Not SLN. */
export const REQ_30_3_4_SEI_MONTHLY: DraftRule = {
  ...REQ_1_25_PERIODIC,
  id: "REQ-30.3.4",
  title: "SEI monthly summary — UPI entry by the 15th",
  catalogKeys: ["sei_monthly_summary_upi"],
  source: { ...REQ_1_25_PERIODIC.source, clauseIds: ["SOW §30.3(4)", "SOW §1.25"] },
  predicates: [{ kind: "periodic_report", catalogKey: "sei_monthly_summary_upi" }],
  group: {
    logic: "CONDITIONAL",
    parentAssignment: "one",
    conditionNote:
      "Monthly substitute for SEI. Enter (not upload) the summary into UPI by the 15th of the following month. Staff never touch UPI — admin attests after entry. HIVE cannot transmit to UPI. Do not mint a quarterly clock for SEI.",
    members: [monthlyMember("sei_monthly_summary_upi", "SOW §30.3(4)")],
  },
  timing: { kind: "calendar_period", cadence: "monthly" },
  evidence: {
    ...REQ_1_25_PERIODIC.evidence,
    summary:
      "One SEI monthly narrative. Admin attests UPI entry for every active SEI person. In-platform draft is not equivalency for a skipped UPI month. Quarterly is not a substitute.",
    routes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
    defaultHandlingLabel:
      "In-platform draft plus admin UPI attestation is the handling path, not transmission and not a quarterly substitute.",
  },
  completionRoutes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
  tests: REQ_1_25_PERIODIC.tests,
};

/** Imported 32.3(2): CMP/CMS monthly to Support Coordinator. Not UPI. Not SLN. */
export const REQ_32_3_2_CMP_CMS_MONTHLY: DraftRule = {
  ...REQ_1_25_PERIODIC,
  id: "REQ-32.3.2",
  title: "CMP/CMS monthly summaries — submitted to Support Coordinator",
  catalogKeys: ["cmp_cms_monthly_summaries"],
  source: { ...REQ_1_25_PERIODIC.source, clauseIds: ["SOW §32.3(2)", "SOW §1.25"] },
  predicates: [{ kind: "periodic_report", catalogKey: "cmp_cms_monthly_summaries" }],
  group: {
    logic: "CONDITIONAL",
    parentAssignment: "one",
    conditionNote:
      "Monthly substitute for CMP and CMS only. Submit to the Person's Support Coordinator by the 15th of the following month. SLN stays quarterly — do not copy SLN onto this clock. Destination is the Support Coordinator, not UPI. HIVE does not email the SC.",
    members: [monthlyMember("cmp_cms_monthly_summaries", "SOW §32.3(2)")],
  },
  timing: { kind: "calendar_period", cadence: "monthly" },
  evidence: {
    ...REQ_1_25_PERIODIC.evidence,
    summary:
      "One CMP/CMS monthly narrative per code, sent to the Support Coordinator. Not a UPI entry. SLN does not receive this monthly clock. In-platform draft is not equivalency for a skipped send.",
    routes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
    defaultHandlingLabel:
      "In-platform draft plus send-to-SC attestation is the handling path, not email transmission and not a UPI substitute.",
  },
  completionRoutes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
  tests: REQ_1_25_PERIODIC.tests,
};

/** Imported 33.3(4): SJD monthly summary typed into UPI. Not SEI named-course. */
export const REQ_33_3_4_SJD_MONTHLY: DraftRule = {
  ...REQ_1_25_PERIODIC,
  id: "REQ-33.3.4",
  title: "SJD monthly summary — UPI entry by the 15th",
  catalogKeys: ["sjd_monthly_summary_upi"],
  source: { ...REQ_1_25_PERIODIC.source, clauseIds: ["SOW §33.3(4)", "SOW §1.25"] },
  predicates: [{ kind: "periodic_report", catalogKey: "sjd_monthly_summary_upi" }],
  group: {
    logic: "CONDITIONAL",
    parentAssignment: "one",
    conditionNote:
      "Monthly substitute for SJD. Enter (not upload) the summary into UPI by the 15th of the following month. Staff never touch UPI — admin attests after entry. HIVE cannot transmit to UPI. Do not mint a quarterly clock for SJD.",
    members: [monthlyMember("sjd_monthly_summary_upi", "SOW §33.3(4)")],
  },
  timing: { kind: "calendar_period", cadence: "monthly" },
  evidence: {
    ...REQ_1_25_PERIODIC.evidence,
    summary:
      "One SJD monthly narrative. Admin attests UPI entry for every active SJD person. In-platform draft is not equivalency for a skipped UPI month. Quarterly is not a substitute.",
    routes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
    defaultHandlingLabel:
      "In-platform draft plus admin UPI attestation is the handling path, not transmission and not a quarterly substitute.",
  },
  completionRoutes: ["IN_PLATFORM", "EXTERNAL", "SYSTEM"],
  tests: REQ_1_25_PERIODIC.tests,
};

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.25": REQ_1_25_PERIODIC,
  "REQ-30.3.4": REQ_30_3_4_SEI_MONTHLY,
  "REQ-32.3.2": REQ_32_3_2_CMP_CMS_MONTHLY,
  "REQ-33.3.4": REQ_33_3_4_SJD_MONTHLY,
};

export const FOURTH_BATCH_ENGINE_BINDINGS: readonly FourthBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.25",
    liveKeys: ["sei_monthly_summary_upi", "cmp_cms_monthly_summaries", "sjd_monthly_summary_upi"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "attestation",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "attestation_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "periodic_report_assignment",
    destination: "by_code",
    sharesLiveKeyWith: ["REQ-30.3.4", "REQ-32.3.2", "REQ-33.3.4"],
  },
  {
    ruleId: "REQ-30.3.4",
    liveKeys: ["sei_monthly_summary_upi"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "org_award_reeval",
    evidence: "attestation",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "attestation_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sei_monthly_caseload",
    destination: "upi",
    sharesLiveKeyWith: ["REQ-1.25"],
  },
  {
    ruleId: "REQ-32.3.2",
    liveKeys: ["cmp_cms_monthly_summaries"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "org_award_reeval",
    evidence: "attestation",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "attestation_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "cmp_cms_monthly_caseload",
    destination: "support_coordinator",
    sharesLiveKeyWith: ["REQ-1.25"],
  },
  {
    ruleId: "REQ-33.3.4",
    liveKeys: ["sjd_monthly_summary_upi"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "org_award_reeval",
    evidence: "attestation",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "attestation_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sjd_monthly_caseload",
    destination: "upi",
    sharesLiveKeyWith: ["REQ-1.25"],
  },
];

/** Reese E2E: facts → task → evidence → review → renewal. One card per live key. */
export const FOURTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record awarded codes and who received service this month",
    detail:
      "Which codes this contractor is awarded. Which persons received SEI, SJD, CMP, or CMS this month. Empty stays a question. SLN is quarterly — not this monthly cluster.",
  },
  {
    step: "task",
    title: "One parent card per live key on My tasks",
    detail:
      "Company obligations / My tasks open one card per live key. REQ-1.25 shares those cards; it does not mint a fourth. Child file items stay on that parent.",
  },
  {
    step: "evidence",
    title: "Draft in HIVE, attest the outside filing",
    detail:
      "SEI and SJD: write the narrative in HIVE, then admin attests UPI entry. Staff never touch UPI. CMP/CMS: write in HIVE, then attest send to the Support Coordinator. HIVE does not email the SC and does not transmit to UPI.",
  },
  {
    step: "review",
    title: "Admin accepts the attestation",
    detail:
      "Submitted attestations sit in attestation review. Product reminders go to the reviewer, not a second staff nag. Acceptance greens the parent.",
  },
  {
    step: "renewal",
    title: "Re-open on the live following-month due rule",
    detail:
      "Due the 15th of the month following the service month. No invented extra interval. A code never receives both monthly and quarterly.",
  },
] as const;

export function isFourthExecutableBatchRuleId(ruleId: string): boolean {
  return (FOURTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isFourthExecutableBatchLiveKey(key: string): boolean {
  return (FOURTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function fourthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? draftRuleById(ruleId);
}

export function liveFactIdForFourthBatchKey(factKey: FourthBatchLiveFactKey): string {
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<FourthBatchLiveFactKey, string> = {
  periodic_report_assignment:
    "Which persons received a service that requires a monthly or quarterly progress report?",
  sei_monthly_caseload: "Which persons have an active SEI authorization this month?",
  cmp_cms_monthly_caseload: "Which persons have an active CMP or CMS authorization this month?",
  sjd_monthly_caseload: "Which persons have an active SJD authorization this month?",
};

export function fourthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = FOURTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  const fromPath =
    binding.liveKeys.length === 1 ? livePathQuestionByDutyKey(binding.liveKeys[0]) : null;
  return [
    {
      fact_id: liveFactIdForFourthBatchKey(binding.liveFactKey),
      question: fromPath?.question ?? LIVE_FACT_QUESTIONS[binding.liveFactKey],
    },
  ];
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

export function applyFourthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = fourthBatchFixtureFor(rule.id);
  if (!fixture || !isFourthExecutableBatchRuleId(rule.id)) return rule;
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
            fourthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyFourthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyFourthExecutableBatchOverlay(rule));
}

export function fourthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isFourthExecutableBatchRuleId(rule.id))
    .map((rule) => applyFourthExecutableBatchOverlay(rule));
}

export function fourthBatchBindingForRule(ruleId: string): FourthBatchEngineBinding | null {
  return FOURTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function fourthBatchLiveEngineReady(binding: FourthBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of binding.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== "obligation") {
      reasons.push(`${key} is ${entry.disposition}, not an obligation clock.`);
    }
  }
  if (binding.parentAssignment !== "one") {
    reasons.push("Parent assignment must stay one — no per-element staff tasks.");
  }
  if (binding.mintsElementTasks) {
    reasons.push("Child elements must not mint staff tasks.");
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
  const sei = sowCatalogEntryByKey("sei_monthly_summary_upi");
  if (binding.ruleId === "REQ-30.3.4") {
    if (sei?.owner !== "admin") {
      reasons.push("sei_monthly_summary_upi must stay an admin/org reporting clock.");
    }
    if (!sei?.service_codes.includes("SEI") || sei.service_codes.includes("SLN")) {
      reasons.push("sei_monthly_summary_upi must stay SEI-gated and must not include SLN.");
    }
    if (binding.destination !== "upi") {
      reasons.push("REQ-30.3.4 destination is UPI, not Support Coordinator.");
    }
  }
  const cmp = sowCatalogEntryByKey("cmp_cms_monthly_summaries");
  if (binding.ruleId === "REQ-32.3.2") {
    if (!cmp?.service_codes.includes("CMP") || !cmp.service_codes.includes("CMS")) {
      reasons.push("cmp_cms_monthly_summaries must stay CMP/CMS-gated.");
    }
    if (cmp?.service_codes.includes("SLN")) {
      reasons.push("cmp_cms_monthly_summaries must not include SLN — SLN stays quarterly.");
    }
    if (binding.destination !== "support_coordinator") {
      reasons.push("REQ-32.3.2 destination is the Support Coordinator, not UPI.");
    }
  }
  const sjd = sowCatalogEntryByKey("sjd_monthly_summary_upi");
  if (binding.ruleId === "REQ-33.3.4") {
    if (!sjd?.service_codes.includes("SJD")) {
      reasons.push("sjd_monthly_summary_upi must stay SJD-gated.");
    }
    if (binding.destination !== "upi") {
      reasons.push("REQ-33.3.4 destination is UPI, not Support Coordinator.");
    }
  }
  if (binding.ruleId === "REQ-1.25" && binding.liveKeys.length !== 3) {
    reasons.push(
      "REQ-1.25 must bind the three monthly live keys, not invent PN1/PN2 or quarterly keys.",
    );
  }
  return { ready: reasons.length === 0, reasons };
}

export function fourthBatchAssignmentOpensClock(
  liveKey: FourthExecutableBatchLiveKey,
  staff: StaffDutyFacts,
): boolean {
  return staffReceivesDutyClock(evaluateStaffDuty({ dutyKey: liveKey, staff }));
}

export function fourthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function fourthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isFourthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyFourthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isFourthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid);
}

export function fourthBatchOmitsSlnFromMonthly(rule: DraftRule): boolean {
  const cmp = sowCatalogEntryByKey("cmp_cms_monthly_summaries");
  if (cmp?.service_codes.includes("SLN")) return false;
  if (rule.id === "REQ-32.3.2") {
    const note = `${rule.group.conditionNote ?? ""} ${rule.evidence.summary}`;
    if (!/SLN stays quarterly/i.test(note)) return false;
  }
  return !rule.group.members.some((member) => /SLN monthly/i.test(member.label));
}

export function fourthBatchKeepsCmpCmsOffUpi(rule: DraftRule): boolean {
  if (!rule.catalogKeys.includes("cmp_cms_monthly_summaries")) return true;
  const text = `${rule.group.conditionNote ?? ""} ${rule.evidence.summary} ${rule.evidence.defaultHandlingLabel}`;
  if (!/Support Coordinator/i.test(text)) return false;
  if (/attest UPI|typed into UPI|enter.*UPI/i.test(text) && !/not UPI|not a UPI/i.test(text)) {
    return false;
  }
  return /not UPI|not a UPI/i.test(text);
}

export function fourthBatchNeverMintsBothCadencesForOneCode(): boolean {
  const monthly = new Set<string>(PERIODIC_MONTHLY_CODES);
  return (
    monthly.has("SEI") &&
    monthly.has("SJD") &&
    monthly.has("CMP") &&
    monthly.has("CMS") &&
    !monthly.has("SLN") &&
    !monthly.has("HHS")
  );
}
