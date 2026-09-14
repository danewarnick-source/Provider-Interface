/**
 * Sixth shared-behavior executable batch: PBA / personal-funds financial
 * reviews (§1.28(5) + §15.3(7)).
 *
 * Overlays the Core_Rule_Logic REQ-15.3 fixture onto two imported catalog
 * parents so those parents reuse the live pba_financial_review engine.
 * Child elements stay on the parent. The three reviews stay distinct —
 * reviewers must differ; a generic attestation never absorbs the set.
 * Monthly and quarterly calendars stay separate. Do not invent a sample
 * percentage, a 30-day Support-Coordinator send clock (REQ-15.3.8), PN1/PN2,
 * quarterly live keys, employment-data, annual-outcome, or SJD USOR vendor.
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
import {
  evaluatePbaReviews,
  reviewsAreScheduleSeparated,
  type SyntheticPbaReview,
} from "./draft-rules/pba-reviews.ts";
import type { CatalogFact, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import { REQ_ART15_PBA, draftRuleById } from "./draft-rules/fixtures.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type { DraftPredicate, DraftRule, GroupMember } from "./draft-rules/types.ts";

export const SIXTH_EXECUTABLE_BATCH_ID = "pba_financial_reviews" as const;

/** Imported catalog parents this batch overlays. */
export const SIXTH_EXECUTABLE_BATCH_RULE_IDS = ["REQ-1.28.5", "REQ-15.3.7"] as const;

/** Core_Rule_Logic fixture id. Imported parents reuse slices of 15.3. */
export const SIXTH_EXECUTABLE_BATCH_FIXTURE_IDS = ["REQ-15.3"] as const;

export const SIXTH_EXECUTABLE_BATCH_COMPANION_RULE_IDS = ["REQ-15.3"] as const;

export const SIXTH_EXECUTABLE_BATCH_LIVE_KEYS = ["pba_financial_review"] as const;

export type SixthExecutableBatchRuleId = (typeof SIXTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type SixthExecutableBatchLiveKey = (typeof SIXTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type SixthBatchLiveFactKey = "personal_funds_assistance" | "pba_caseload";

export type SixthBatchEngineBinding = {
  ruleId: string;
  liveKeys: readonly SixthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "caseload_reeval";
  evidence: "in_platform_review";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: SixthBatchLiveFactKey;
  reviewMembers: readonly string[];
  sharesLiveKeyWith: readonly string[];
};

const PBA_PRED: DraftPredicate = {
  kind: "pba_assignment",
  catalogKey: "pba_financial_review",
};

function membersById(ids: readonly string[]): GroupMember[] {
  return REQ_ART15_PBA.group.members.filter((member) => ids.includes(member.id));
}

/** Imported 1.28(5): monthly review with the Person. Not admin. Not quarterly. */
export const REQ_1_28_5_PERSON_REVIEW: DraftRule = {
  ...REQ_ART15_PBA,
  id: "REQ-1.28.5",
  title: "Monthly financial-record review with the Person",
  catalogKeys: ["pba_financial_review"],
  source: { ...REQ_ART15_PBA.source, clauseIds: ["SOW §1.28(5)", "SOW §15.3"] },
  predicates: [PBA_PRED],
  group: {
    logic: "ALL",
    parentAssignment: "one",
    conditionNote:
      "Monthly review with the Person when the contractor assists with personal funds or holds a PBA assignment. Empty stays a question. Completing this review does not satisfy the administrator review or the quarterly third-person sample.",
    members: membersById(["monthly-person-review"]),
  },
  timing: { kind: "calendar_period", cadence: "monthly" },
  evidence: {
    ...REQ_ART15_PBA.evidence,
    summary:
      "Accepted monthly review with the Person, with linked itemized statements, bank statements, or distribution receipts. A generic attestation does not satisfy the administrator or quarterly reviews.",
    defaultHandlingLabel:
      "The Person-review record is the handling path, not equivalency for the other two PBA reviews.",
  },
  completionRoutes: ["IN_PLATFORM", "UPLOAD"],
  tests: REQ_ART15_PBA.tests,
};

/** Imported 15.3(7): monthly administrator review + quarterly third-person sample. */
export const REQ_15_3_7_ADMIN_AND_SAMPLE: DraftRule = {
  ...REQ_ART15_PBA,
  id: "REQ-15.3.7",
  title: "PBA administrator review and quarterly third-person sample",
  catalogKeys: ["pba_financial_review"],
  source: { ...REQ_ART15_PBA.source, clauseIds: ["SOW §15.3(7)", "SOW §1.28"] },
  predicates: [PBA_PRED],
  group: {
    logic: "ALL",
    parentAssignment: "one",
    conditionNote:
      "Monthly review by administrative staff not authorized to spend, plus a quarterly third-person sample. Reviewers must differ. Do not invent a sample percentage. Completing these reviews does not satisfy the monthly review with the Person. Do not mint REQ-15.3.8's 30-day Support Coordinator send as this clock.",
    members: membersById(["monthly-administrator-review", "quarterly-third-person-sample"]),
  },
  timing: {
    kind: "none",
    reason:
      "Two source calendars only: monthly administrator and quarterly third-person sample. Do not invent a sample percentage or a 30-day extra interval.",
  },
  evidence: {
    ...REQ_ART15_PBA.evidence,
    summary:
      "Distinct accepted administrator and third-person reviews with linked itemized evidence. Reviewers must differ. A generic attestation is not equivalency. Monthly period keys do not satisfy the quarterly sample.",
    defaultHandlingLabel:
      "Linked itemized evidence plus the matching reviewer is the handling path, not a shared attestation and not a Support Coordinator send clock.",
  },
  completionRoutes: ["IN_PLATFORM", "UPLOAD"],
  tests: REQ_ART15_PBA.tests,
};

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-15.3": REQ_ART15_PBA,
  "REQ-1.28.5": REQ_1_28_5_PERSON_REVIEW,
  "REQ-15.3.7": REQ_15_3_7_ADMIN_AND_SAMPLE,
};

export const SIXTH_BATCH_ENGINE_BINDINGS: readonly SixthBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.28.5",
    liveKeys: ["pba_financial_review"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_review",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "personal_funds_assistance",
    reviewMembers: ["monthly-person-review"],
    sharesLiveKeyWith: ["REQ-15.3.7", "REQ-15.3"],
  },
  {
    ruleId: "REQ-15.3.7",
    liveKeys: ["pba_financial_review"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_review",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "pba_caseload",
    reviewMembers: ["monthly-administrator-review", "quarterly-third-person-sample"],
    sharesLiveKeyWith: ["REQ-1.28.5", "REQ-15.3"],
  },
  {
    ruleId: "REQ-15.3",
    liveKeys: ["pba_financial_review"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_review",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "pba_caseload",
    reviewMembers: [
      "monthly-person-review",
      "monthly-administrator-review",
      "quarterly-third-person-sample",
    ],
    sharesLiveKeyWith: ["REQ-1.28.5", "REQ-15.3.7"],
  },
];

/** Reese E2E: facts → one shared card → distinct reviews → review → calendars. */
export const SIXTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record PBA assignment and who is assisted with personal funds",
    detail:
      "Which persons have a PBA assignment. Which persons this contractor assists with personal funds. Empty stays a question. Do not invent PBA as a hire-clock awarded-code chip.",
  },
  {
    step: "task",
    title: "One parent card on the live PBA financial-review key",
    detail:
      "REQ-1.28.5 and REQ-15.3.7 share pba_financial_review. They do not mint a second card. Child file items stay on that parent.",
  },
  {
    step: "evidence",
    title: "Complete each review with its own reviewer and itemized evidence",
    detail:
      "Monthly with the Person, monthly administrator, and quarterly third-person sample. Reviewers must differ. Link itemized statements, bank statements, or distribution receipts. A generic attestation does not satisfy the set.",
  },
  {
    step: "review",
    title: "Supervisor samples the review record",
    detail:
      "Record review sits on the live PBA financial-review card. Product reminders go to the reviewer. This screen does not invent a 30-day Support Coordinator send.",
  },
  {
    step: "renewal",
    title: "Re-open on the source calendars only",
    detail:
      "Monthly person and administrator reviews use the monthly period. The third-person sample uses the quarterly period. Do not invent a sample percentage or extra interval.",
  },
] as const;

export function isSixthExecutableBatchRuleId(ruleId: string): boolean {
  return (SIXTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isSixthExecutableBatchFixtureId(ruleId: string): boolean {
  return (
    (SIXTH_EXECUTABLE_BATCH_FIXTURE_IDS as readonly string[]).includes(ruleId) ||
    isSixthExecutableBatchRuleId(ruleId)
  );
}

export function isSixthExecutableBatchLiveKey(key: string): boolean {
  return (SIXTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function sixthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? draftRuleById(ruleId);
}

export function liveFactIdForSixthBatchKey(factKey: SixthBatchLiveFactKey): string {
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<SixthBatchLiveFactKey, string> = {
  personal_funds_assistance: "Which persons does this contractor assist with personal funds?",
  pba_caseload: "Which persons have a PBA assignment?",
};

export function sixthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = SIXTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  const fromPath =
    binding.liveKeys.length === 1 ? livePathQuestionByDutyKey(binding.liveKeys[0]) : null;
  return [
    {
      fact_id: liveFactIdForSixthBatchKey(binding.liveFactKey),
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

export function applySixthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = sixthBatchFixtureFor(rule.id);
  if (!fixture || !isSixthExecutableBatchFixtureId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, sixthBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applySixthExecutableBatchOverlayAll<T extends DraftRule>(rules: readonly T[]): T[] {
  return rules.map((rule) => applySixthExecutableBatchOverlay(rule));
}

export function sixthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isSixthExecutableBatchRuleId(rule.id))
    .map((rule) => applySixthExecutableBatchOverlay(rule));
}

export function sixthBatchBindingForRule(ruleId: string): SixthBatchEngineBinding | null {
  return SIXTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function sixthBatchLiveEngineReady(binding: SixthBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of binding.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== "by_design") {
      reasons.push(`${key} is ${entry.disposition}, not a by_design PBA review path.`);
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
  const pba = sowCatalogEntryByKey("pba_financial_review");
  if (!pba?.service_codes.includes("PBA")) {
    reasons.push("pba_financial_review must stay PBA-gated.");
  }
  if (pba?.fulfillment !== "hybrid") {
    reasons.push("pba_financial_review must stay the hybrid live-record path.");
  }
  const fixture = sixthBatchFixtureFor(binding.ruleId);
  const memberIds = fixture?.group.members.map((member) => member.id) ?? [];
  if (binding.reviewMembers.some((id) => !memberIds.includes(id))) {
    reasons.push(`${binding.ruleId} is missing a required review member.`);
  }
  if (binding.ruleId === "REQ-1.28.5") {
    if (memberIds.includes("monthly-administrator-review")) {
      reasons.push("REQ-1.28.5 must not absorb the administrator review.");
    }
    if (memberIds.includes("quarterly-third-person-sample")) {
      reasons.push("REQ-1.28.5 must not absorb the quarterly third-person sample.");
    }
  }
  if (binding.ruleId === "REQ-15.3.7") {
    if (memberIds.includes("monthly-person-review")) {
      reasons.push("REQ-15.3.7 must not absorb the monthly review with the Person.");
    }
    const text = `${fixture?.group.conditionNote ?? ""} ${fixture?.evidence.summary ?? ""} ${fixture?.timing.kind === "none" ? fixture.timing.reason : ""}`;
    if (/10\s*%/.test(text)) {
      reasons.push("Do not invent a 10% sample percentage on REQ-15.3.7.");
    }
    if (
      /30 calendar days|30-day/i.test(text) &&
      !/do not mint REQ-15\.3\.8|do not invent/i.test(text)
    ) {
      reasons.push("REQ-15.3.7 must not invent the 30-day Support Coordinator send clock.");
    }
  }
  return { ready: reasons.length === 0, reasons };
}

export function sixthBatchAssignmentOpensClock(
  liveKey: SixthExecutableBatchLiveKey,
  staff: StaffDutyFacts,
): boolean {
  return staffReceivesDutyClock(evaluateStaffDuty({ dutyKey: liveKey, staff }));
}

export function sixthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function sixthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isSixthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applySixthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isSixthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function sixthBatchKeepsReviewsIndependent(rule: DraftRule): boolean {
  const text = `${rule.group.conditionNote ?? ""} ${rule.evidence.summary} ${rule.evidence.defaultHandlingLabel}`;
  if (rule.id === "REQ-1.28.5") {
    return /does not satisfy the administrator|does not satisfy the quarterly/i.test(text);
  }
  if (rule.id === "REQ-15.3.7") {
    return (
      /does not satisfy the monthly review with the Person/i.test(text) &&
      /reviewers must differ/i.test(text) &&
      /do not invent a sample percentage/i.test(text)
    );
  }
  if (rule.id === "REQ-15.3") {
    return /reviewers must differ/i.test(text) && /generic attestation/i.test(text);
  }
  return true;
}

export function sixthBatchReviewsStayDistinct(
  asOf = new Date("2026-09-14T12:00:00.000Z"),
): boolean {
  const generic: SyntheticPbaReview = {
    reviewId: "att-1",
    organizationId: "org-1",
    clientId: "c1",
    accountId: "acct-1",
    accountOwnerId: "owner-1",
    reviewKind: "monthly_person",
    periodKey: "2026-09",
    reviewerId: "same-reviewer",
    reviewerRole: "person",
    linkedEvidence: [],
    genericAttestation: true,
    attestationId: "one-attestation",
    lifecycle: "submitted",
  };
  const collision: SyntheticPbaReview[] = [
    generic,
    {
      ...generic,
      reviewId: "att-2",
      reviewKind: "monthly_administrator",
      reviewerRole: "administrator",
    },
    {
      ...generic,
      reviewId: "att-3",
      reviewKind: "quarterly_third_person",
      periodKey: "2026-Q3",
      reviewerRole: "third_person",
    },
  ];
  const result = evaluatePbaReviews({
    organizationId: "org-1",
    reviews: collision,
    asOf,
  });
  const account = result[0];
  if (!account || account.allComplete) return false;
  if (!account.reviews.every((row) => row.complete === false)) return false;
  return reviewsAreScheduleSeparated({ cadence: "monthly" }, { cadence: "quarterly" }, asOf);
}

export function sixthBatchOmitsEmploymentAnnualUsorAndArt2(): boolean {
  const keys = SIXTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = SIXTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    !keys.includes("sei_employment_data_upi") &&
    !keys.includes("sjd_employment_data_upi") &&
    !keys.includes("usor_job_development_sjd") &&
    !keys.includes("sei_annual_outcome") &&
    !keys.includes("dsi_annual_outcome") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("billing_service_match") &&
    !rules.includes("REQ-33.5.a") &&
    !rules.includes("REQ-30.3.5") &&
    !rules.includes("REQ-33.3.7") &&
    !rules.includes("REQ-30.7") &&
    !rules.includes("REQ-15.3.8") &&
    !rules.includes("REQ-ART2")
  );
}
