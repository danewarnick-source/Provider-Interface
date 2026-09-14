/**
 * Second shared-behavior executable batch: assignment-gated service-duty
 * clocks (transport, ACRE SEI/SED, caregiver compensation, SEI benefits).
 *
 * Overlays Core_Rule_Logic fixtures onto imported catalog parents so those
 * parents reuse the live company_obligations engine. Child elements stay on
 * the parent. REQ-30.6.b and REQ-30.6.c share `acre_sei` — one My tasks card.
 * Publication stays off until VERIFIED_PUBLICATIONS is filled deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import {
  TRANSPORT_DUTY_KEYS,
  evaluateStaffDuty,
  staffReceivesDutyClock,
  type StaffDutyFacts,
} from "./duty-applicability.ts";
import { livePathQuestionByDutyKey } from "./setup-facts.ts";
import { PRODUCT_REMINDER_OFFSETS_DAYS } from "./draft-rules/reminders.ts";
import { WORKBOOK_SOURCE_INDEX, linkWorkbookSource } from "./draft-rules/source.ts";
import type { CatalogFact, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import {
  REQ_30_5_SEI_BENEFITS,
  REQ_32_5_CAREGIVER,
  REQ_SEI_30_6_B,
  REQ_SEI_30_6_C,
  draftRuleById,
} from "./draft-rules/fixtures.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type {
  CompletionRoute,
  DraftPredicate,
  DraftRule,
  DraftRuleTest,
  EvidenceAcceptance,
} from "./draft-rules/types.ts";

export const SECOND_EXECUTABLE_BATCH_ID = "service_assignment_clocks" as const;

export const SECOND_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.30",
  "REQ-28.4",
  "REQ-30.5",
  "REQ-30.6.b",
  "REQ-30.6.c",
  "REQ-32.5",
] as const;

export const SECOND_EXECUTABLE_BATCH_LIVE_KEYS = [
  "driving_record_transport",
  "acre_sed",
  "sei_ssi_benefits",
  "acre_sei",
  "cmp_cms_caregiver_comp",
] as const;

export type SecondExecutableBatchRuleId = (typeof SECOND_EXECUTABLE_BATCH_RULE_IDS)[number];
export type SecondExecutableBatchLiveKey = (typeof SECOND_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type SecondBatchLiveFactKey =
  | "transport_assignment"
  | "sei_assignment"
  | "sed_assignment"
  | "cmp_cms_assignment"
  | "designated_benefits_staff";

export type SecondBatchEngineBinding = {
  ruleId: string;
  liveKeys: readonly SecondExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "caseload_reeval";
  evidence: "upload_cert" | "upload_hours" | "external_course" | "attestation";
  trainingTitle: null;
  formTitle: string | null;
  reminders: "product_default";
  adminReview: "cert_review" | "upload_review" | "attestation_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: SecondBatchLiveFactKey;
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV: EvidenceAcceptance["automaticEquivalency"] = false;

function tests(prefix: string, rows: Array<[DraftRuleTest["kind"], string]>): DraftRuleTest[] {
  return rows.map(([kind, assert], i) => ({
    id: `${prefix}-t${i + 1}`,
    kind,
    assert,
  }));
}

function evidence(
  summary: string,
  routes: CompletionRoute[],
  defaultHandlingLabel: string,
): EvidenceAcceptance {
  return {
    summary,
    routes,
    defaultHandlingLabel,
    automaticEquivalency: NO_EQUIV,
  };
}

function draftBase(
  partial: Omit<
    DraftRule,
    | "lifecycle"
    | "publication"
    | "approval"
    | "sourceIndex"
    | "unresolvedAlternatives"
    | "unresolvedRenewals"
    | "releaseGaps"
    | "publicationGap"
  > & {
    unresolvedAlternatives?: string[];
    unresolvedRenewals?: string[];
    releaseGaps?: string[];
    publicationGap?: string | null;
  },
): DraftRule {
  return {
    ...partial,
    lifecycle: "draft",
    publication: "not_published",
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    approval: null,
    unresolvedAlternatives: partial.unresolvedAlternatives ?? [],
    unresolvedRenewals: partial.unresolvedRenewals ?? [],
    releaseGaps: partial.releaseGaps ?? [],
    publicationGap: partial.publicationGap ?? null,
  };
}

const TRANSPORT_PRED: DraftPredicate = {
  kind: "transport_assignment",
  catalogKey: "driving_record_transport",
};

/** Live pack already cites §1.30 — driving record, license, insurance. */
export const REQ_1_30_DRIVING: DraftRule = draftBase({
  id: "REQ-1.30",
  version: 1,
  title: "Driving record — transporting staff, one parent file",
  catalogKeys: ["driving_record_transport"],
  source: linkWorkbookSource(["SOW §1.30"]),
  predicates: [TRANSPORT_PRED],
  group: {
    logic: "ALL",
    parentAssignment: "one",
    conditionNote:
      "Staff who transport persons. Driving record, license, and auto insurance stay on one parent file.",
    members: [
      {
        id: "driving-record",
        label: "Current driving record",
        sourceClauseId: "SOW §1.30",
        catalogKey: "driving_record_transport",
        completionRoutes: ["UPLOAD"],
        evidenceMatch: { scope: "driving_record" },
      },
      {
        id: "license",
        label: "Valid driver license",
        sourceClauseId: "SOW §1.30",
        catalogKey: "driving_record_transport",
        completionRoutes: ["UPLOAD"],
        evidenceMatch: { scope: "driver_license" },
      },
      {
        id: "auto-insurance",
        label: "Current auto insurance",
        sourceClauseId: "SOW §1.30",
        catalogKey: "driving_record_transport",
        completionRoutes: ["UPLOAD"],
        evidenceMatch: { scope: "auto_insurance" },
      },
    ],
  },
  timing: { kind: "employment_year", startYear: 1 },
  evidence: evidence(
    "Current driving record, valid license, and current auto insurance on the staff file. Unknown transporter status is missing-information.",
    ["UPLOAD"],
    "Upload of the three file items is the handling path, not automatic equivalency for a non-driver.",
  ),
  completionRoutes: ["UPLOAD"],
  tests: tests("REQ-1.30", [
    [
      "positive",
      "Staff known to transport persons who keep driving record, license, and insurance on file satisfy the parent.",
    ],
    ["negative", "Staff known not to transport persons do not receive the driving-record clock."],
    [
      "boundary",
      "Unknown transporter assignment is missing-information, never silent N/A. Child file items stay on the parent.",
    ],
  ]),
});

const SED_PRED: DraftPredicate = {
  kind: "sed_assignment",
  catalogKey: "acre_sed",
};

/** Live pack already cites §28.4 — ACRE before delivering SED. */
export const REQ_28_4_ACRE_SED: DraftRule = draftBase({
  id: "REQ-28.4",
  version: 1,
  title: "ACRE certification — SED assignment, one parent upload",
  catalogKeys: ["acre_sed"],
  source: linkWorkbookSource(["SOW §28.4"]),
  predicates: [SED_PRED],
  group: {
    logic: "ALL",
    parentAssignment: "one",
    conditionNote: "Required before staff delivers SED. One parent ACRE upload.",
    members: [
      {
        id: "acre-sed-cert",
        label: "ACRE certificate for SED",
        sourceClauseId: "SOW §28.4",
        catalogKey: "acre_sed",
        completionRoutes: ["UPLOAD", "EXTERNAL"],
        requiresOfficialProgram: true,
      },
    ],
  },
  timing: {
    kind: "none",
    reason: "Required before providing SED. No invented annual ACRE interval.",
  },
  evidence: evidence(
    "Official ACRE certificate uploaded on the staff file before SED service. A generic quiz is not a substitute.",
    ["UPLOAD", "EXTERNAL"],
    "Upload of the official ACRE certificate is the handling path, not equivalency for a generic quiz.",
  ),
  completionRoutes: ["UPLOAD", "EXTERNAL"],
  tests: tests("REQ-28.4", [
    [
      "positive",
      "Staff assigned SED who have an official ACRE certificate on file satisfy the parent.",
    ],
    ["negative", "Staff with no SED assignment do not receive the ACRE-SED clock."],
    ["boundary", "Unknown SED assignment is missing-information. No invented renewal interval."],
  ]),
});

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.30": REQ_1_30_DRIVING,
  "REQ-28.4": REQ_28_4_ACRE_SED,
  "REQ-30.5": REQ_30_5_SEI_BENEFITS,
  "REQ-30.6.b": REQ_SEI_30_6_B,
  "REQ-30.6.c": REQ_SEI_30_6_C,
  "REQ-32.5": REQ_32_5_CAREGIVER,
};

export const SECOND_BATCH_ENGINE_BINDINGS: readonly SecondBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.30",
    liveKeys: ["driving_record_transport"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "transport_assignment",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-28.4",
    liveKeys: ["acre_sed"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "cert_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sed_assignment",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-30.5",
    liveKeys: ["sei_ssi_benefits"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "attestation",
    trainingTitle: null,
    formTitle: "SEI — SSI/Benefits Knowledge Attestation",
    reminders: "product_default",
    adminReview: "attestation_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "designated_benefits_staff",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-30.6.b",
    liveKeys: ["acre_sei"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "cert_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sei_assignment",
    sharesLiveKeyWith: ["REQ-30.6.c"],
  },
  {
    ruleId: "REQ-30.6.c",
    liveKeys: ["acre_sei"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "cert_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "sei_assignment",
    sharesLiveKeyWith: ["REQ-30.6.b"],
  },
  {
    ruleId: "REQ-32.5",
    liveKeys: ["cmp_cms_caregiver_comp"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "external_course",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "cmp_cms_assignment",
    sharesLiveKeyWith: [],
  },
];

/** Reese E2E: facts → task → evidence → review → renewal. One card per live key. */
export const SECOND_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record assignment facts",
    detail:
      "On the person/staff assignment (not a SOW yes/no): who transports persons; who is assigned SEI, SED, CMP, or CMS; who is the designated SSI/benefits person. Empty stays a question.",
  },
  {
    step: "task",
    title: "One parent card on My tasks",
    detail:
      "Company obligations / My tasks open one card per live key. REQ-30.6.b and REQ-30.6.c share ACRE Training Certification — SEI. Child file items stay on that parent.",
  },
  {
    step: "evidence",
    title: "Upload or attest on the parent",
    detail:
      "Driving: record + license + insurance. ACRE SEI/SED: official certificate (or named SEI course). Caregiver: official DSPD course record (score 80%+). Benefits: designated-staff attestation. No generic quiz substitute.",
  },
  {
    step: "review",
    title: "Admin accepts on the staff file",
    detail:
      "Submitted uploads sit in cert/upload review. Product reminders go to the reviewer, not a second staff nag. Acceptance greens the parent.",
  },
  {
    step: "renewal",
    title: "Re-verify on the live due rule",
    detail:
      "Driving renews on the hire anniversary (year 1+). ACRE / caregiver / benefits stay before providing that service — no invented annual-from-completion.",
  },
] as const;

export function isSecondExecutableBatchRuleId(ruleId: string): boolean {
  return (SECOND_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isSecondExecutableBatchLiveKey(key: string): boolean {
  return (SECOND_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function secondBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? draftRuleById(ruleId);
}

export function liveFactIdForSecondBatchKey(factKey: SecondBatchLiveFactKey): string {
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<SecondBatchLiveFactKey, string> = {
  transport_assignment: "Which staff transport persons?",
  sei_assignment: "Which staff are assigned to an SEI authorization?",
  sed_assignment: "Which staff are assigned to an SED authorization?",
  cmp_cms_assignment: "Which staff are assigned CMP or CMS?",
  designated_benefits_staff:
    "Which staff is designated as the qualified SSI / Title II / Medicaid earned-income person?",
};

export function secondBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = SECOND_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  const fromPath = binding.liveKeys
    .map((key) => livePathQuestionByDutyKey(key))
    .find((question) => question != null);
  return [
    {
      fact_id: liveFactIdForSecondBatchKey(binding.liveFactKey),
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

export function applySecondExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = secondBatchFixtureFor(rule.id);
  if (!fixture || !isSecondExecutableBatchRuleId(rule.id)) return rule;
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
            secondBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applySecondExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applySecondExecutableBatchOverlay(rule));
}

export function secondExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isSecondExecutableBatchRuleId(rule.id))
    .map((rule) => applySecondExecutableBatchOverlay(rule));
}

export function secondBatchBindingForRule(ruleId: string): SecondBatchEngineBinding | null {
  return SECOND_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function secondBatchLiveEngineReady(binding: SecondBatchEngineBinding): {
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
  if (binding.reminders !== "product_default") {
    reasons.push("Reminders must reuse product-default offsets, not invented SOW intervals.");
  }
  if (PRODUCT_REMINDER_OFFSETS_DAYS.length === 0) {
    reasons.push("Product reminder offsets are missing.");
  }
  if (binding.blocksSoloWhenLapsed !== isBlocksSoloWhenLapsedKey(binding.liveKeys[0])) {
    reasons.push(`Solo-lapse wiring mismatch for ${binding.liveKeys[0]}.`);
  }
  if (binding.ruleId === "REQ-1.30" && !TRANSPORT_DUTY_KEYS.includes("driving_record_transport")) {
    reasons.push("Transport duty set must include driving_record_transport.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function secondBatchAssignmentOpensClock(
  liveKey: SecondExecutableBatchLiveKey,
  staff: StaffDutyFacts,
): boolean {
  return staffReceivesDutyClock(evaluateStaffDuty({ dutyKey: liveKey, staff }));
}

export function secondBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function secondBatchParentIsWired(rule: DraftRule): boolean {
  if (!isSecondExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applySecondExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isSecondExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function secondBatchSharedLiveKeyParents(liveKey: string): string[] {
  return SECOND_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as SecondExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}
