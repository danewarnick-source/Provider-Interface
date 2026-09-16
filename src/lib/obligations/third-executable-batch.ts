/**
 * Third shared-behavior executable batch: USOR vendor cohort + SJD clocks
 * (ACRE 60-day with supervision pending, Customized Employment if Discovery).
 *
 * Overlays Core_Rule_Logic fixtures onto imported catalog parents so those
 * parents reuse the live company_obligations engine. Child elements stay on
 * the parent. REQ-33.5.b-c is one fixture covering two imported parents
 * (REQ-33.5.b + REQ-33.5.c). Do not copy SEI 30.6(c) named-course
 * alternatives onto SJD. USOR email spelling and the SJB typo stay
 * Release_Gaps on the fixtures — overlay does not invent a fix, and does
 * not copy those gaps onto the imported parent (canPublish stays structural).
 * Publication stays off until VERIFIED_PUBLICATIONS is filled deliberately.
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
  REQ_30_6_A_USOR,
  REQ_33_5_SJD,
  USOR_PROOF_DESTINATION_AS_PUBLISHED,
  draftRuleById,
} from "./draft-rules/fixtures.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type { DraftRule, GroupMember } from "./draft-rules/types.ts";

export const THIRD_EXECUTABLE_BATCH_ID = "usor_sjd_clocks" as const;

/** Imported catalog parents this batch overlays. */
export const THIRD_EXECUTABLE_BATCH_RULE_IDS = ["REQ-30.6.a", "REQ-33.5.b", "REQ-33.5.c"] as const;

/** Core_Rule_Logic fixture ids (33.5.b-c covers both imported SJD parents). */
export const THIRD_EXECUTABLE_BATCH_FIXTURE_IDS = ["REQ-30.6.a", "REQ-33.5.b-c"] as const;

export const THIRD_EXECUTABLE_BATCH_LIVE_KEYS = [
  "usor_job_coaching_sei",
  "acre_sjd",
  "customized_employment_usu",
] as const;

export type ThirdExecutableBatchRuleId = (typeof THIRD_EXECUTABLE_BATCH_RULE_IDS)[number];
export type ThirdExecutableBatchLiveKey = (typeof THIRD_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type ThirdBatchLiveFactKey = "sei_award_date" | "sjd_assignment" | "sjd_discovery";

export type ThirdBatchEngineBinding = {
  ruleId: string;
  liveKeys: readonly ThirdExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "org_award_reeval" | "hire_and_assignment_reeval" | "caseload_reeval";
  evidence: "upload_cert";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review" | "cert_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: ThirdBatchLiveFactKey;
  sharesLiveKeyWith: readonly string[];
};

function membersById(ids: readonly string[]): GroupMember[] {
  return REQ_33_5_SJD.group.members.filter((member) => ids.includes(member.id));
}

/** Imported 33.5(b): ACRE hire+60 and supervision pending. CE stays on 33.5(c). */
export const REQ_33_5_B_ACRE: DraftRule = {
  ...REQ_33_5_SJD,
  id: "REQ-33.5.b",
  title: "SJD ACRE (60-day, supervised pending)",
  catalogKeys: ["acre_sjd"],
  source: { ...REQ_33_5_SJD.source, clauseIds: ["SOW §33.5(b)"] },
  predicates: [{ kind: "sjd_assignment", catalogKey: "acre_sjd" }],
  group: {
    logic: "ALL",
    parentAssignment: "one",
    conditionNote:
      "SJD ACRE within 60 days of hire with qualified supervision while pending. Do not copy SEI 30.6(c) alternatives (USU Workplace Supports / Effective Job Coach) onto SJD.",
    members: membersById(["sjd-acre", "sjd-supervision-pending"]),
  },
  timing: { kind: "hire_plus_days", days: 60 },
  evidence: {
    ...REQ_33_5_SJD.evidence,
    summary:
      "ACRE for SJD new-hires within 60 days; qualified supervision required while ACRE is pending. SEI named-course alternatives are not SJD routes.",
    routes: ["UPLOAD", "EXTERNAL", "SYSTEM"],
  },
  completionRoutes: ["UPLOAD", "EXTERNAL", "SYSTEM"],
  tests: REQ_33_5_SJD.tests,
};

/** Imported 33.5(c): Customized Employment only if Discovery. */
export const REQ_33_5_C_DISCOVERY: DraftRule = {
  ...REQ_33_5_SJD,
  id: "REQ-33.5.c",
  title: "SJD Customized Employment if Discovery",
  catalogKeys: ["customized_employment_usu"],
  source: { ...REQ_33_5_SJD.source, clauseIds: ["SOW §33.5(c)"] },
  predicates: [{ kind: "sjd_assignment", catalogKey: "acre_sjd" }],
  group: {
    logic: "ALL",
    parentAssignment: "one",
    conditionNote:
      "Customized Employment only if the staff performs Discovery. Do not copy SEI 30.6(c) alternatives onto SJD.",
    members: membersById(["sjd-customized-employment"]),
  },
  timing: {
    kind: "none",
    reason: "Required when the SJD staff performs Discovery. No invented hire+60 on this child.",
  },
  evidence: {
    ...REQ_33_5_SJD.evidence,
    summary:
      "USU Customized Employment (or another accredited Customized Employment program) when the staff performs Discovery. SEI named-course alternatives are not SJD routes.",
    routes: ["UPLOAD", "EXTERNAL"],
  },
  completionRoutes: ["UPLOAD", "EXTERNAL"],
  tests: REQ_33_5_SJD.tests,
};

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-30.6.a": REQ_30_6_A_USOR,
  "REQ-33.5.b": REQ_33_5_B_ACRE,
  "REQ-33.5.c": REQ_33_5_C_DISCOVERY,
  "REQ-33.5.b-c": REQ_33_5_SJD,
};

export const THIRD_BATCH_ENGINE_BINDINGS: readonly ThirdBatchEngineBinding[] = [
  {
    ruleId: "REQ-30.6.a",
    liveKeys: ["usor_job_coaching_sei"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "org_award_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sei_award_date",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-33.5.b",
    liveKeys: ["acre_sjd"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "hire_and_assignment_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "cert_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sjd_assignment",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-33.5.c",
    liveKeys: ["customized_employment_usu"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "cert_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sjd_discovery",
    sharesLiveKeyWith: [],
  },
];

/** Reese E2E: facts → task → evidence → review → renewal. One card per live key. */
export const THIRD_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record award and assignment facts",
    detail:
      "SEI award date (USOR cohort). Which staff are assigned SJD. Which SJD staff perform Discovery. Empty stays a question.",
  },
  {
    step: "task",
    title: "One parent card on My tasks",
    detail:
      "Company obligations / My tasks open one card per live key. USOR vendor proof is the org SEI card. SJD ACRE and Customized Employment stay on their parents. Child file items stay on that parent.",
  },
  {
    step: "evidence",
    title: "Upload on the parent",
    detail:
      "USOR: official approved-vendor proof (destination stays the published spelling; PI stores the upload and does not send the email). SJD ACRE: official certificate plus qualified supervision while pending. Customized Employment: official program only if Discovery. No SEI named-course substitute.",
  },
  {
    step: "review",
    title: "Admin accepts on the file",
    detail:
      "Submitted uploads sit in cert/upload review. Product reminders go to the reviewer, not a second staff nag. Acceptance greens the parent.",
  },
  {
    step: "renewal",
    title: "Re-verify on the live due rule",
    detail:
      "USOR existing-provider cohort is 2027-01-31; later SEI awards are award+6 months. Unknown award date is missing-information. SJD ACRE is hire+60. Customized Employment has no invented annual-from-completion.",
  },
] as const;

export function isThirdExecutableBatchRuleId(ruleId: string): boolean {
  return (THIRD_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isThirdExecutableBatchLiveKey(key: string): boolean {
  return (THIRD_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function thirdBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? draftRuleById(ruleId);
}

export function liveFactIdForThirdBatchKey(factKey: ThirdBatchLiveFactKey): string {
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<ThirdBatchLiveFactKey, string> = {
  sei_award_date: "When was this contractor awarded SEI?",
  sjd_assignment: "Which staff are assigned to an SJD authorization?",
  sjd_discovery: "Which SJD staff perform Discovery?",
};

export function thirdBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = THIRD_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  const fromPath = binding.liveKeys
    .map((key) => livePathQuestionByDutyKey(key))
    .find((question) => question != null);
  const facts: CatalogFact[] = [
    {
      fact_id: liveFactIdForThirdBatchKey(binding.liveFactKey),
      question: fromPath?.question ?? LIVE_FACT_QUESTIONS[binding.liveFactKey],
    },
  ];
  if (binding.ruleId === "REQ-33.5.c") {
    facts.unshift({
      fact_id: liveFactIdForThirdBatchKey("sjd_assignment"),
      question: LIVE_FACT_QUESTIONS.sjd_assignment,
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

export function applyThirdExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = thirdBatchFixtureFor(rule.id);
  if (!fixture || !isThirdExecutableBatchRuleId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, thirdBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applyThirdExecutableBatchOverlayAll<T extends DraftRule>(rules: readonly T[]): T[] {
  return rules.map((rule) => applyThirdExecutableBatchOverlay(rule));
}

export function thirdExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isThirdExecutableBatchRuleId(rule.id))
    .map((rule) => applyThirdExecutableBatchOverlay(rule));
}

export function thirdBatchBindingForRule(ruleId: string): ThirdBatchEngineBinding | null {
  return THIRD_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function thirdBatchLiveEngineReady(binding: ThirdBatchEngineBinding): {
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
    reasons.push("This batch does not invent an in-PI course.");
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
  const usor = sowCatalogEntryByKey("usor_job_coaching_sei");
  if (binding.ruleId === "REQ-30.6.a") {
    if (usor?.owner !== "admin") {
      reasons.push("usor_job_coaching_sei must stay an admin/org qualification.");
    }
    if (!usor?.service_codes.includes("SEI")) {
      reasons.push("usor_job_coaching_sei must stay SEI-gated.");
    }
    if (!binding.liveKeys.includes("usor_job_coaching_sei")) {
      reasons.push("REQ-30.6.a must bind usor_job_coaching_sei, not the SJD vendor key.");
    }
  }
  const acre = sowCatalogEntryByKey("acre_sjd");
  if (binding.ruleId === "REQ-33.5.b" && !acre?.service_codes.includes("SJD")) {
    reasons.push("acre_sjd must stay SJD-gated.");
  }
  const ce = sowCatalogEntryByKey("customized_employment_usu");
  if (binding.ruleId === "REQ-33.5.c" && !ce?.service_codes.includes("SJD")) {
    reasons.push("customized_employment_usu must stay SJD-gated.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function thirdBatchAssignmentOpensClock(
  liveKey: ThirdExecutableBatchLiveKey,
  staff: StaffDutyFacts,
): boolean {
  return staffReceivesDutyClock(evaluateStaffDuty({ dutyKey: liveKey, staff }));
}

export function thirdBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function thirdBatchParentIsWired(rule: DraftRule): boolean {
  if (!isThirdExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyThirdExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isThirdExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid);
}

export function thirdBatchKeepsPublishedUsorSpelling(): boolean {
  return (
    USOR_PROOF_DESTINATION_AS_PUBLISHED === "osrprovider@utah.gov" &&
    REQ_30_6_A_USOR.releaseGaps.some((gap) => gap.includes(USOR_PROOF_DESTINATION_AS_PUBLISHED)) &&
    REQ_30_6_A_USOR.evidence.summary.includes(USOR_PROOF_DESTINATION_AS_PUBLISHED)
  );
}

export function thirdBatchKeepsSjbTypoAsReleaseGap(): boolean {
  return REQ_33_5_SJD.releaseGaps.some((gap) => /SJB/.test(gap));
}

export function thirdBatchOmitsSeiNamedCourseAlternatives(rule: DraftRule): boolean {
  const labels = rule.group.members.map((member) => member.label).join(" ");
  return !/workplace supports|effective job coach/i.test(labels);
}
