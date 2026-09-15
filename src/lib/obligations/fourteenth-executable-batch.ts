/**
 * Fourteenth shared-behavior executable batch: quarterly evac drill leftovers.
 *
 * Same leftover move as FY `.c` twins — wire imported `.6` parents onto
 * existing pack liveKeys. Do not invent umbrella REQ-11.3 / REQ-20.3 /
 * REQ-21.3. One drill-log card family, quarter-end, awarded-code predicates.
 * Official catalog clause_text only — do not invent SOW. Do not include
 * OL Day twins. Publication stays off until VERIFIED_PUBLICATIONS is filled
 * deliberately.
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

export const FOURTEENTH_EXECUTABLE_BATCH_ID = "quarterly_evac_drill_leftovers" as const;

export const FOURTEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "hhs_evac_drills_quarterly",
  "pps_evac_drills_quarterly",
  "rhs_evac_drills_quarterly",
] as const;

export const FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-11.3.6",
  "REQ-20.3.6",
  "REQ-21.3.6",
] as const;

export type FourteenthExecutableBatchRuleId = (typeof FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type FourteenthExecutableBatchLiveKey =
  (typeof FOURTEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type FourteenthBatchEngineBinding = {
  ruleId: FourteenthExecutableBatchRuleId;
  liveKeys: readonly FourteenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_quarterly_evac_drill";
  evidence: "upload_drill_log";
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
const ROUTES: CompletionRoute[] = ["UPLOAD"];

const OFFICIAL = {
  "REQ-11.3.6":
    "(6) ensure that quarterly evacuation drills with Persons and Staff at each site HHS are conducted and documented;",
  "REQ-20.3.6":
    "(6) ensure quarterly evacuation drills with Persons and Staff are conducted and documented at each PPS site;",
  "REQ-21.3.6":
    "(6) ensure that quarterly evacuation drills with Persons and Staff at each RHS site are conducted and documented;",
} as const;

const TIMING: TimingAnchor = { kind: "calendar_period", cadence: "quarterly" };

const HANDLING =
  "Upload the documented drill log. Due by the last day of the quarter — not the first day of the next quarter. The live quarterly evac card is the handling path.";

type TwinSpec = {
  id: FourteenthExecutableBatchRuleId;
  liveKey: FourteenthExecutableBatchLiveKey;
  clause: string;
  codes: readonly string[];
  factId: string;
  question: string;
  official: string;
};

const SPECS: readonly TwinSpec[] = [
  {
    id: "REQ-11.3.6",
    liveKey: "hhs_evac_drills_quarterly",
    clause: "SOW §11.3(6)",
    codes: ["HHS"],
    factId: "FACT-004",
    question: "Agency awarded HHS?",
    official: OFFICIAL["REQ-11.3.6"],
  },
  {
    id: "REQ-20.3.6",
    liveKey: "pps_evac_drills_quarterly",
    clause: "SOW §20.3(6)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    official: OFFICIAL["REQ-20.3.6"],
  },
  {
    id: "REQ-21.3.6",
    liveKey: "rhs_evac_drills_quarterly",
    clause: "SOW §21.3(6)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    official: OFFICIAL["REQ-21.3.6"],
  },
];

function tests(prefix: string, codes: readonly string[]): DraftRuleTest[] {
  const label = codes.join("/");
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `Awarded ${label} plus an uploaded quarterly drill log that satisfies the official site record greens the parent.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A service code outside this article does not open this parent. A generic attestation without the documented drill log leaves the parent incomplete.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "One drill-log card family. Quarter-end only — not the first day of the next quarter. Empty awarded codes stay a question. Do not invent umbrella REQ-11.3 / REQ-20.3 / REQ-21.3, hire+N, or OL Day twins.",
    },
  ];
}

function fileRule(spec: TwinSpec): DraftRule {
  const predicate: DraftPredicate = {
    kind: "awarded_service_codes",
    catalogKey: spec.liveKey,
    serviceCodes: spec.codes,
  };
  return {
    id: spec.id,
    version: 1,
    title: "Quarterly evacuation drill log",
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
    timing: TIMING,
    evidence: {
      summary: spec.official,
      routes: ROUTES,
      defaultHandlingLabel: HANDLING,
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

export const FOURTEENTH_BATCH_ENGINE_BINDINGS: readonly FourteenthBatchEngineBinding[] = SPECS.map(
  (spec) => ({
    ruleId: spec.id,
    liveKeys: [spec.liveKey],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "awarded_quarterly_evac_drill",
    evidence: "upload_drill_log",
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

export const FOURTEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record whether this contractor is awarded HHS, PPS, and/or RHS",
    detail:
      "FACT-004 (Agency awarded HHS?), FACT-001 (Agency awarded PPS?), and FACT-007 (Agency awarded RHS?) stay questions until awarded codes are recorded. Empty stays unanswered — never silent N/A.",
  },
  {
    step: "task",
    title: "One drill-log card family on the live quarterly evac keys",
    detail:
      "Three imported .6 parents collapse onto hhs_evac_drills_quarterly / pps_evac_drills_quarterly / rhs_evac_drills_quarterly. Not a second checklist. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Conduct the drill at the site, then upload the log",
    detail:
      "Official workbook completion is UPLOAD of the documented drill log. Due by the last day of the quarter. HIVE does not invent a drill.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload review",
    detail:
      "Submitted logs sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify at quarter-end only",
    detail:
      "Workbook recurrence is quarterly. Due by the last day of the quarter — not the first day of the next quarter. Do not invent hire+N or annual-from-completion.",
  },
] as const;

export function isFourteenthExecutableBatchRuleId(ruleId: string): boolean {
  return (FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isFourteenthExecutableBatchLiveKey(key: string): boolean {
  return (FOURTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function fourteenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function fourteenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
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

export function applyFourteenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = fourteenthBatchFixtureFor(rule.id);
  if (!fixture || !isFourteenthExecutableBatchRuleId(rule.id)) return rule;
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
            fourteenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyFourteenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyFourteenthExecutableBatchOverlay(rule));
}

export function fourteenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isFourteenthExecutableBatchRuleId(rule.id))
    .map((rule) => applyFourteenthExecutableBatchOverlay(rule));
}

export function fourteenthBatchBindingForRule(ruleId: string): FourteenthBatchEngineBinding | null {
  return FOURTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function fourteenthBatchLiveEngineReady(row: FourteenthBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || !isFourteenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push(
      "Parents must stay on the quarterly evac drill-log family — do not invent umbrella REQ-11.3 / REQ-20.3 / REQ-21.3.",
    );
  }
  return { ready: reasons.length === 0, reasons };
}

export function fourteenthBatchAssignmentOpensClock(
  liveKey: FourteenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function fourteenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function fourteenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isFourteenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyFourteenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isFourteenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function fourteenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return FOURTEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as FourteenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function fourteenthBatchOmitsInventedUmbrellasAndOlDayTwins(): boolean {
  const keys = FOURTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = FOURTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("hhs_evac_drills_quarterly") &&
    keys.includes("pps_evac_drills_quarterly") &&
    keys.includes("rhs_evac_drills_quarterly") &&
    !keys.includes("ol_day_tx_license_4plus") &&
    !keys.includes("ol_day_support_cert_3or_fewer") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("fba_bsp") &&
    !rules.includes("REQ-11.3") &&
    !rules.includes("REQ-20.3") &&
    !rules.includes("REQ-21.3") &&
    !rules.includes("REQ-7.5.a") &&
    !rules.includes("REQ-7.5.b") &&
    !rules.includes("REQ-8.5.a") &&
    !rules.includes("REQ-8.5.b") &&
    !rules.includes("REQ-9.6.a") &&
    !rules.includes("REQ-11.7.c")
  );
}
