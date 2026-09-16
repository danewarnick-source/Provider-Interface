/**
 * Eleventh shared-behavior executable batch: FY Google Form annual twins.
 *
 * One card shape — the DSPD fiscal-year Google Form / August 30 /
 * 60-days-after-FY-end annual report. Reuses existing pack keys where they
 * already fit (hhs / dsi / sei / sl annual_outcome). Other service articles
 * share the hhs_annual_outcome family card. Child elements stay on the parent. Do not
 * fork a second checklist. Do not invent umbrella REQ-8.6 / REQ-11.7 /
 * REQ-30.7. Do not invent PN1/PN2 monthly-summary keys — 18.6.c / 19.6.c
 * are FY-form twins only. Do not start Cluster B (SEI/SJD UPI employment).
 * Timing copies the official workbook deadline. Publication stays off until
 * VERIFIED_PUBLICATIONS is filled deliberately.
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

export const ELEVENTH_EXECUTABLE_BATCH_ID = "fy_google_form_annual_twins" as const;

export const ELEVENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "hhs_annual_outcome",
  "dsi_annual_outcome",
  "sei_annual_outcome",
  "sl_annual_outcome",
] as const;

export const ELEVENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-3.7.c",
  "REQ-4.7.c",
  "REQ-5.7.c",
  "REQ-6.5.c",
  "REQ-7.7.c",
  "REQ-8.6.c",
  "REQ-9.7.c",
  "REQ-10.6.c",
  "REQ-11.7.c",
  "REQ-12.5.c",
  "REQ-13.5.c",
  "REQ-14.4.c",
  "REQ-15.5.c",
  "REQ-16.5.c",
  "REQ-17.5.c",
  "REQ-18.6.c",
  "REQ-19.6.c",
  "REQ-20.7.c",
  "REQ-21.6.c",
  "REQ-22.5.c",
  "REQ-23.5.c",
  "REQ-24.5.c",
  "REQ-25.5.c",
  "REQ-26.5.c",
  "REQ-27.6.c",
  "REQ-28.5.c",
  "REQ-29.5.c",
  "REQ-30.7.c",
  "REQ-31.5.c",
  "REQ-32.7.c",
  "REQ-33.6.c",
  "REQ-34.6.c",
  "REQ-35.6.c",
  "REQ-36.5.c",
] as const;

export type EleventhExecutableBatchRuleId = (typeof ELEVENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type EleventhExecutableBatchLiveKey = (typeof ELEVENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type EleventhBatchEngineBinding = {
  ruleId: EleventhExecutableBatchRuleId;
  liveKeys: readonly EleventhExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_fy_google_form";
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
const FAMILY_KEY: EleventhExecutableBatchLiveKey = "hhs_annual_outcome";

const OFFICIAL_FY2025 =
  "(c) Reporting: The Contractor shall create a fiscal year annual report starting fiscal year 2025 (fiscal year 2025 starts July 1, 2024). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include the following:";

const OFFICIAL_FY2025_TRAIL =
  "(c) Reporting: The Contractor shall create a fiscal year annual report starting fiscal year 2025 (fiscal year 2025 starts July 1, 2024). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include the following: :";

const OFFICIAL_DSI =
  "(c) Reporting The Contractor shall create a fiscal year annual report starting fiscal year 2025 (fiscal year 2025 starts July 1, 2024). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include the following::";

const OFFICIAL_SEI =
  "(c) Reporting: The Contractor shall create a fiscal year annual report starting fiscal year 2025 (fiscal year 2025 starts July 1, 2024). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include data reflecting the measure in (b) above.";

const OFFICIAL_SJD =
  "(c) Reporting: The Contractor shall create a fiscal year annual report starting fiscal year 2027 (fiscal year 2027 starts July 1, 2026). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include the measures outlined in (b) above.";

const OFFICIAL_SJP =
  "(c) Reporting: The Contractor shall create a fiscal year annual report starting fiscal year 2027 (fiscal year 2027 starts July 1, 2026). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include the measures outlined (b) above.";

const OFFICIAL_SJR =
  "(c) Reporting: The Contractor shall create a fiscal year annual report starting fiscal year 2027 (fiscal year 2027 starts July 1, 2026). The fiscal year annual report will be submitted via Google Form by August 30th, 60 days after each fiscal year end. The outcome Google Form will be posted on the DSPD webpage. The Contractor shall explain any quality improvement activities they will undertake in response to their evaluation of the measurement data. The fiscal year annual report must include the measures outlined in (2) above.";

const TIMING: TimingAnchor = {
  kind: "none",
  reason:
    "Official workbook deadline: August 30 (60 days after fiscal year end). Trigger: fiscal year end (June 30). Recurrence: annual (fiscal year). Do not invent hire+N or annual-from-completion.",
};

const HANDLING =
  "Submit via the DSPD Google Form, then record the submission in the platform. PI cannot transmit the form. The live annual-outcome card is the handling path.";

type TwinSpec = {
  id: EleventhExecutableBatchRuleId;
  liveKey: EleventhExecutableBatchLiveKey;
  clause: string;
  codes: readonly string[];
  factId: string;
  question: string;
  official: string;
};

const SPECS: readonly TwinSpec[] = [
  { id: "REQ-3.7.c", liveKey: FAMILY_KEY, clause: "SOW §3.7(c)", codes: ["BC1"], factId: "FACT-010", question: "Agency awarded BC1?", official: OFFICIAL_FY2025 },
  { id: "REQ-4.7.c", liveKey: FAMILY_KEY, clause: "SOW §4.7(c)", codes: ["BC2"], factId: "FACT-013", question: "Agency awarded BC2?", official: OFFICIAL_FY2025_TRAIL },
  { id: "REQ-5.7.c", liveKey: FAMILY_KEY, clause: "SOW §5.7(c)", codes: ["BC3"], factId: "FACT-011", question: "Agency awarded BC3?", official: OFFICIAL_FY2025_TRAIL },
  { id: "REQ-6.5.c", liveKey: FAMILY_KEY, clause: "SOW §6.5(c)", codes: ["COM"], factId: "FACT-047", question: "Agency awarded COM?", official: OFFICIAL_FY2025_TRAIL },
  { id: "REQ-7.7.c", liveKey: FAMILY_KEY, clause: "SOW §7.7(c)", codes: ["DSG", "DSP"], factId: "FACT-015", question: "Agency awarded DSG,DSP?", official: OFFICIAL_FY2025_TRAIL },
  { id: "REQ-8.6.c", liveKey: "dsi_annual_outcome", clause: "SOW §8.6(c)", codes: ["DSI"], factId: "FACT-019", question: "Agency awarded DSI?", official: OFFICIAL_DSI },
  { id: "REQ-9.7.c", liveKey: FAMILY_KEY, clause: "SOW §9.7(c)", codes: ["EPR"], factId: "FACT-012", question: "Agency awarded EPR?", official: OFFICIAL_FY2025 },
  { id: "REQ-10.6.c", liveKey: FAMILY_KEY, clause: "SOW §10.6(c)", codes: ["ELS"], factId: "FACT-026", question: "Agency awarded ELS?", official: OFFICIAL_FY2025 },
  { id: "REQ-11.7.c", liveKey: "hhs_annual_outcome", clause: "SOW §11.7(c)", codes: ["HHS"], factId: "FACT-004", question: "Agency awarded HHS?", official: OFFICIAL_FY2025 },
  { id: "REQ-12.5.c", liveKey: FAMILY_KEY, clause: "SOW §12.5(c)", codes: ["HSQ"], factId: "FACT-045", question: "Agency awarded HSQ?", official: OFFICIAL_FY2025 },
  { id: "REQ-13.5.c", liveKey: FAMILY_KEY, clause: "SOW §13.5(c)", codes: ["MTP"], factId: "FACT-031", question: "Agency awarded MTP?", official: OFFICIAL_FY2025 },
  { id: "REQ-14.4.c", liveKey: FAMILY_KEY, clause: "SOW §14.4(c)", codes: ["PAC"], factId: "FACT-042", question: "Agency awarded PAC?", official: OFFICIAL_FY2025 },
  { id: "REQ-15.5.c", liveKey: FAMILY_KEY, clause: "SOW §15.5(c)", codes: ["PBA"], factId: "FACT-005", question: "Agency awarded PBA?", official: OFFICIAL_FY2025_TRAIL },
  { id: "REQ-16.5.c", liveKey: FAMILY_KEY, clause: "SOW §16.5(c)", codes: ["PM1"], factId: "FACT-023", question: "Agency awarded PM1?", official: OFFICIAL_FY2025_TRAIL },
  { id: "REQ-17.5.c", liveKey: FAMILY_KEY, clause: "SOW §17.5(c)", codes: ["PM2"], factId: "FACT-024", question: "Agency awarded PM2?", official: OFFICIAL_FY2025 },
  { id: "REQ-18.6.c", liveKey: FAMILY_KEY, clause: "SOW §18.6(c)", codes: ["PN1"], factId: "FACT-037", question: "Agency awarded PN1?", official: OFFICIAL_FY2025 },
  { id: "REQ-19.6.c", liveKey: FAMILY_KEY, clause: "SOW §19.6(c)", codes: ["PN2"], factId: "FACT-014", question: "Agency awarded PN2?", official: OFFICIAL_FY2025 },
  { id: "REQ-20.7.c", liveKey: FAMILY_KEY, clause: "SOW §20.7(c)", codes: ["PPS"], factId: "FACT-001", question: "Agency awarded PPS?", official: OFFICIAL_FY2025 },
  { id: "REQ-21.6.c", liveKey: FAMILY_KEY, clause: "SOW §21.6(c)", codes: ["RHS"], factId: "FACT-007", question: "Agency awarded RHS?", official: OFFICIAL_FY2025 },
  { id: "REQ-22.5.c", liveKey: FAMILY_KEY, clause: "SOW §22.5(c)", codes: ["RP2"], factId: "FACT-038", question: "Agency awarded RP2?", official: OFFICIAL_FY2025 },
  { id: "REQ-23.5.c", liveKey: FAMILY_KEY, clause: "SOW §23.5(c)", codes: ["RP3"], factId: "FACT-032", question: "Agency awarded RP3?", official: OFFICIAL_FY2025 },
  { id: "REQ-24.5.c", liveKey: FAMILY_KEY, clause: "SOW §24.5(c)", codes: ["RP4"], factId: "FACT-033", question: "Agency awarded RP4?", official: OFFICIAL_FY2025 },
  { id: "REQ-25.5.c", liveKey: FAMILY_KEY, clause: "SOW §25.5(c)", codes: ["RP5"], factId: "FACT-028", question: "Agency awarded RP5?", official: OFFICIAL_FY2025 },
  { id: "REQ-26.5.c", liveKey: FAMILY_KEY, clause: "SOW §26.5(c)", codes: ["RPS"], factId: "FACT-029", question: "Agency awarded RPS?", official: OFFICIAL_FY2025 },
  { id: "REQ-27.6.c", liveKey: FAMILY_KEY, clause: "SOW §27.6(c)", codes: ["SEC"], factId: "FACT-039", question: "Agency awarded SEC?", official: OFFICIAL_FY2025 },
  { id: "REQ-28.5.c", liveKey: FAMILY_KEY, clause: "SOW §28.5(c)", codes: ["SED"], factId: "FACT-030", question: "Agency awarded SED?", official: OFFICIAL_FY2025 },
  { id: "REQ-29.5.c", liveKey: FAMILY_KEY, clause: "SOW §29.5(c)", codes: ["SEE"], factId: "FACT-027", question: "Agency awarded SEE?", official: OFFICIAL_FY2025 },
  { id: "REQ-30.7.c", liveKey: "sei_annual_outcome", clause: "SOW §30.7(c)", codes: ["SEI"], factId: "FACT-008", question: "Agency awarded SEI?", official: OFFICIAL_SEI },
  { id: "REQ-31.5.c", liveKey: "sl_annual_outcome", clause: "SOW §31.5(c)", codes: ["SLH"], factId: "FACT-034", question: "Agency awarded SLH?", official: OFFICIAL_FY2025 },
  { id: "REQ-32.7.c", liveKey: "sl_annual_outcome", clause: "SOW §32.7(c)", codes: ["CMP", "CMS", "SLN"], factId: "FACT-020", question: "Agency awarded CMP,CMS,SLN?", official: OFFICIAL_FY2025 },
  { id: "REQ-33.6.c", liveKey: FAMILY_KEY, clause: "SOW §33.6(c)", codes: ["SJD"], factId: "FACT-002", question: "Agency awarded SJD?", official: OFFICIAL_SJD },
  { id: "REQ-34.6.c", liveKey: FAMILY_KEY, clause: "SOW §34.6(c)", codes: ["SJP"], factId: "FACT-049", question: "Agency awarded SJP?", official: OFFICIAL_SJP },
  { id: "REQ-35.6.c", liveKey: FAMILY_KEY, clause: "SOW §35.6(c)", codes: ["SJR"], factId: "FACT-050", question: "Agency awarded SJR?", official: OFFICIAL_SJR },
  { id: "REQ-36.5.c", liveKey: FAMILY_KEY, clause: "SOW §36.5(c)", codes: ["TFB"], factId: "FACT-040", question: "Agency awarded TFB?", official: OFFICIAL_FY2025 },
];

function tests(prefix: string, codes: readonly string[]): DraftRuleTest[] {
  const label = codes.join("/");
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `Awarded ${label} plus a recorded DSPD Google Form submission that satisfies the official fiscal-year annual report greens the shared parent.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A service code outside this article does not open this twin. A generic attestation is not equivalency. PN1/PN2 twins are FY-form only — not monthly-summary keys.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "All FY Google Form twins share the annual-outcome card family — one My tasks card per live key. Empty awarded codes stay a question. Do not invent hire+N, umbrella REQ-8.6 / REQ-11.7 / REQ-30.7, PN1/PN2 monthly keys, or Cluster B UPI employment.",
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
    title: "Fiscal year annual report via DSPD Google Form",
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

export const ELEVENTH_BATCH_ENGINE_BINDINGS: readonly EleventhBatchEngineBinding[] = SPECS.map(
  (spec) => ({
    ruleId: spec.id,
    liveKeys: [spec.liveKey],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "awarded_fy_google_form",
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

export const ELEVENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record which DSPD codes this contractor is awarded",
    detail:
      "Each twin stays a question until that article's awarded-code fact is recorded. Empty stays unanswered — never silent N/A. PN1/PN2 are FY-form twins only.",
  },
  {
    step: "task",
    title: "One parent card on the live annual-outcome Google Form family",
    detail:
      "Thirty-four service-article twins collapse onto hhs_annual_outcome / dsi_annual_outcome / sei_annual_outcome / sl_annual_outcome. Not a second checklist. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Submit the DSPD Google Form, then record the submission",
    detail:
      "Official workbook completion is EXTERNAL via the DSPD Google Form by August 30. The platform records the submission (UPLOAD). PI cannot transmit the form.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload review",
    detail:
      "Submitted uploads sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the shared parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the official workbook deadline only",
    detail:
      "August 30 — 60 days after fiscal year end (June 30). Annual fiscal-year recurrence. Do not invent hire+N or annual-from-completion.",
  },
] as const;

export function isEleventhExecutableBatchRuleId(ruleId: string): boolean {
  return (ELEVENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isEleventhExecutableBatchLiveKey(key: string): boolean {
  return (ELEVENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function eleventhBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function eleventhBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
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

export function applyEleventhExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = eleventhBatchFixtureFor(rule.id);
  if (!fixture || !isEleventhExecutableBatchRuleId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, eleventhBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applyEleventhExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyEleventhExecutableBatchOverlay(rule));
}

export function eleventhExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isEleventhExecutableBatchRuleId(rule.id))
    .map((rule) => applyEleventhExecutableBatchOverlay(rule));
}

export function eleventhBatchBindingForRule(ruleId: string): EleventhBatchEngineBinding | null {
  return ELEVENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function eleventhBatchLiveEngineReady(row: EleventhBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || !isEleventhExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Twins must stay on the FY Google Form annual-outcome family — do not fork a second checklist.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function eleventhBatchAssignmentOpensClock(
  liveKey: EleventhExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  const codes =
    awardedCodes ??
    sowCatalogEntryByKey(liveKey)?.service_codes ??
    [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function eleventhBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function eleventhBatchParentIsWired(rule: DraftRule): boolean {
  if (!isEleventhExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyEleventhExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isEleventhExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function eleventhBatchSharedLiveKeyParents(liveKey: string): string[] {
  return ELEVENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as EleventhExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function eleventhBatchOmitsInventedMonthlyUpiUmbrellasAndClusterB(): boolean {
  const keys = ELEVENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = ELEVENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("hhs_annual_outcome") &&
    keys.includes("dsi_annual_outcome") &&
    keys.includes("sei_annual_outcome") &&
    keys.includes("sl_annual_outcome") &&
    !keys.includes("fy_google_form_annual") &&
    !keys.includes("sei_monthly_summary_upi") &&
    !keys.includes("sjd_monthly_summary_upi") &&
    !keys.includes("cmp_cms_monthly_summaries") &&
    !keys.includes("sei_employment_data_upi") &&
    !keys.includes("sjd_employment_data_upi") &&
    !keys.includes("sei_employment_strategies_upi") &&
    !keys.includes("hhs_evac_drills_quarterly") &&
    !keys.includes("fba_bsp") &&
    !rules.includes("REQ-8.6") &&
    !rules.includes("REQ-11.7") &&
    !rules.includes("REQ-30.7") &&
    !rules.includes("REQ-1.15.1") &&
    !rules.includes("REQ-3.3.1") &&
    !rules.includes("REQ-30.3.4") &&
    !rules.includes("REQ-33.3.4")
  );
}
