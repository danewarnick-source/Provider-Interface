/**
 * Seventeenth shared-behavior executable batch: MEGA invent-1 —
 * professional nursing leftovers (PM1/PM2 + PN1/PN2).
 *
 * Invents two pack liveKeys and awarded-code predicates. Official catalog
 * clause_text only — do not invent SOW. REQ-19.2.10 stays a leftover child
 * on the medical-care-plan card — do not invent a PN1/PN2 monthly-summary
 * key. Never delete MAR/eMAR; medication_record stays the Article 1 med
 * file. Punch pad stays the incident clock. Staff never touch UPI. EVV
 * stays CSV only. Publication stays off until VERIFIED_PUBLICATIONS is
 * filled deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { awardedCodeDutyStatus, type OrgFacts } from "./applicability.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
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

export const SEVENTEENTH_EXECUTABLE_BATCH_ID = "professional_nursing_leftovers" as const;

export const SEVENTEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "pm_nursing_file",
  "pn_medical_care_plan",
] as const;

export const SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-16.2.3",
  "REQ-16.2.7",
  "REQ-16.2.8",
  "REQ-16.2.9",
  "REQ-16.4",
  "REQ-17.2.3",
  "REQ-17.2.7",
  "REQ-17.2.8",
  "REQ-17.2.9",
  "REQ-17.4",
  "REQ-18.2.3",
  "REQ-18.5",
  "REQ-19.2.7",
  "REQ-19.2.8",
  "REQ-19.2.8.A",
  "REQ-19.2.8.B",
  "REQ-19.2.9.A",
  "REQ-19.2.9.B",
  "REQ-19.2.10",
  "REQ-19.5.a",
  "REQ-19.5.b",
] as const;

export const SEVENTEENTH_BATCH_HOLD_OUT_RULE_IDS = [
  "REQ-1.4.3",
  "REQ-1.5",
  "REQ-1.13.4",
  "REQ-1.32.a",
  "REQ-1.34",
  "REQ-7.3.5",
  "REQ-8.3.3",
  "REQ-9.3.5",
  "REQ-10.5",
  "REQ-23.3.1",
  "REQ-30.8.1",
  "REQ-33.7.1",
] as const;

export type SeventeenthExecutableBatchRuleId =
  (typeof SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type SeventeenthExecutableBatchLiveKey =
  (typeof SEVENTEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type SeventeenthBatchLiveFactKey =
  | "awarded_pm1"
  | "awarded_pm2"
  | "awarded_pn1"
  | "awarded_pn2";

export type SeventeenthBatchEngineBinding = {
  ruleId: SeventeenthExecutableBatchRuleId;
  liveKeys: readonly SeventeenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_service_leftover";
  evidence: "hybrid_record" | "upload_file";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review" | "upload_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: SeventeenthBatchLiveFactKey;
  awardedCodes: readonly string[];
  factId: string;
  disposition: "standing";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Standing nursing leftover file — keep current. Do not invent hire+N, annual-from-completion, or a PN1/PN2 monthly-summary key.",
};

type FamilyMeta = {
  title: string;
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
  evidence: SeventeenthBatchEngineBinding["evidence"];
  adminReview: SeventeenthBatchEngineBinding["adminReview"];
};

const FAMILIES: Readonly<Record<SeventeenthExecutableBatchLiveKey, FamilyMeta>> = {
  pm_nursing_file: {
    title: "PM1/PM2 Nursing File — Medication Program Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live PM1/PM2 nursing file is the handling path. Official workbook clause_text stays the member label. Do not replace or delete MAR/eMAR. medication_record stays the Article 1 med file.",
    evidence: "hybrid_record",
    adminReview: "record_review",
  },
  pn_medical_care_plan: {
    title: "PN1/PN2 Medical Care Plan — Nursing Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live PN medical-care-plan file is the handling path. REQ-19.2.10 is a leftover child on this card — do not invent a PN1/PN2 monthly-summary key. Staff never touch UPI. EVV stays CSV only.",
    evidence: "hybrid_record",
    adminReview: "record_review",
  },
};

const OFFICIAL = {
  "REQ-16.2.3":
    "(3) review, monitor, and document in the Person's medical data sheet, laboratory testing related to a prescribed medication regimen;",
  "REQ-16.2.7":
    "(7) review all reported medication errors and determine if it is necessary to consult with additional health care professionals and to report the medication error. When a medication error is determined, do the following:",
  "REQ-16.2.8":
    "(8) notify the Person's representative/legal guardian within 24 hours of the development of a Person's medical illness or injury requiring a medical appointment or an emergency room visit. (This does not include medical appointments for general health check-ups.);",
  "REQ-16.2.9":
    "(9) make regularly scheduled, documented face-to-face visits with the Person to conduct a written assessment of the Person's health and safety regarding the Person's health care professional prescribed medication regimen. If determined necessary by the PM1 Staff, include a review of other health needs as they relate to the overall wellbeing of the individual. If the assessment reveals information necessary to the Person's healthcare professional, the PM1 Staff must relay that information to the Person's healthcare professional. The PM1 Staff must maintain the assessment in the Person's records. The PM1 Staff must ensure the assessment:",
  "REQ-16.4":
    "16.4 Specific Staff Qualifications. The Contractor shall ensure that PM1 Staff have a current LPN or higher DOPL license.",
  "REQ-17.2.3":
    "(3) review, monitor, and document in the Person's medical data sheet, laboratory testing related to a prescribed medication regimen;",
  "REQ-17.2.7":
    "(7) review all reported medication errors and determine if it is necessary to consult with additional health care professionals and to report the medication error. When a medication error is determined, do the following:",
  "REQ-17.2.8":
    "(8) notify the Person's representative/legal guardian within 24 hours of the development of a Person's medical illness or injury requiring a medical appointment or an emergency room visit. (This does not include medical appointments for general health check-ups.)",
  "REQ-17.2.9":
    "(9) make regularly scheduled, documented face-to-face visits with the Person to conduct a written assessment of the Person's health and safety regarding the Person's medication regimen that has been prescribed to the Person from their health care professional. As determined necessary by the PM2 Staff, the assessment may include a review of other health needs as they relate to the overall wellbeing of the individual. If the assessment reveals information that should be relayed to the Person's healthcare professional, the PM2 Staff must relay that information to the Person's healthcare professional. The PM2 Staff shall maintain the assessment in the Person's records. The PM2 Staff shall ensure the assessment:",
  "REQ-17.4":
    "17.4 Specific Staff Qualifications. The Contractor shall ensure that PM2 Staff have a current RN or higher DOPL license.",
  "REQ-18.2.3":
    "(3) PN1 in compliance with the Person's medical care plan developed by the Contractor's PN2 Staff. The PN1 Staff must submit written reports summarizing service provided to the Person to the Contractor's PN2 Staff as per the Person's Medical Care Plan.",
  "REQ-18.5":
    "18.5 Specific Staff Training. Prior to providing PN1 service, the PN1 Staff shall be trained by the Contractor's PN2 Staff on the medical care tasks that will be provided, and the Person's Medical Care Plan.",
  "REQ-19.2.7":
    "(7) RN PN2 Staff develop the Person's Medical Care Plan. When PN2 services start, the initial Medical Care Plan must be approved by a DSPD nurse via email at ctwnurse@utah.gov. Updates to the Medical Care Plan do not need to be approved by the DSPD Nurse. The Medical Care Plan must include:",
  "REQ-19.2.8":
    "(8) the Medical Care Plan is reviewed at least annually by the RN PN2 Staff, unless the Person has substantial medical change. If the Person has a substantial medical change, the RN PN2 Staff must:",
  "REQ-19.2.8.A":
    "(A) review and update the Person's Medical Care Plan, as needed, within seven Calendar Days of discovering the medical change; and",
  "REQ-19.2.8.B":
    "(B) train Staff, who nursing services are being delegated to, on any changes to the Medical Care Plan prior to providing the Person services.",
  "REQ-19.2.9.A":
    "(A) provide assistance and training to mitigate or resolve the urgent health and safety risk; and",
  "REQ-19.2.9.B": "(B) document the situation and outcome in the Person's record.",
  "REQ-19.2.10":
    "(10) PN2 Staff create a written monthly summary of services for each month services are provided. The monthly summary must include a status note on each item in the Person's Medical Care Plan. The monthly summaries must be submitted to the DSPD nurse and the Person's Support Coordinator the first year the Person is receiving PN2 service and to the Person's Support Coordinator monthly thereafter. The monthly summary must be submitted no later than 15 Calendar Days after the service month ended.",
  "REQ-19.5.a": "(a) At least one Staff must have a current RN or higher license through DOPL.",
  "REQ-19.5.b":
    "(b) If using an LPN PN2 Staff, the LPN PN2 Staff must have a LPN license through DOPL and be working under the delegation and supervision of a RN or higher DOPL licensed PN2 Staff.",
} as const;

type ChildSpec = {
  id: SeventeenthExecutableBatchRuleId;
  liveKey: SeventeenthExecutableBatchLiveKey;
  section: string;
  codes: readonly string[];
  factId: string;
  question: string;
  liveFactKey: SeventeenthBatchLiveFactKey;
};

const SPECS: readonly ChildSpec[] = [
  {
    id: "REQ-16.2.3",
    liveKey: "pm_nursing_file",
    section: "16.2(3)",
    codes: ["PM1"],
    factId: "FACT-023",
    question: "Agency awarded PM1?",
    liveFactKey: "awarded_pm1",
  },
  {
    id: "REQ-16.2.7",
    liveKey: "pm_nursing_file",
    section: "16.2(7)",
    codes: ["PM1"],
    factId: "FACT-023",
    question: "Agency awarded PM1?",
    liveFactKey: "awarded_pm1",
  },
  {
    id: "REQ-16.2.8",
    liveKey: "pm_nursing_file",
    section: "16.2(8)",
    codes: ["PM1"],
    factId: "FACT-023",
    question: "Agency awarded PM1?",
    liveFactKey: "awarded_pm1",
  },
  {
    id: "REQ-16.2.9",
    liveKey: "pm_nursing_file",
    section: "16.2(9)",
    codes: ["PM1"],
    factId: "FACT-023",
    question: "Agency awarded PM1?",
    liveFactKey: "awarded_pm1",
  },
  {
    id: "REQ-16.4",
    liveKey: "pm_nursing_file",
    section: "16.4",
    codes: ["PM1"],
    factId: "FACT-023",
    question: "Agency awarded PM1?",
    liveFactKey: "awarded_pm1",
  },
  {
    id: "REQ-17.2.3",
    liveKey: "pm_nursing_file",
    section: "17.2(3)",
    codes: ["PM2"],
    factId: "FACT-024",
    question: "Agency awarded PM2?",
    liveFactKey: "awarded_pm2",
  },
  {
    id: "REQ-17.2.7",
    liveKey: "pm_nursing_file",
    section: "17.2(7)",
    codes: ["PM2"],
    factId: "FACT-024",
    question: "Agency awarded PM2?",
    liveFactKey: "awarded_pm2",
  },
  {
    id: "REQ-17.2.8",
    liveKey: "pm_nursing_file",
    section: "17.2(8)",
    codes: ["PM2"],
    factId: "FACT-024",
    question: "Agency awarded PM2?",
    liveFactKey: "awarded_pm2",
  },
  {
    id: "REQ-17.2.9",
    liveKey: "pm_nursing_file",
    section: "17.2(9)",
    codes: ["PM2"],
    factId: "FACT-024",
    question: "Agency awarded PM2?",
    liveFactKey: "awarded_pm2",
  },
  {
    id: "REQ-17.4",
    liveKey: "pm_nursing_file",
    section: "17.4",
    codes: ["PM2"],
    factId: "FACT-024",
    question: "Agency awarded PM2?",
    liveFactKey: "awarded_pm2",
  },
  {
    id: "REQ-18.2.3",
    liveKey: "pn_medical_care_plan",
    section: "18.2(3)",
    codes: ["PN1"],
    factId: "FACT-037",
    question: "Agency awarded PN1?",
    liveFactKey: "awarded_pn1",
  },
  {
    id: "REQ-18.5",
    liveKey: "pn_medical_care_plan",
    section: "18.5",
    codes: ["PN1"],
    factId: "FACT-037",
    question: "Agency awarded PN1?",
    liveFactKey: "awarded_pn1",
  },
  {
    id: "REQ-19.2.7",
    liveKey: "pn_medical_care_plan",
    section: "19.2(7)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.2.8",
    liveKey: "pn_medical_care_plan",
    section: "19.2(8)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.2.8.A",
    liveKey: "pn_medical_care_plan",
    section: "19.2(8)(A)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.2.8.B",
    liveKey: "pn_medical_care_plan",
    section: "19.2(8)(B)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.2.9.A",
    liveKey: "pn_medical_care_plan",
    section: "19.2(9)(A)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.2.9.B",
    liveKey: "pn_medical_care_plan",
    section: "19.2(9)(B)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.2.10",
    liveKey: "pn_medical_care_plan",
    section: "19.2(10)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.5.a",
    liveKey: "pn_medical_care_plan",
    section: "19.5(a)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
  {
    id: "REQ-19.5.b",
    liveKey: "pn_medical_care_plan",
    section: "19.5(b)",
    codes: ["PN2"],
    factId: "FACT-014",
    question: "Agency awarded PN2?",
    liveFactKey: "awarded_pn2",
  },
];

function tests(prefix: string, liveKey: SeventeenthExecutableBatchLiveKey): DraftRuleTest[] {
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `The live ${liveKey} parent file plus the awarded-code predicate greens this leftover child on that card.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A generic attestation without the live parent file leaves the leftover child incomplete. A known-false applicability fact does not open this clock.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "Leftover children stay on the invented parent card. Official catalog clause_text only. Do not invent a PN1/PN2 monthly-summary key. Never delete MAR/eMAR. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only.",
    },
  ];
}

function predicateFor(spec: ChildSpec): DraftPredicate {
  return {
    kind: "awarded_service_codes",
    catalogKey: spec.liveKey,
    serviceCodes: spec.codes,
  };
}

function fileRule(spec: ChildSpec): DraftRule {
  const family = FAMILIES[spec.liveKey];
  const official = OFFICIAL[spec.id];
  const clause = `SOW §${spec.section}`;
  return {
    id: spec.id,
    version: 1,
    title: family.title,
    catalogKeys: [spec.liveKey],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource([clause]),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: [predicateFor(spec)],
    group: {
      logic: "ALL",
      parentAssignment: "one",
      members: [
        {
          id: `${spec.id}-file`,
          label: official,
          sourceClauseId: clause,
          catalogKey: spec.liveKey,
          completionRoutes: family.routes,
        },
      ],
    },
    timing: family.timing,
    evidence: {
      summary: official,
      routes: family.routes,
      defaultHandlingLabel: family.handling,
      automaticEquivalency: NO_EQUIV,
    },
    completionRoutes: family.routes,
    tests: tests(spec.id, spec.liveKey),
    unresolvedAlternatives: [],
    unresolvedRenewals: [],
    releaseGaps: [],
    publicationGap: null,
    approval: null,
  };
}

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = Object.fromEntries(
  SPECS.map((spec) => [spec.id, fileRule(spec)]),
);

export const SEVENTEENTH_BATCH_ENGINE_BINDINGS: readonly SeventeenthBatchEngineBinding[] =
  SPECS.map((spec) => {
    const family = FAMILIES[spec.liveKey];
    const siblingIds = SPECS.filter((row) => row.liveKey === spec.liveKey && row.id !== spec.id).map(
      (row) => row.id,
    );
    return {
      ruleId: spec.id,
      liveKeys: [spec.liveKey],
      parentAssignment: "one",
      mintsElementTasks: false,
      assignment: "awarded_service_leftover",
      evidence: family.evidence,
      trainingTitle: null,
      formTitle: null,
      reminders: "product_default",
      adminReview: family.adminReview,
      blocksSoloWhenLapsed: false,
      liveFactKey: spec.liveFactKey,
      awardedCodes: spec.codes,
      factId: spec.factId,
      disposition: "standing",
      sharesLiveKeyWith: siblingIds,
    };
  });

export const SEVENTEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Reuse awarded-code applicability facts",
    detail:
      "PM1 leftovers open on awarded PM1. PM2 leftovers open on awarded PM2. PN1 leftovers open on awarded PN1. PN2 leftovers open on awarded PN2. Empty facts stay questions — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per invented nursing live key",
    detail:
      "Twenty-one leftover children collapse onto pm_nursing_file and pn_medical_care_plan. Child items stay on the parent. REQ-19.2.10 stays on the care-plan card.",
  },
  {
    step: "evidence",
    title: "Map official catalog clause_text — no invented SOW",
    detail:
      "Official workbook clause_text is the member label. Upload or the live nursing record is the handling path. Do not delete MAR/eMAR. Staff never touch UPI. EVV stays CSV only.",
  },
  {
    step: "review",
    title: "Admin accepts on the upload/record review",
    detail:
      "Submitted files sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the standing keep-current rule only",
    detail:
      "Standing nursing files stay keep-current. Do not invent hire+N, annual-from-completion, or a PN1/PN2 monthly-summary key.",
  },
] as const;

export function isSeventeenthExecutableBatchRuleId(ruleId: string): boolean {
  return (SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isSeventeenthExecutableBatchLiveKey(key: string): boolean {
  return (SEVENTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function seventeenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function seventeenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) return [];
  return [{ fact_id: spec.factId, question: spec.question }];
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

export function applySeventeenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = seventeenthBatchFixtureFor(rule.id);
  if (!fixture || !isSeventeenthExecutableBatchRuleId(rule.id)) return rule;
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
            seventeenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applySeventeenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applySeventeenthExecutableBatchOverlay(rule));
}

export function seventeenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isSeventeenthExecutableBatchRuleId(rule.id))
    .map((rule) => applySeventeenthExecutableBatchOverlay(rule));
}

export function seventeenthBatchBindingForRule(
  ruleId: string,
): SeventeenthBatchEngineBinding | null {
  return SEVENTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function seventeenthBatchLiveEngineReady(row: SeventeenthBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of row.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== row.disposition) {
      reasons.push(`${key} is ${entry.disposition}, expected ${row.disposition}.`);
    }
  }
  if (row.parentAssignment !== "one") {
    reasons.push("Parent assignment must stay one — no per-element staff tasks.");
  }
  if (row.mintsElementTasks) {
    reasons.push("Child elements must not mint staff tasks.");
  }
  if (row.trainingTitle !== null) {
    reasons.push("This batch does not invent an in-Hive course.");
  }
  if (row.formTitle !== null) {
    reasons.push("This batch does not invent a person form.");
  }
  if (row.reminders !== "product_default") {
    reasons.push("Reminders must reuse product-default offsets, not invented SOW intervals.");
  }
  if (PRODUCT_REMINDER_OFFSETS_DAYS.length === 0) {
    reasons.push("Product reminder offsets are missing.");
  }
  if (row.blocksSoloWhenLapsed !== isBlocksSoloWhenLapsedKey(row.liveKeys[0])) {
    reasons.push(`Solo-lapse wiring mismatch for ${row.liveKeys[0]}.`);
  }
  if (row.liveKeys.length !== 1 || !isSeventeenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on the two invented nursing liveKeys.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function seventeenthBatchAssignmentOpensClock(
  liveKey: SeventeenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function seventeenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function seventeenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isSeventeenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applySeventeenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isSeventeenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function seventeenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return SEVENTEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as SeventeenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function seventeenthBatchExpectedLiveKey(
  ruleId: SeventeenthExecutableBatchRuleId,
): SeventeenthExecutableBatchLiveKey {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) throw new Error(`Unknown seventeenth-batch rule ${ruleId}`);
  return spec.liveKey;
}

export function seventeenthBatchOfficialClause(ruleId: SeventeenthExecutableBatchRuleId): string {
  return OFFICIAL[ruleId];
}

export function seventeenthBatchOmitsBlockedFamilies(): boolean {
  const keys = SEVENTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = SEVENTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("pm_nursing_file") &&
    keys.includes("pn_medical_care_plan") &&
    !keys.includes("medication_record") &&
    !keys.includes("sei_monthly_summary_upi") &&
    !keys.includes("sjd_monthly_summary_upi") &&
    !keys.includes("client_specific_training") &&
    !rules.includes("REQ-1.4.3") &&
    !rules.includes("REQ-1.34") &&
    !rules.includes("REQ-7.3.5") &&
    !rules.includes("REQ-30.8.1") &&
    !rules.includes("REQ-33.7.1") &&
    !rules.includes("REQ-1.32.a") &&
    !rules.includes("REQ-23.3.1") &&
    rules.includes("REQ-19.2.10")
  );
}
