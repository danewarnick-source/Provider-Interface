/**
 * Twelfth shared-behavior executable batch: SEI/SJD UPI employment-file
 * leftover parents (REQ-30.3.5, REQ-30.3.6, REQ-33.3.5, REQ-33.3.7) plus
 * the low-risk USOR contact pair (REQ-33.3.1, REQ-33.3.4.I).
 *
 * Reuses unused pack keys sei_employment_data_upi, sei_employment_strategies_upi,
 * sjd_employment_data_upi, and sjd_usor_contact_monthly. Pack has no
 * sjd_employment_strategies_upi sibling (adding one needs a catalog seed).
 * REQ-33.3.5 therefore shares the existing strategies key with an awarded-SJD
 * predicate, same family-key pattern as the FY Google Form batch.
 * Adjacent to wired REQ-30.3.4 / REQ-33.3.4 monthly summaries. Evidence is
 * external UPI / USOR plus admin attestation. Staff never touch UPI.
 * Predicate = awarded SEI / SJD. Official catalog clause_text only — do not
 * invent SOW. Do not include FY Google Form Cluster A REQs. Publication stays
 * off until VERIFIED_PUBLICATIONS is filled deliberately.
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

export const TWELFTH_EXECUTABLE_BATCH_ID = "sei_sjd_upi_employment_leftovers" as const;

export const TWELFTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "sei_employment_data_upi",
  "sei_employment_strategies_upi",
  "sjd_employment_data_upi",
  "sjd_usor_contact_monthly",
] as const;

export const TWELFTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-30.3.5",
  "REQ-30.3.6",
  "REQ-33.3.1",
  "REQ-33.3.4.I",
  "REQ-33.3.5",
  "REQ-33.3.7",
] as const;

export type TwelfthExecutableBatchRuleId = (typeof TWELFTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type TwelfthExecutableBatchLiveKey = (typeof TWELFTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type TwelfthBatchEngineBinding = {
  ruleId: TwelfthExecutableBatchRuleId;
  liveKeys: readonly TwelfthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_sei_sjd_employment";
  evidence: "external_then_upload";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review";
  blocksSoloWhenLapsed: boolean;
  factId: string;
  awardedCodes: readonly string[];
  disposition: "obligation";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;
const ROUTES: CompletionRoute[] = ["EXTERNAL", "UPLOAD"];

const OFFICIAL = {
  "REQ-30.3.5":
    "(5) enter and maintain the Person's employment data directly into UPI for each Person by the 15th of the month following the month of service; and",
  "REQ-30.3.6":
    "(6) enter employment support strategies into UPI no later than two weeks after the update of the PCSP.",
  "REQ-33.3.1":
    "(1) document and verify with the Person monthly if they have received any outreach from USOR (if funding becomes available the Person must transfer the service to USOR Vocational);",
  "REQ-33.3.4.I": "(I) contact date with USOR and the Person's funding status with them.",
  "REQ-33.3.5":
    "(5) enter employment support strategies into UPI no later than two weeks after the update of the PCSP; and",
  "REQ-33.3.7": "(7) enter and maintain the Person's employment data directly into UPI for each Person.",
} as const;

const TIMING = {
  monthly15: {
    kind: "none",
    reason:
      "Official workbook deadline: 15th of the month following the month of service. Recurrence: monthly. Do not invent hire+N or annual-from-completion.",
  } satisfies TimingAnchor,
  pcsp2w: {
    kind: "none",
    reason:
      "Official workbook deadline: two weeks after the update of the PCSP. Do not invent hire+N or annual-from-completion.",
  } satisfies TimingAnchor,
  monthlyMissing: {
    kind: "none",
    reason:
      "Official workbook recurrence: monthly. Timing date is missing-information. Do not invent hire+N or annual-from-completion.",
  } satisfies TimingAnchor,
  missing: {
    kind: "none",
    reason:
      "Timing is missing-information. Do not invent an interval or annual-from-completion.",
  } satisfies TimingAnchor,
} as const;

const UPI_HANDLING =
  "Complete in UPI, then administrator attests and attaches proof. Staff never touch UPI. HIVE cannot transmit to UPI.";

const USOR_HANDLING =
  "Verify USOR outreach and funding status outside the platform, then record completion. Staff never touch UPI.";

type LeftoverSpec = {
  id: TwelfthExecutableBatchRuleId;
  liveKey: TwelfthExecutableBatchLiveKey;
  clause: string;
  title: string;
  codes: readonly string[];
  factId: string;
  question: string;
  official: string;
  timing: TimingAnchor;
  handling: string;
};

const SPECS: readonly LeftoverSpec[] = [
  {
    id: "REQ-30.3.5",
    liveKey: "sei_employment_data_upi",
    clause: "SOW §30.3(5)",
    title: "SEI employment data — UPI entry attestation",
    codes: ["SEI"],
    factId: "FACT-008",
    question: "Agency awarded SEI?",
    official: OFFICIAL["REQ-30.3.5"],
    timing: TIMING.monthly15,
    handling: UPI_HANDLING,
  },
  {
    id: "REQ-30.3.6",
    liveKey: "sei_employment_strategies_upi",
    clause: "SOW §30.3(6)",
    title: "SEI employment support strategies — UPI entry",
    codes: ["SEI"],
    factId: "FACT-008",
    question: "Agency awarded SEI?",
    official: OFFICIAL["REQ-30.3.6"],
    timing: TIMING.pcsp2w,
    handling: UPI_HANDLING,
  },
  {
    id: "REQ-33.3.1",
    liveKey: "sjd_usor_contact_monthly",
    clause: "SOW §33.3(1)",
    title: "SJD monthly USOR outreach verification",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    official: OFFICIAL["REQ-33.3.1"],
    timing: TIMING.monthlyMissing,
    handling: USOR_HANDLING,
  },
  {
    id: "REQ-33.3.4.I",
    liveKey: "sjd_usor_contact_monthly",
    clause: "SOW §33.3(4)(I)",
    title: "SJD USOR contact date and funding status",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    official: OFFICIAL["REQ-33.3.4.I"],
    timing: TIMING.missing,
    handling: USOR_HANDLING,
  },
  {
    id: "REQ-33.3.5",
    liveKey: "sei_employment_strategies_upi",
    clause: "SOW §33.3(5)",
    title: "SJD employment support strategies — UPI entry",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    official: OFFICIAL["REQ-33.3.5"],
    timing: TIMING.pcsp2w,
    handling: UPI_HANDLING,
  },
  {
    id: "REQ-33.3.7",
    liveKey: "sjd_employment_data_upi",
    clause: "SOW §33.3(7)",
    title: "SJD employment data — UPI entry attestation",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    official: OFFICIAL["REQ-33.3.7"],
    timing: TIMING.monthly15,
    handling: UPI_HANDLING,
  },
];

function tests(prefix: string, codes: readonly string[]): DraftRuleTest[] {
  const label = codes.join("/");
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `Awarded ${label} plus administrator attestation that the official UPI/USOR employment-file work is complete greens the parent.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A generic attestation without the official UPI/USOR record leaves the parent incomplete. Staff never touch UPI. A service code outside this article does not open this parent.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "Adjacent to REQ-30.3.4 / REQ-33.3.4 monthly summaries — not those cards. REQ-33.3.5 shares sei_employment_strategies_upi because the pack has no SJD-strategies sibling. Empty awarded codes stay a question. Do not invent hire+N, a new pack key, FY Google Form twins, or quarterly/annual-outcome clocks.",
    },
  ];
}

function fileRule(spec: LeftoverSpec): DraftRule {
  const predicate: DraftPredicate = {
    kind: "awarded_service_codes",
    catalogKey: spec.liveKey,
    serviceCodes: spec.codes,
  };
  return {
    id: spec.id,
    version: 1,
    title: spec.title,
    catalogKeys: [spec.liveKey],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource([spec.clause]),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: [predicate],
    group: {
      logic: "ALL",
      parentAssignment: "one",
      members: [
        {
          id: `${spec.id}-file`,
          label: spec.official,
          sourceClauseId: spec.clause,
          catalogKey: spec.liveKey,
          completionRoutes: ROUTES,
        },
      ],
    },
    timing: spec.timing,
    evidence: {
      summary: spec.official,
      routes: ROUTES,
      defaultHandlingLabel: spec.handling,
      automaticEquivalency: NO_EQUIV,
    },
    completionRoutes: ROUTES,
    tests: tests(spec.id, spec.codes),
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

export const TWELFTH_BATCH_ENGINE_BINDINGS: readonly TwelfthBatchEngineBinding[] = SPECS.map(
  (spec) => ({
    ruleId: spec.id,
    liveKeys: [spec.liveKey],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "awarded_sei_sjd_employment",
    evidence: "external_then_upload",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    factId: spec.factId,
    awardedCodes: spec.codes,
    disposition: "obligation",
    sharesLiveKeyWith: SPECS.filter((row) => row.liveKey === spec.liveKey && row.id !== spec.id).map(
      (row) => row.id,
    ),
  }),
);

export const TWELFTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record whether this contractor is awarded SEI and/or SJD",
    detail:
      "FACT-008 (Agency awarded SEI?) and FACT-002 (Agency awarded SJD?) stay questions until awarded codes are recorded. Empty stays unanswered — never silent N/A. Staff never touch UPI.",
  },
  {
    step: "task",
    title: "One parent card per unused employment-file live key",
    detail:
      "sei_employment_data_upi, sei_employment_strategies_upi, sjd_employment_data_upi, and sjd_usor_contact_monthly. Adjacent to sei_monthly_summary_upi / sjd_monthly_summary_upi — not those cards. REQ-33.3.5 shares the strategies key. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Complete in UPI or USOR, then record admin attestation",
    detail:
      "Employment data and support strategies are EXTERNAL UPI entry plus UPLOAD proof. USOR contact is EXTERNAL verification plus recorded completion. HIVE cannot transmit to UPI. Staff never touch UPI.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload review",
    detail:
      "Submitted attestations sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the official workbook trigger only",
    detail:
      "Employment data: 15th of the month following the month of service. Support strategies: two weeks after the PCSP update. USOR monthly verify copies workbook recurrence only. REQ-33.3.4.I timing stays missing-information. Do not invent hire+N or annual-from-completion.",
  },
] as const;

export function isTwelfthExecutableBatchRuleId(ruleId: string): boolean {
  return (TWELFTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isTwelfthExecutableBatchLiveKey(key: string): boolean {
  return (TWELFTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function twelfthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function twelfthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
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

export function applyTwelfthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = twelfthBatchFixtureFor(rule.id);
  if (!fixture || !isTwelfthExecutableBatchRuleId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, twelfthBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applyTwelfthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyTwelfthExecutableBatchOverlay(rule));
}

export function twelfthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isTwelfthExecutableBatchRuleId(rule.id))
    .map((rule) => applyTwelfthExecutableBatchOverlay(rule));
}

export function twelfthBatchBindingForRule(ruleId: string): TwelfthBatchEngineBinding | null {
  return TWELFTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function twelfthBatchLiveEngineReady(row: TwelfthBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || !isTwelfthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on the unused SEI/SJD employment-file keys — do not fork a second checklist.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function twelfthBatchAssignmentOpensClock(
  liveKey: TwelfthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function twelfthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function twelfthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isTwelfthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyTwelfthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isTwelfthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function twelfthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return TWELFTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as TwelfthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function twelfthBatchOmitsFyGoogleFormMonthlySummariesAndInventedKeys(): boolean {
  const keys = TWELFTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = TWELFTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("sei_employment_data_upi") &&
    keys.includes("sei_employment_strategies_upi") &&
    keys.includes("sjd_employment_data_upi") &&
    keys.includes("sjd_usor_contact_monthly") &&
    !keys.includes("sjd_employment_strategies_upi") &&
    !keys.includes("sei_monthly_summary_upi") &&
    !keys.includes("sjd_monthly_summary_upi") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("sei_annual_outcome") &&
    !keys.includes("fba_bsp") &&
    !keys.includes("hhs_evac_drills_quarterly") &&
    !rules.includes("REQ-30.3.4") &&
    !rules.includes("REQ-33.3.4") &&
    !rules.includes("REQ-11.7.c") &&
    !rules.includes("REQ-30.7.c") &&
    !rules.includes("REQ-1.15.1") &&
    !rules.includes("REQ-3.3.1")
  );
}
