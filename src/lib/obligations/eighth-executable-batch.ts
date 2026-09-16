/**
 * Mega B / eighth shared-behavior executable batch: Article 1 standing
 * org policy and process files.
 *
 * Overlays executable fields onto imported catalog parents that already
 * have live company_obligations keys. Child elements stay on the parent.
 * Timing is copied from the live pack due_rule — no invented hire+N,
 * annual-from-completion, PN1/PN2, quarterly evac, or annual-outcome keys.
 * Publication stays off until VERIFIED_PUBLICATIONS is filled deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import { humanRightsPlanStatus } from "./applicability.ts";
import { PRODUCT_REMINDER_OFFSETS_DAYS } from "./draft-rules/reminders.ts";
import type { CatalogFact, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { linkWorkbookSource, WORKBOOK_SOURCE_INDEX } from "./draft-rules/source.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type {
  CompletionRoute,
  DraftPredicate,
  DraftRule,
  DraftRuleTest,
  TimingAnchor,
} from "./draft-rules/types.ts";

export const EIGHTH_EXECUTABLE_BATCH_ID = "article1_org_policy_process_files" as const;

/** Imported catalog parents this mega overlays. */
export const EIGHTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.11",
  "REQ-1.14",
  "REQ-1.18",
  "REQ-1.21",
  "REQ-1.22.c",
  "REQ-1.23",
  "REQ-1.28.7",
  "REQ-1.28.7.G",
  "REQ-1.28.9",
] as const;

export const EIGHTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "zoning_life_safety",
  "governing_board_records",
  "operating_policies",
  "human_rights_plan",
  "person_discharge_process",
  "health_support_policies",
  "emergency_loan_record",
  "large_loan_disclosure_process",
  "no_gifts_process",
] as const;

export type EighthExecutableBatchRuleId = (typeof EIGHTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type EighthExecutableBatchLiveKey = (typeof EIGHTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type EighthBatchLiveFactKey =
  | "operates_ol_site"
  | "has_governing_board"
  | "human_rights_plan_codes"
  | "contractor_standing_file";

export type EighthBatchEngineBinding = {
  ruleId: EighthExecutableBatchRuleId;
  liveKeys: readonly EighthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "contractor_file_reeval";
  evidence: "upload_file" | "hybrid_record";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review" | "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: EighthBatchLiveFactKey;
  disposition: "standing" | "by_design";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

function tests(prefix: string, rows: Array<[DraftRuleTest["kind"], string]>): DraftRuleTest[] {
  return rows.map(([kind, assert], i) => ({
    id: `${prefix}-t${i + 1}`,
    kind,
    assert,
  }));
}

function fileRule(input: {
  id: EighthExecutableBatchRuleId;
  title: string;
  liveKey: EighthExecutableBatchLiveKey;
  clauses: string[];
  predicate: DraftPredicate;
  timing: TimingAnchor;
  summary: string;
  routes: CompletionRoute[];
  handling: string;
  memberLabel: string;
  tests: Array<[DraftRuleTest["kind"], string]>;
}): DraftRule {
  return {
    id: input.id,
    version: 1,
    title: input.title,
    catalogKeys: [input.liveKey],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource(input.clauses),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: [input.predicate],
    group: {
      logic: "ALL",
      parentAssignment: "one",
      members: [
        {
          id: `${input.id}-file`,
          label: input.memberLabel,
          sourceClauseId: input.clauses[0] ?? input.id,
          catalogKey: input.liveKey,
          completionRoutes: input.routes,
        },
      ],
    },
    timing: input.timing,
    evidence: {
      summary: input.summary,
      routes: input.routes,
      defaultHandlingLabel: input.handling,
      automaticEquivalency: NO_EQUIV,
    },
    completionRoutes: input.routes,
    tests: tests(input.id, input.tests),
    unresolvedAlternatives: [],
    unresolvedRenewals: [],
    releaseGaps: [],
    publicationGap: null,
    approval: null,
  };
}

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason: "Standing live-pack file — keep current. Calendar is reminder-only. Do not invent hire+N.",
};

const ZONING_CALENDAR_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Live pack calendar_year July 1 is a verification reminder on zoning_life_safety. Do not invent hire+N or annual-from-completion.",
};

const CONTRACTOR_PRED = (key: EighthExecutableBatchLiveKey): DraftPredicate => ({
  kind: "contractor_standing_file",
  catalogKey: key,
});

export const REQ_1_11_ZONING: DraftRule = fileRule({
  id: "REQ-1.11",
  title: "Zoning / Life Safety documentation — when an OL site is in use",
  liveKey: "zoning_life_safety",
  clauses: ["SOW §1.11"],
  predicate: CONTRACTOR_PRED("zoning_life_safety"),
  timing: ZONING_CALENDAR_NONE,
  summary:
    "Current zoning, Life Safety Code, and fire/health documentation on the live zoning_life_safety file. Empty operates_ol_site stays a question — never silent N/A. Child site items stay on this parent.",
  routes: ["UPLOAD"],
  handling: "Upload of the current site compliance file is the handling path when an OL site is recorded.",
  memberLabel: "Current zoning / Life Safety / fire-safety documentation",
  tests: [
    ["positive", "operates_ol_site=yes plus an uploaded compliance file satisfies the parent."],
    ["negative", "operates_ol_site=no does not open the zoning file clock."],
    ["boundary", "operates_ol_site unanswered stays missing-information, never auto N/A."],
  ],
});

export const REQ_1_14_BOARD: DraftRule = fileRule({
  id: "REQ-1.14",
  title: "Governing or policy-making board records — when such a board exists",
  liveKey: "governing_board_records",
  clauses: ["SOW §1.14"],
  predicate: CONTRACTOR_PRED("governing_board_records"),
  timing: STANDING_NONE,
  summary:
    "By-laws plus quarterly minutes on the live governing_board_records file when a governing or policy-making board exists. Empty has_governing_board stays a question. Child by-law/minutes items stay on this parent.",
  routes: ["UPLOAD"],
  handling: "Upload of by-laws and board minutes is the handling path when a board is recorded.",
  memberLabel: "Current governing-board by-laws and minutes",
  tests: [
    ["positive", "has_governing_board=yes plus uploaded by-laws and minutes satisfies the parent."],
    ["negative", "has_governing_board=no does not open the board-records clock."],
    ["boundary", "has_governing_board unanswered stays missing-information, never auto N/A."],
  ],
});

export const REQ_1_18_OPERATING: DraftRule = fileRule({
  id: "REQ-1.18",
  title: "Operating policies and procedures",
  liveKey: "operating_policies",
  clauses: ["SOW §1.18"],
  predicate: CONTRACTOR_PRED("operating_policies"),
  timing: STANDING_NONE,
  summary:
    "Current operating policies covering SOW §1.18 elements on the live operating_policies file. Child transportation/grievance/emergency items stay on this parent. A generic attestation is not equivalency.",
  routes: ["UPLOAD"],
  handling: "Upload of the current operating-policy set is the handling path, not a second clock per subsection.",
  memberLabel: "Current operating policies and procedures",
  tests: [
    ["positive", "An uploaded operating-policy set covering §1.18 elements satisfies the parent."],
    ["negative", "A generic attestation without the policy file leaves the parent incomplete."],
    ["boundary", "Child §1.18 items stay on this parent — do not mint per-subsection staff tasks."],
  ],
});

export const REQ_1_21_HRP: DraftRule = fileRule({
  id: "REQ-1.21",
  title: "Human Rights Plan — unless only CHA, HSQ, or PBA",
  liveKey: "human_rights_plan",
  clauses: ["SOW §1.21"],
  predicate: CONTRACTOR_PRED("human_rights_plan"),
  timing: STANDING_NONE,
  summary:
    "Written Human Rights Plan on the live human_rights_plan file. N/A only when awarded codes are solely CHA, HSQ, or PBA. Empty awarded codes stay a question. This parent is not the live HRC roster or restriction record.",
  routes: ["UPLOAD"],
  handling: "Upload of the written Human Rights Plan is the handling path, not an HRC meeting clock.",
  memberLabel: "Written Human Rights Plan",
  tests: [
    ["positive", "Awarded codes include a non-CHA/HSQ/PBA service plus an uploaded plan satisfies the parent."],
    ["negative", "Awarded codes that are only CHA, HSQ, or PBA do not open this file clock."],
    ["boundary", "Empty awarded codes stay missing-information, never auto N/A. Do not absorb hrc_committee."],
  ],
});

export const REQ_1_22_C_DISCHARGE: DraftRule = fileRule({
  id: "REQ-1.22.c",
  title: "Person-discharge process — written procedure",
  liveKey: "person_discharge_process",
  clauses: ["SOW §1.22(c)"],
  predicate: CONTRACTOR_PRED("person_discharge_process"),
  timing: STANDING_NONE,
  summary:
    "Written Person-discharge procedure on the live person_discharge_process file. Child 30-day notice and continuation items stay on this parent. This parent is the process file, not a per-discharge send clock.",
  routes: ["UPLOAD"],
  handling: "Upload of the written discharge procedure is the handling path, not a 30-day notice clock.",
  memberLabel: "Written Person-discharge procedure",
  tests: [
    ["positive", "An uploaded written discharge procedure satisfies the parent file."],
    ["negative", "A missing procedure file leaves the parent incomplete."],
    ["boundary", "Child REQ-1.22.c.1–3 stay on this parent — do not invent a 30-day send as this clock."],
  ],
});

export const REQ_1_23_HEALTH: DraftRule = fileRule({
  id: "REQ-1.23",
  title: "Health support policies and procedures",
  liveKey: "health_support_policies",
  clauses: ["SOW §1.23"],
  predicate: CONTRACTOR_PRED("health_support_policies"),
  timing: STANDING_NONE,
  summary:
    "Current health-support policies on the live health_support_policies file. Day-to-day medical, dental, and medication records stay Person artifacts — this parent is the contractor policy file. Child §1.23 items stay on this parent.",
  routes: ["UPLOAD"],
  handling: "Upload of the current health-support policy set is the handling path, not a Person medical record.",
  memberLabel: "Current health support policies and procedures",
  tests: [
    ["positive", "An uploaded health-support policy set satisfies the parent."],
    ["negative", "A Person medical or medication record does not satisfy the contractor policy file."],
    ["boundary", "Child §1.23 items stay on this parent — do not mint per-subsection staff tasks."],
  ],
});

export const REQ_1_28_7_LOAN: DraftRule = fileRule({
  id: "REQ-1.28.7",
  title: "Emergency loan documentation — live client-loans record",
  liveKey: "emergency_loan_record",
  clauses: ["SOW §1.28(7)"],
  predicate: CONTRACTOR_PRED("emergency_loan_record"),
  timing: STANDING_NONE,
  summary:
    "Live emergency-loan documentation on emergency_loan_record (client-loans module). N/A when there are no loans. Child 24-hour notice and accounting items stay on this parent. A generic attestation is not equivalency.",
  routes: ["IN_PLATFORM", "UPLOAD"],
  handling: "The live client-loans record is the handling path, not a generic attestation and not a new form.",
  memberLabel: "Emergency loan documentation",
  tests: [
    ["positive", "A live client-loans record with the required notices satisfies the parent."],
    ["negative", "A generic attestation without a loan record leaves the parent incomplete."],
    ["boundary", "Child REQ-1.28.7.A–F stay on this parent. REQ-1.28.7.G uses large_loan_disclosure_process."],
  ],
});

export const REQ_1_28_7_G_DISCLOSURE: DraftRule = fileRule({
  id: "REQ-1.28.7.G",
  title: "Large-loan disclosure process",
  liveKey: "large_loan_disclosure_process",
  clauses: ["SOW §1.28(7)(G)"],
  predicate: CONTRACTOR_PRED("large_loan_disclosure_process"),
  timing: STANDING_NONE,
  summary:
    "Written disclosure process for contractor-to-Person loans on the live large_loan_disclosure_process file. Live loan records stay on emergency_loan_record. Do not invent an annual-from-completion clock.",
  routes: ["UPLOAD"],
  handling: "Upload of the written large-loan disclosure process is the handling path, not a yearly send clock.",
  memberLabel: "Written large-loan disclosure process",
  tests: [
    ["positive", "An uploaded written large-loan disclosure process satisfies the parent."],
    ["negative", "A live emergency-loan record does not satisfy this process file."],
    ["boundary", "Do not invent annual-from-completion. This parent does not share emergency_loan_record."],
  ],
});

export const REQ_1_28_9_NO_GIFTS: DraftRule = fileRule({
  id: "REQ-1.28.9",
  title: "No gifts or purchases-from-staff process",
  liveKey: "no_gifts_process",
  clauses: ["SOW §1.28(9)", "SOW §1.28(10)"],
  predicate: CONTRACTOR_PRED("no_gifts_process"),
  timing: STANDING_NONE,
  summary:
    "Written no-gifts / no-purchases-from-staff process on the live no_gifts_process file. A generic attestation is not equivalency. This parent is not a per-claim reject clock.",
  routes: ["UPLOAD"],
  handling: "Upload of the written no-gifts process is the handling path, not automatic claim rejection.",
  memberLabel: "Written no-gifts or purchases-from-staff process",
  tests: [
    ["positive", "An uploaded written no-gifts process satisfies the parent."],
    ["negative", "A generic attestation without the process file leaves the parent incomplete."],
    ["boundary", "This parent does not mint a per-claim reject and does not invent PN1/PN2."],
  ],
});

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.11": REQ_1_11_ZONING,
  "REQ-1.14": REQ_1_14_BOARD,
  "REQ-1.18": REQ_1_18_OPERATING,
  "REQ-1.21": REQ_1_21_HRP,
  "REQ-1.22.c": REQ_1_22_C_DISCHARGE,
  "REQ-1.23": REQ_1_23_HEALTH,
  "REQ-1.28.7": REQ_1_28_7_LOAN,
  "REQ-1.28.7.G": REQ_1_28_7_G_DISCLOSURE,
  "REQ-1.28.9": REQ_1_28_9_NO_GIFTS,
};

export const EIGHTH_BATCH_ENGINE_BINDINGS: readonly EighthBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.11",
    liveKeys: ["zoning_life_safety"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "operates_ol_site",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.14",
    liveKeys: ["governing_board_records"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "has_governing_board",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.18",
    liveKeys: ["operating_policies"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.21",
    liveKeys: ["human_rights_plan"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "human_rights_plan_codes",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.22.c",
    liveKeys: ["person_discharge_process"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.23",
    liveKeys: ["health_support_policies"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.28.7",
    liveKeys: ["emergency_loan_record"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "hybrid_record",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_standing_file",
    disposition: "by_design",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.28.7.G",
    liveKeys: ["large_loan_disclosure_process"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.28.9",
    liveKeys: ["no_gifts_process"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
];

export const EIGHTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record OL-site, governing-board, and awarded-code facts",
    detail:
      "Zoning opens only when operates_ol_site is yes. Board records open only when has_governing_board is yes. Human Rights Plan is N/A only for solely CHA/HSQ/PBA. Empty facts stay questions.",
  },
  {
    step: "task",
    title: "One parent card per live key",
    detail:
      "Nine imported parents, nine live keys. REQ-1.28.7 and REQ-1.28.7.G stay on separate cards. Child file items stay on the parent.",
  },
  {
    step: "evidence",
    title: "Upload the live-pack file — no generic attestation substitute",
    detail:
      "Zoning file, board by-laws/minutes, operating policies, Human Rights Plan, discharge procedure, health-support policies, live loan record, large-loan disclosure process, no-gifts process.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload/record review",
    detail:
      "Submitted uploads sit in cert/upload review. The emergency-loan parent reuses the live client-loans record. Soft=none — this batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the live due rule only",
    detail:
      "Standing files are keep-current. Zoning's July 1 calendar is a reminder. Do not invent annual-from-completion for large-loan disclosure.",
  },
] as const;

export function isEighthExecutableBatchRuleId(ruleId: string): boolean {
  return (EIGHTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isEighthExecutableBatchLiveKey(key: string): boolean {
  return (EIGHTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function eighthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function liveFactIdForEighthBatchKey(factKey: EighthBatchLiveFactKey): string | null {
  if (factKey === "operates_ol_site") return "FACT-069";
  if (factKey === "has_governing_board") return "FACT-070";
  if (factKey === "human_rights_plan_codes") return "FACT-071";
  return null;
}

const LIVE_FACT_QUESTIONS: Record<Exclude<EighthBatchLiveFactKey, "contractor_standing_file">, string> =
  {
    operates_ol_site: "Which sites are licensed and require zoning/Life Safety/fire documentation?",
    has_governing_board: "Is the agency governed by a governing or policy-making board?",
    human_rights_plan_codes: "Does the agency provide ONLY CHA, HSQ or PBA? (if yes, not required)",
  };

export function eighthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = EIGHTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  const factId = liveFactIdForEighthBatchKey(binding.liveFactKey);
  if (!factId || binding.liveFactKey === "contractor_standing_file") return [];
  return [
    {
      fact_id: factId,
      question: LIVE_FACT_QUESTIONS[binding.liveFactKey],
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

export function applyEighthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = eighthBatchFixtureFor(rule.id);
  if (!fixture || !isEighthExecutableBatchRuleId(rule.id)) return rule;
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
            eighthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyEighthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyEighthExecutableBatchOverlay(rule));
}

export function eighthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isEighthExecutableBatchRuleId(rule.id))
    .map((rule) => applyEighthExecutableBatchOverlay(rule));
}

export function eighthBatchBindingForRule(ruleId: string): EighthBatchEngineBinding | null {
  return EIGHTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function eighthBatchLiveEngineReady(binding: EighthBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of binding.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== binding.disposition) {
      reasons.push(`${key} is ${entry.disposition}, expected ${binding.disposition}.`);
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
  return { ready: reasons.length === 0, reasons };
}

export function eighthBatchAssignmentOpensClock(
  liveKey: EighthExecutableBatchLiveKey,
  org: {
    operates_ol_site: boolean | null;
    has_governing_board: boolean | null;
    servicesOffered: string[];
  },
): boolean {
  if (liveKey === "zoning_life_safety") return org.operates_ol_site === true;
  if (liveKey === "governing_board_records") return org.has_governing_board === true;
  if (liveKey === "human_rights_plan") {
    return humanRightsPlanStatus(org.servicesOffered) === "applies";
  }
  return true;
}

export function eighthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function eighthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isEighthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyEighthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isEighthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid);
}

export function eighthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return EIGHTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as EighthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function eighthBatchOmitsInventedQuarterlyOutcomesAndPn(): boolean {
  const keys = EIGHTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = EIGHTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    !keys.includes("hhs_evac_drills_quarterly") &&
    !keys.includes("rhs_evac_drills_quarterly") &&
    !keys.includes("pps_evac_drills_quarterly") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("dsi_annual_outcome") &&
    !keys.includes("sei_annual_outcome") &&
    !keys.includes("sl_annual_outcome") &&
    !keys.includes("medicaid_disclosure_annual") &&
    !keys.includes("sei_employment_data_upi") &&
    !keys.includes("sjd_employment_data_upi") &&
    !keys.includes("personnel_policies") &&
    !rules.includes("REQ-1.9") &&
    !rules.includes("REQ-1.17") &&
    !rules.includes("REQ-1.22") &&
    !rules.includes("REQ-1.28.7.A") &&
    !rules.includes("REQ-11.3") &&
    !rules.includes("REQ-11.7") &&
    !rules.includes("REQ-18.5")
  );
}
