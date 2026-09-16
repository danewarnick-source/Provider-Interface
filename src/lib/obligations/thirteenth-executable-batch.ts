/**
 * Thirteenth shared-behavior executable batch: OL Day Treatment / Day
 * Support twins (REQ-7.5.a, REQ-7.5.b, REQ-8.5.a, REQ-8.5.b, REQ-9.6.a).
 *
 * Reuses unused pack keys ol_day_tx_license_4plus and
 * ol_day_support_cert_3or_fewer. Same standing OL-file shape as wired
 * REQ-21.5 / ol_rhs_license_4plus. Community-based certification reuses
 * ol_day_support_cert_3or_fewer — do not mint a third community-based key.
 * Awarded-code predicates follow the catalog article (DSG/DSP, DSI, EPR).
 * Official catalog clause_text only — do not invent SOW. Do not invent
 * umbrella REQ-1.4.3 / REQ-1.34. Hold out REQ-10.5, grandfather
 * REQ-7.5.c / REQ-8.5.c / REQ-9.6.b, and vague-comply twins REQ-7.3.5 /
 * REQ-8.3.3 / REQ-9.3.5. Do not start Cluster #2 (evac). Publication stays
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

export const THIRTEENTH_EXECUTABLE_BATCH_ID = "ol_day_tx_day_support_twins" as const;

export const THIRTEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "ol_day_tx_license_4plus",
  "ol_day_support_cert_3or_fewer",
] as const;

export const THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-7.5.a",
  "REQ-7.5.b",
  "REQ-8.5.a",
  "REQ-8.5.b",
  "REQ-9.6.a",
] as const;

export type ThirteenthExecutableBatchRuleId = (typeof THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type ThirteenthExecutableBatchLiveKey =
  (typeof THIRTEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type ThirteenthBatchEngineBinding = {
  ruleId: ThirteenthExecutableBatchRuleId;
  liveKeys: readonly ThirteenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_day_tx_day_support";
  evidence: "external_then_upload";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review";
  blocksSoloWhenLapsed: boolean;
  factId: string;
  awardedCodes: readonly string[];
  disposition: "standing";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;
const ROUTES: CompletionRoute[] = ["EXTERNAL", "UPLOAD"];

const OFFICIAL = {
  "REQ-7.5.a":
    "(a) When services are provided solely or partially in a site-based facility, the Contractor shall for each location providing DSG/DSP have and maintain a:",
  "REQ-7.5.b":
    "(b) When services are provided solely in the community, the Contractor shall have and maintain a:",
  "REQ-8.5.a":
    "(a) When services are provided partially in a site-based facility, the Contractor shall for each location providing DSI have and maintain a:",
  "REQ-8.5.b":
    "(b) When services are provided solely in the community, the Contractor shall have and maintain a:",
  "REQ-9.6.a": "(a) The Contractor shall have and maintain a:",
} as const;

const OL_LICENSE_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Once; re-verify on printed renewal/expiry. Live July 1 date is reminder-only. Do not invent hire+N.",
};

const OL_HANDLING = "External OL license plus uploaded confirmation is the handling path.";

type TwinSpec = {
  id: ThirteenthExecutableBatchRuleId;
  liveKey: ThirteenthExecutableBatchLiveKey;
  clause: string;
  title: string;
  codes: readonly string[];
  factId: string;
  question: string;
  official: string;
};

const SPECS: readonly TwinSpec[] = [
  {
    id: "REQ-7.5.a",
    liveKey: "ol_day_tx_license_4plus",
    clause: "SOW §7.5(a)",
    title: "OL Day Treatment / Day Support — site-based DSG/DSP",
    codes: ["DSG", "DSP"],
    factId: "FACT-015",
    question: "Agency awarded DSG,DSP?",
    official: OFFICIAL["REQ-7.5.a"],
  },
  {
    id: "REQ-7.5.b",
    liveKey: "ol_day_support_cert_3or_fewer",
    clause: "SOW §7.5(b)",
    title: "OL Day Treatment / Day Support — community DSG/DSP",
    codes: ["DSG", "DSP"],
    factId: "FACT-015",
    question: "Agency awarded DSG,DSP?",
    official: OFFICIAL["REQ-7.5.b"],
  },
  {
    id: "REQ-8.5.a",
    liveKey: "ol_day_tx_license_4plus",
    clause: "SOW §8.5(a)",
    title: "OL Day Treatment / Day Support — site-based DSI",
    codes: ["DSI"],
    factId: "FACT-019",
    question: "Agency awarded DSI?",
    official: OFFICIAL["REQ-8.5.a"],
  },
  {
    id: "REQ-8.5.b",
    liveKey: "ol_day_support_cert_3or_fewer",
    clause: "SOW §8.5(b)",
    title: "OL Day Treatment / Day Support — community DSI",
    codes: ["DSI"],
    factId: "FACT-019",
    question: "Agency awarded DSI?",
    official: OFFICIAL["REQ-8.5.b"],
  },
  {
    id: "REQ-9.6.a",
    liveKey: "ol_day_tx_license_4plus",
    clause: "SOW §9.6(a)",
    title: "OL Day Treatment / Day Support — EPR",
    codes: ["EPR"],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    official: OFFICIAL["REQ-9.6.a"],
  },
];

function tests(prefix: string, codes: readonly string[]): DraftRuleTest[] {
  const label = codes.join("/");
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `Awarded ${label} plus a current uploaded OL Day Treatment license or Day Support certification satisfies the parent.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A service code outside this article does not open this parent. A generic attestation without the official OL license or certification leaves the parent incomplete.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "Same standing OL-file shape as REQ-21.5 / ol_rhs_license_4plus. Community-based certification reuses ol_day_support_cert_3or_fewer — do not mint a third community-based key. Empty awarded codes stay a question. Do not invent umbrella REQ-1.4.3 / REQ-1.34, grandfather 7.5.c / 8.5.c / 9.6.b, vague-comply 7.3.5 / 8.3.3 / 9.3.5, REQ-10.5, hire+N, or quarterly evac clocks.",
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
    timing: OL_LICENSE_NONE,
    evidence: {
      summary: spec.official,
      routes: ROUTES,
      defaultHandlingLabel: OL_HANDLING,
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

export const THIRTEENTH_BATCH_ENGINE_BINDINGS: readonly ThirteenthBatchEngineBinding[] = SPECS.map(
  (spec) => ({
    ruleId: spec.id,
    liveKeys: [spec.liveKey],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "awarded_day_tx_day_support",
    evidence: "external_then_upload",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    factId: spec.factId,
    awardedCodes: spec.codes,
    disposition: "standing",
    sharesLiveKeyWith: SPECS.filter((row) => row.liveKey === spec.liveKey && row.id !== spec.id).map(
      (row) => row.id,
    ),
  }),
);

export const THIRTEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record whether this contractor is awarded DSG/DSP, DSI, and/or EPR",
    detail:
      "FACT-015 (Agency awarded DSG,DSP?), FACT-019 (Agency awarded DSI?), and FACT-012 (Agency awarded EPR?) stay questions until awarded codes are recorded. Empty stays unanswered — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per unused OL Day Treatment / Day Support live key",
    detail:
      "ol_day_tx_license_4plus and ol_day_support_cert_3or_fewer. Same standing OL-file shape as ol_rhs_license_4plus. Community-based certification reuses the 3-or-fewer key. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Complete in the OL/DLBC portal, then upload",
    detail:
      "Day Treatment license (4+) and Day Support certification (3 or fewer) are EXTERNAL Office of Licensing plus UPLOAD proof. PI cannot transmit to OL.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload review",
    detail:
      "Submitted licenses sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on printed expiry; July 1 is reminder-only",
    detail:
      "Workbook recurrence is continuous / once; re-verify at expiry. Live pack July 1 calendar is a verification reminder. Do not invent hire+N or annual-from-completion.",
  },
] as const;

export function isThirteenthExecutableBatchRuleId(ruleId: string): boolean {
  return (THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isThirteenthExecutableBatchLiveKey(key: string): boolean {
  return (THIRTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function thirteenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function thirteenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
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

export function applyThirteenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = thirteenthBatchFixtureFor(rule.id);
  if (!fixture || !isThirteenthExecutableBatchRuleId(rule.id)) return rule;
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
            thirteenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyThirteenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyThirteenthExecutableBatchOverlay(rule));
}

export function thirteenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isThirteenthExecutableBatchRuleId(rule.id))
    .map((rule) => applyThirteenthExecutableBatchOverlay(rule));
}

export function thirteenthBatchBindingForRule(ruleId: string): ThirteenthBatchEngineBinding | null {
  return THIRTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function thirteenthBatchLiveEngineReady(row: ThirteenthBatchEngineBinding): {
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
    reasons.push("This batch does not invent an in-PI course.");
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
  if (row.liveKeys.length !== 1 || !isThirteenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push(
      "Parents must stay on ol_day_tx_license_4plus or ol_day_support_cert_3or_fewer — do not mint a third community-based key.",
    );
  }
  return { ready: reasons.length === 0, reasons };
}

export function thirteenthBatchAssignmentOpensClock(
  liveKey: ThirteenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function thirteenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function thirteenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isThirteenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyThirteenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isThirteenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function thirteenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return THIRTEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as ThirteenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function thirteenthBatchOmitsHoldoutsUmbrellasEvacAndInventedKeys(): boolean {
  const keys = THIRTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = THIRTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("ol_day_tx_license_4plus") &&
    keys.includes("ol_day_support_cert_3or_fewer") &&
    !keys.includes("ol_community_based_day_support") &&
    !keys.includes("ol_rhs_license_4plus") &&
    !keys.includes("ol_rhs_cert_3or_fewer") &&
    !keys.includes("hhs_evac_drills_quarterly") &&
    !keys.includes("rhs_evac_drills_quarterly") &&
    !keys.includes("pps_evac_drills_quarterly") &&
    !keys.includes("hhs_annual_outcome") &&
    !rules.includes("REQ-7.5.c") &&
    !rules.includes("REQ-8.5.c") &&
    !rules.includes("REQ-9.6.b") &&
    !rules.includes("REQ-7.3.5") &&
    !rules.includes("REQ-8.3.3") &&
    !rules.includes("REQ-9.3.5") &&
    !rules.includes("REQ-10.5") &&
    !rules.includes("REQ-1.4.3") &&
    !rules.includes("REQ-1.34") &&
    !rules.includes("REQ-21.5")
  );
}
