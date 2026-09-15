/**
 * Tenth shared-behavior executable batch: BC §3/§4/§5 FBA/BSP twins.
 *
 * One liveKey family — fba_bsp — already on the pack (by_design behavior-support
 * module). The SOW restates the same FBA/BSP duties for BC1, BC2, and BC3.
 * Twins share that card. Child elements stay on the parent. Do not fork a
 * second checklist. Timing copies the official workbook deadline or an
 * explicit none — no invented hire+N, annual-from-completion, PN1/PN2,
 * quarterly evac, or annual-outcome keys. Rights-modification twins
 * (REQ-3.4.3 / REQ-4.4.3 / REQ-5.4.3) stay out — they are not FBA/BSP.
 * UPI 1.15 stays on the ninth batch. Publication stays off until
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

export const TENTH_EXECUTABLE_BATCH_ID = "bc_fba_bsp_twins" as const;

export const TENTH_EXECUTABLE_BATCH_LIVE_KEYS = ["fba_bsp"] as const;

export const TENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-3.3.1",
  "REQ-3.3.2",
  "REQ-3.3.3",
  "REQ-3.3.4",
  "REQ-3.3.5",
  "REQ-3.3.6",
  "REQ-3.3.7",
  "REQ-3.3.8",
  "REQ-3.4.1",
  "REQ-3.4.2",
  "REQ-3.4.4",
  "REQ-3.4.5",
  "REQ-3.4.6",
  "REQ-3.4.7",
  "REQ-4.3.1",
  "REQ-4.3.2",
  "REQ-4.3.3",
  "REQ-4.3.4",
  "REQ-4.3.5",
  "REQ-4.3.6",
  "REQ-4.3.7",
  "REQ-4.4.1",
  "REQ-4.4.2",
  "REQ-4.4.4",
  "REQ-4.4.5",
  "REQ-4.4.6",
  "REQ-4.4.7",
  "REQ-5.3.1",
  "REQ-5.3.2",
  "REQ-5.3.3",
  "REQ-5.3.4",
  "REQ-5.3.5",
  "REQ-5.3.6",
  "REQ-5.3.7",
  "REQ-5.3.8",
  "REQ-5.4.1",
  "REQ-5.4.2",
  "REQ-5.4.4",
  "REQ-5.4.5",
  "REQ-5.4.6",
  "REQ-5.4.7",
] as const;

export type TenthExecutableBatchRuleId = (typeof TENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type TenthExecutableBatchLiveKey = (typeof TENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type TenthBatchLiveFactKey = "bc1_awarded" | "bc2_awarded" | "bc3_awarded";

export type TenthBatchTwinKind =
  | "fba_complete"
  | "fba_written"
  | "fba_initial_30"
  | "fba_reeval_30"
  | "fba_submit_14"
  | "fba_maintain"
  | "fba_substantial_60"
  | "fba_revisions_30"
  | "bsp_development"
  | "bsp_monthly"
  | "bsp_complete_30"
  | "bsp_reeval_30"
  | "bsp_submit_14"
  | "bsp_maintain";

export type TenthBatchEngineBinding = {
  ruleId: TenthExecutableBatchRuleId;
  liveKeys: readonly TenthExecutableBatchLiveKey[];
  twinKind: TenthBatchTwinKind;
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_bc_fba_bsp";
  evidence: "in_platform_record" | "upload_file" | "system_check";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review" | "upload_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: TenthBatchLiveFactKey;
  disposition: "by_design";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;
const LIVE_KEY: TenthExecutableBatchLiveKey = "fba_bsp";

const FACT_BY_CODE = {
  BC1: { liveFactKey: "bc1_awarded", factId: "FACT-010", question: "Agency awarded BC1?" },
  BC2: { liveFactKey: "bc2_awarded", factId: "FACT-013", question: "Agency awarded BC2?" },
  BC3: { liveFactKey: "bc3_awarded", factId: "FACT-011", question: "Agency awarded BC3?" },
} as const;

type BcCode = keyof typeof FACT_BY_CODE;

function tests(prefix: string, rows: Array<[DraftRuleTest["kind"], string]>): DraftRuleTest[] {
  return rows.map(([kind, assert], i) => ({
    id: `${prefix}-t${i + 1}`,
    kind,
    assert,
  }));
}

function noneTiming(reason: string): TimingAnchor {
  return { kind: "none", reason };
}

const TIMING = {
  approval: noneTiming(
    "Official workbook trigger: DSPD approval to provide BC service. Standing fba_bsp file — keep current. Do not invent hire+N.",
  ),
  missing: noneTiming(
    "Timing is missing-information. Standing fba_bsp file — keep current. Do not invent hire+N or annual-from-completion.",
  ),
  initial30: (code: BcCode) =>
    noneTiming(
      `Official workbook deadline: 30 Calendar Days of DSPD approval to provide ${code} services. Do not invent hire+N.`,
    ),
  fbaReeval: noneTiming(
    "Official workbook deadline: 30 Calendar Days of written request from the Person's Support Coordinator, PCPT, or quarterly-summary indication. Do not invent hire+N.",
  ),
  submit14: noneTiming(
    "Official workbook deadline: 14 Calendar Days of completion. Do not invent hire+N.",
  ),
  substantial60: noneTiming(
    "Official workbook deadline: 60 Calendar Days after the start of the initial FBA (substantial life change). Do not invent hire+N.",
  ),
  revisions30: noneTiming(
    "Official workbook deadline: 30 Calendar Days of the change. Do not invent hire+N.",
  ),
  monthly: noneTiming(
    "Official workbook clause: reevaluate the BSP each month. Monthly anchor is missing-information. Do not invent hire+N or annual-from-completion.",
  ),
  bsp30: noneTiming(
    "Official workbook deadline: 30 Calendar Days of FBA completion. Do not invent hire+N.",
  ),
  bspReeval: noneTiming(
    "Official workbook deadline: 30 Calendar Days / 30 days of written request from the Person's Support Coordinator, PCPT, or quarterly-summary indication. Do not invent hire+N.",
  ),
  bspSubmit14: noneTiming(
    "Official workbook deadline: 14 Calendar Days of BSP completion. Do not invent hire+N.",
  ),
} as const;

const PREDICATE: DraftPredicate = { kind: "awarded_service_codes", catalogKey: LIVE_KEY };

type TwinSpec = {
  id: TenthExecutableBatchRuleId;
  code: BcCode;
  twinKind: TenthBatchTwinKind;
  clause: string;
  title: string;
  official: string;
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
};

const SPECS: readonly TwinSpec[] = [
  {
    id: "REQ-3.3.1",
    code: "BC1",
    twinKind: "fba_complete",
    clause: "SOW §3.3(1)",
    title: "Complete an FBA of the Person's target behavior",
    official:
      "complete an FBA of the Person's target behavior. The Contractor shall use validated assessment tools and processes to complete the FBA, based on the Person's needs.",
    timing: TIMING.approval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.3.2",
    code: "BC1",
    twinKind: "fba_written",
    clause: "SOW §3.3(2)",
    title: "Provide a written FBA that includes",
    official: "provide a written FBA that includes:",
    timing: TIMING.missing,
    routes: ["SYSTEM"],
    handling: "Written-FBA checklist fields stay on the parent fba_bsp card — not a second clock.",
  },
  {
    id: "REQ-3.3.3",
    code: "BC1",
    twinKind: "fba_initial_30",
    clause: "SOW §3.3(3)",
    title: "Complete the initial FBA prior to developing the BSP",
    official:
      "complete the initial FBA prior to developing the BSP, and within 30 Calendar Days of DSPD approval to provide BC1 services.",
    timing: TIMING.initial30("BC1"),
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.3.4",
    code: "BC1",
    twinKind: "fba_reeval_30",
    clause: "SOW §3.3(4)",
    title: "Reevaluate and update the Person's FBA",
    official:
      "complete a reevaluation and update the Person's FBA within 30 Calendar Days of written request from the Person's Support Coordinator, when the PCPT determines it is necessary, or as indicated by the Contractor's quarterly summary.",
    timing: TIMING.fbaReeval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.3.5",
    code: "BC1",
    twinKind: "fba_submit_14",
    clause: "SOW §3.3(5)",
    title: "Submit completed FBAs to the Person's Support Coordinator",
    official:
      "submit completed FBAs to the Person's Support Coordinator within 14 Calendar Days of completion.",
    timing: TIMING.submit14,
    routes: ["UPLOAD"],
    handling: "Uploaded proof that the completed FBA was sent to the Support Coordinator is the handling path.",
  },
  {
    id: "REQ-3.3.6",
    code: "BC1",
    twinKind: "fba_maintain",
    clause: "SOW §3.3(6)",
    title: "Maintain the FBA in the Person's file",
    official: "maintain the FBA in the Person's file.",
    timing: TIMING.missing,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp Person file is the handling path.",
  },
  {
    id: "REQ-3.3.7",
    code: "BC1",
    twinKind: "fba_substantial_60",
    clause: "SOW §3.3(7)",
    title: "Complete an initial FBA after a substantial life change",
    official:
      "complete an initial FBA for a Person who has had a substantial life change addressing all safety issues while baseline data is being gathered. The Contractor shall complete the full FBA within 60 Calendar Days after the start of the initial FBA.",
    timing: TIMING.substantial60,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.3.8",
    code: "BC1",
    twinKind: "fba_revisions_30",
    clause: "SOW §3.3(8)",
    title: "Complete revisions to the FBA within 30 Calendar Days of the change",
    official: "complete revisions to the FBA, if updates are needed, within 30 Calendar Days of the change.",
    timing: TIMING.revisions30,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.4.1",
    code: "BC1",
    twinKind: "bsp_development",
    clause: "SOW §3.4(1)",
    title: "BSP development, implementation, and training",
    official:
      "be responsible for BSP development, implementation, and training. The BSP must emphasize a positive approach with treatment designed to effectively acquire and maintain adaptive behaviors and prevent problem behaviors. The BSP must be in writing and include:",
    timing: TIMING.missing,
    routes: ["SYSTEM"],
    handling: "BSP content fields stay on the parent fba_bsp card — not a second clock.",
  },
  {
    id: "REQ-3.4.2",
    code: "BC1",
    twinKind: "bsp_monthly",
    clause: "SOW §3.4(2)",
    title: "Reevaluate the BSP each month",
    official:
      "reevaluate the BSP each month to analyze the effectiveness of the interventions, and reassess or adjust the BSP as needed.",
    timing: TIMING.monthly,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.4.4",
    code: "BC1",
    twinKind: "bsp_complete_30",
    clause: "SOW §3.4(4)",
    title: "Complete the BSP within 30 Calendar Days of FBA completion",
    official:
      "complete the BSP within 30 Calendar Days of FBA completion. If the FBA is completed when a Person has had a substantial life change, and baseline data is being gathered, the Contractor may complete an initial BSP addressing all safety issues. The Contractor shall complete a full BSP within 60 Calendar Days after the initial FBA. If updates are needed, the Contractor shall complete FBA revisions within 30 Calendar Days of the Person's substantial life change.",
    timing: TIMING.bsp30,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.4.5",
    code: "BC1",
    twinKind: "bsp_reeval_30",
    clause: "SOW §3.4(5)",
    title: "Reevaluate and update the Person's BSP",
    official:
      "complete a reevaluation and update to the Person's BSP within 30 Calendar Days of written request from the Person's Support Coordinator, PCPT, or as indicated by the Contractor's quarterly summary.",
    timing: TIMING.bspReeval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-3.4.6",
    code: "BC1",
    twinKind: "bsp_submit_14",
    clause: "SOW §3.4(6)",
    title: "Submit the completed BSP within 14 Calendar Days",
    official:
      "submit the completed BSP to the Person's Support Coordinator, family, Staff, or any other individual involved in the implementation of the BSP within 14 Calendar Days of completion. The Contractor shall provide consultation and training on implementation of the BSP to the Person's family, Staff and any other individual involved in the implementation of the BSP.",
    timing: TIMING.bspSubmit14,
    routes: ["UPLOAD"],
    handling: "Uploaded proof that the completed BSP was sent is the handling path.",
  },
  {
    id: "REQ-3.4.7",
    code: "BC1",
    twinKind: "bsp_maintain",
    clause: "SOW §3.4(7)",
    title: "Maintain the BSP in the Person's file",
    official: "maintain the BSP in the Person's file.",
    timing: TIMING.missing,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp Person file is the handling path.",
  },
  {
    id: "REQ-4.3.1",
    code: "BC2",
    twinKind: "fba_complete",
    clause: "SOW §4.3(1)",
    title: "Complete a FBA of the Person's target behavior",
    official:
      "complete a FBA of the Person's target behavior. The Contractor shall use validated assessment tools and processes to complete the FBA, based on the Person's needs.",
    timing: TIMING.approval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.3.2",
    code: "BC2",
    twinKind: "fba_written",
    clause: "SOW §4.3(2)",
    title: "Provide a written FBA that includes",
    official: "provide a written FBA that includes:",
    timing: TIMING.missing,
    routes: ["SYSTEM"],
    handling: "Written-FBA checklist fields stay on the parent fba_bsp card — not a second clock.",
  },
  {
    id: "REQ-4.3.3",
    code: "BC2",
    twinKind: "fba_initial_30",
    clause: "SOW §4.3(3)",
    title: "Complete the initial FBA prior to developing the BSP",
    official:
      "complete the initial FBA prior to developing the BSP, and within 30 Calendar Days of DSPD approval to provide BC2 services.",
    timing: TIMING.initial30("BC2"),
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.3.4",
    code: "BC2",
    twinKind: "fba_reeval_30",
    clause: "SOW §4.3(4)",
    title: "Reevaluate and update the Person's FBA",
    official:
      "complete a reevaluation and update to the Person's FBA within 30 Calendar Days of written request from the Person's Support Coordinator, PCPT, or as indicated by the Contractor's quarterly summary.",
    timing: TIMING.fbaReeval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.3.5",
    code: "BC2",
    twinKind: "fba_submit_14",
    clause: "SOW §4.3(5)",
    title: "Submit completed FBAs to the Person's Support Coordinator",
    official:
      "submit completed FBAs to the Person's Support Coordinator within 14 Calendar Days of completion.",
    timing: TIMING.submit14,
    routes: ["UPLOAD"],
    handling: "Uploaded proof that the completed FBA was sent to the Support Coordinator is the handling path.",
  },
  {
    id: "REQ-4.3.6",
    code: "BC2",
    twinKind: "fba_substantial_60",
    clause: "SOW §4.3(6)",
    title: "Complete an initial FBA after a substantial life change",
    official:
      "complete an initial FBA for a Person who has had a substantial life change addressing all safety issues while baseline data is being gathered. The Contractor shall complete the full FBA within 60 Calendar Days after the start of the initial FBA.",
    timing: TIMING.substantial60,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.3.7",
    code: "BC2",
    twinKind: "fba_revisions_30",
    clause: "SOW §4.3(7)",
    title: "Complete revisions to the FBA within 30 Calendar Days of the change",
    official: "complete revisions to the FBA, if updates are needed, within 30 Calendar Days of the change.",
    timing: TIMING.revisions30,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.4.1",
    code: "BC2",
    twinKind: "bsp_development",
    clause: "SOW §4.4(1)",
    title: "Development, implementation, and training of the BSP",
    official:
      "be responsible for the development, implementation, and training of the BSP. The BSP must emphasize a positive approach with treatment designed to effectively acquire and maintain adaptive behaviors and prevent problem behaviors. The BSP must be in writing and include:",
    timing: TIMING.missing,
    routes: ["SYSTEM"],
    handling: "BSP content fields stay on the parent fba_bsp card — not a second clock.",
  },
  {
    id: "REQ-4.4.2",
    code: "BC2",
    twinKind: "bsp_monthly",
    clause: "SOW §4.4(2)",
    title: "Reevaluate the BSP each month",
    official:
      "reevaluate the BSP each month to analyze the effectiveness of the interventions, and reassess or adjust the BSP as needed.",
    timing: TIMING.monthly,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.4.4",
    code: "BC2",
    twinKind: "bsp_complete_30",
    clause: "SOW §4.4(4)",
    title: "Complete the BSP within 30 Calendar Days of FBA completion",
    official:
      "complete the BSP within 30 Calendar Days of FBA completion. If the FBA is completed when a Person has had a substantial life change, and baseline data is being gathered, the Contractor may complete an initial BSP addressing all safety issues. The Contractor shall complete a full BSP within 60 Calendar Days after the initial FBA. If updates are needed, the Contractor shall complete FBA revisions within 30 Calendar Days of the Person's substantial life change.",
    timing: TIMING.bsp30,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.4.5",
    code: "BC2",
    twinKind: "bsp_reeval_30",
    clause: "SOW §4.4(5)",
    title: "Reevaluate and update the Person's BSP",
    official:
      "complete a reevaluation and update to the Person's BSP within 30 days of written request from the Person's Support Coordinator, PCPT, or as indicated by the Contractor's quarterly summary.",
    timing: TIMING.bspReeval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-4.4.6",
    code: "BC2",
    twinKind: "bsp_submit_14",
    clause: "SOW §4.4(6)",
    title: "Submit the completed BSP within 14 Calendar Days",
    official:
      "submit the completed BSP to the Person's Support Coordinator, family, Staff, or any other individual involved in the implementation of the BSP within 14 Calendar Days of completion. The Contractor shall provide consultation and training on implementation of the BSP to the Person's family, Staff and any other individual involved in the implementation of the BSP.",
    timing: TIMING.bspSubmit14,
    routes: ["UPLOAD"],
    handling: "Uploaded proof that the completed BSP was sent is the handling path.",
  },
  {
    id: "REQ-4.4.7",
    code: "BC2",
    twinKind: "bsp_maintain",
    clause: "SOW §4.4(7)",
    title: "Maintain the BSP in the Person's file",
    official: "maintain the BSP in the Person's file.",
    timing: TIMING.missing,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp Person file is the handling path.",
  },
  {
    id: "REQ-5.3.1",
    code: "BC3",
    twinKind: "fba_complete",
    clause: "SOW §5.3(1)",
    title: "Complete a FBA of the Person's target behavior",
    official:
      "complete a FBA of the Person's target behavior. The Contractor shall use validated assessment tools and processes to complete the FBA, based on the Person's needs.",
    timing: TIMING.approval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.3.2",
    code: "BC3",
    twinKind: "fba_written",
    clause: "SOW §5.3(2)",
    title: "Provide a written FBA that includes",
    official: "provide a written FBA that includes:",
    timing: TIMING.missing,
    routes: ["SYSTEM"],
    handling: "Written-FBA checklist fields stay on the parent fba_bsp card — not a second clock.",
  },
  {
    id: "REQ-5.3.3",
    code: "BC3",
    twinKind: "fba_initial_30",
    clause: "SOW §5.3(3)",
    title: "Complete the initial FBA prior to developing the BSP",
    official:
      "complete the initial FBA prior to developing the BSP, and within 30 Calendar Days of DSPD approval to provide BC3 services.",
    timing: TIMING.initial30("BC3"),
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.3.4",
    code: "BC3",
    twinKind: "fba_reeval_30",
    clause: "SOW §5.3(4)",
    title: "Reevaluate and update the Person's FBA",
    official:
      "complete a reevaluation and update to the Person's FBA within 30 Calendar Days of written request from the Person's Support Coordinator, PCPT, or as indicated by the Contractor's quarterly summary.",
    timing: TIMING.fbaReeval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.3.5",
    code: "BC3",
    twinKind: "fba_submit_14",
    clause: "SOW §5.3(5)",
    title: "Submit completed FBAs to the Person's Support Coordinator",
    official:
      "submit completed FBAs to the Person's Support Coordinator within 14 Calendar Days of completion.",
    timing: TIMING.submit14,
    routes: ["UPLOAD"],
    handling: "Uploaded proof that the completed FBA was sent to the Support Coordinator is the handling path.",
  },
  {
    id: "REQ-5.3.6",
    code: "BC3",
    twinKind: "fba_maintain",
    clause: "SOW §5.3(6)",
    title: "Maintain the FBA in the Person's file",
    official: "maintain the FBA in the Person's file.",
    timing: TIMING.missing,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp Person file is the handling path.",
  },
  {
    id: "REQ-5.3.7",
    code: "BC3",
    twinKind: "fba_substantial_60",
    clause: "SOW §5.3(7)",
    title: "Complete an initial FBA after a substantial life change",
    official:
      "complete an initial FBA for a Person who has had a substantial life change addressing all safety issues while baseline data is being gathered. The Contractor shall complete the full FBA within 60 Calendar Days after the start of the initial FBA.",
    timing: TIMING.substantial60,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.3.8",
    code: "BC3",
    twinKind: "fba_revisions_30",
    clause: "SOW §5.3(8)",
    title: "Complete revisions to the FBA within 30 Calendar Days of the change",
    official: "complete revisions to the FBA, if updates are needed, within 30 Calendar Days of the change.",
    timing: TIMING.revisions30,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.4.1",
    code: "BC3",
    twinKind: "bsp_development",
    clause: "SOW §5.4(1)",
    title: "Development, implementation, and training of the BSP",
    official:
      "be responsible for the development, implementation, and training of the BSP. The BSP must emphasize a positive approach with treatment designed to effectively acquire and maintain adaptive behaviors and prevent problem behaviors. The BSP must be in writing and include:",
    timing: TIMING.missing,
    routes: ["SYSTEM"],
    handling: "BSP content fields stay on the parent fba_bsp card — not a second clock.",
  },
  {
    id: "REQ-5.4.2",
    code: "BC3",
    twinKind: "bsp_monthly",
    clause: "SOW §5.4(2)",
    title: "Reevaluate the BSP each month",
    official:
      "reevaluate the BSP each month to analyze the effectiveness of the interventions, and reassess or adjust the BSP as needed.",
    timing: TIMING.monthly,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.4.4",
    code: "BC3",
    twinKind: "bsp_complete_30",
    clause: "SOW §5.4(4)",
    title: "Complete the BSP within 30 Calendar Days of FBA completion",
    official:
      "complete the BSP within 30 Calendar Days of FBA completion. If the FBA is completed when a Person has had a substantial life change, and baseline data is being gathered, the Contractor may complete an initial BSP addressing all safety issues. The Contractor shall complete a full BSP within 60 Calendar Days after the initial FBA. If updates are needed, the Contractor shall complete FBA revisions within 30 Calendar Days of the Person's substantial life change.",
    timing: TIMING.bsp30,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.4.5",
    code: "BC3",
    twinKind: "bsp_reeval_30",
    clause: "SOW §5.4(5)",
    title: "Reevaluate and update the Person's BSP",
    official:
      "complete a reevaluation and update to the Person's BSP within 30 days of written request from the Person's Support Coordinator, PCPT, or as indicated by the Contractor's quarterly summary.",
    timing: TIMING.bspReeval,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp behavior-support module is the handling path.",
  },
  {
    id: "REQ-5.4.6",
    code: "BC3",
    twinKind: "bsp_submit_14",
    clause: "SOW §5.4(6)",
    title: "Submit the completed BSP within 14 Calendar Days",
    official:
      "submit the completed BSP to the Person's Support Coordinator, family, Staff, or any other individual involved in the implementation of the BSP within 14 Calendar Days of completion. The Contractor shall provide consultation and training on implementation of the BSP to the Person's family, Staff and any other individual involved in the implementation of the BSP.",
    timing: TIMING.bspSubmit14,
    routes: ["UPLOAD"],
    handling: "Uploaded proof that the completed BSP was sent is the handling path.",
  },
  {
    id: "REQ-5.4.7",
    code: "BC3",
    twinKind: "bsp_maintain",
    clause: "SOW §5.4(7)",
    title: "Maintain the BSP in the Person's file",
    official: "maintain the BSP in the Person's file.",
    timing: TIMING.missing,
    routes: ["IN_PLATFORM"],
    handling: "The live fba_bsp Person file is the handling path.",
  },
];

function fileRule(spec: TwinSpec): DraftRule {
  return {
    id: spec.id,
    version: 1,
    title: spec.title,
    catalogKeys: [LIVE_KEY],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource([spec.clause]),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: [PREDICATE],
    group: {
      logic: "ALL",
      parentAssignment: "one",
      members: [
        {
          id: `${spec.id}-file`,
          label: spec.official,
          sourceClauseId: spec.clause,
          catalogKey: LIVE_KEY,
          completionRoutes: spec.routes,
        },
      ],
    },
    timing: spec.timing,
    evidence: {
      summary: spec.official,
      routes: spec.routes,
      defaultHandlingLabel: spec.handling,
      automaticEquivalency: NO_EQUIV,
    },
    completionRoutes: spec.routes,
    tests: tests(spec.id, [
      [
        "positive",
        `Awarded ${spec.code} plus a current fba_bsp file that satisfies "${spec.official}" greens the shared parent.`,
      ],
      [
        "negative",
        "HHS/SEI-only awarded codes do not open the fba_bsp card. A generic attestation is not equivalency.",
      ],
      [
        "boundary",
        "All FBA/BSP twins share fba_bsp — one My tasks card. Empty awarded codes stay a question. Do not invent hire+N, fork a second checklist, absorb UPI 1.15, or wire REQ-3.4.3 / REQ-4.4.3 / REQ-5.4.3.",
      ],
    ]),
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

function evidenceKind(routes: readonly CompletionRoute[]): TenthBatchEngineBinding["evidence"] {
  if (routes.includes("SYSTEM")) return "system_check";
  if (routes.includes("UPLOAD")) return "upload_file";
  return "in_platform_record";
}

export const TENTH_BATCH_ENGINE_BINDINGS: readonly TenthBatchEngineBinding[] = SPECS.map((spec) => {
  const evidence = evidenceKind(spec.routes);
  return {
    ruleId: spec.id,
    liveKeys: [LIVE_KEY],
    twinKind: spec.twinKind,
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "awarded_bc_fba_bsp",
    evidence,
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: evidence === "upload_file" ? "upload_review" : "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: FACT_BY_CODE[spec.code].liveFactKey,
    disposition: "by_design",
    sharesLiveKeyWith: TENTH_EXECUTABLE_BATCH_RULE_IDS.filter((id) => id !== spec.id),
  };
});

export const TENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record which BC codes this contractor is awarded",
    detail:
      "FACT-010 (BC1), FACT-013 (BC2), and FACT-011 (BC3) stay questions until awarded codes are recorded. Empty stays unanswered — never silent N/A. Rights-modification twins stay off this card.",
  },
  {
    step: "task",
    title: "One parent card on the live fba_bsp module",
    detail:
      "Forty-one BC1/BC2/BC3 FBA/BSP twins collapse onto fba_bsp. Not a second checklist. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Behavior-support module, then upload only when the workbook says submit",
    detail:
      "FBA/BSP file work is IN_PLATFORM on the live module. Written-FBA includes and BSP content lists are SYSTEM fields on that parent. Submit-to-Support-Coordinator parents are UPLOAD.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing record/upload review",
    detail:
      "Submitted uploads sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the shared parent. Soft=none — this batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the official workbook trigger only",
    detail:
      "30 Calendar Days from BC approval / FBA completion / written request / the change. 14 Calendar Days from FBA or BSP completion. 60 Calendar Days after the start of the initial FBA. Monthly BSP reevaluation keeps current — do not invent a calendar-period anchor. Standing files are keep-current.",
  },
] as const;

export function isTenthExecutableBatchRuleId(ruleId: string): boolean {
  return (TENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isTenthExecutableBatchLiveKey(key: string): boolean {
  return (TENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function tenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function liveFactIdForTenthBatchKey(factKey: TenthBatchLiveFactKey): string {
  if (factKey === "bc1_awarded") return "FACT-010";
  if (factKey === "bc2_awarded") return "FACT-013";
  return "FACT-011";
}

const LIVE_FACT_QUESTIONS: Record<TenthBatchLiveFactKey, string> = {
  bc1_awarded: "Agency awarded BC1?",
  bc2_awarded: "Agency awarded BC2?",
  bc3_awarded: "Agency awarded BC3?",
};

export function tenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const row = TENTH_BATCH_ENGINE_BINDINGS.find((bindingRow) => bindingRow.ruleId === ruleId);
  if (!row) return [];
  return [
    {
      fact_id: liveFactIdForTenthBatchKey(row.liveFactKey),
      question: LIVE_FACT_QUESTIONS[row.liveFactKey],
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

export function applyTenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = tenthBatchFixtureFor(rule.id);
  if (!fixture || !isTenthExecutableBatchRuleId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, tenthBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applyTenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyTenthExecutableBatchOverlay(rule));
}

export function tenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isTenthExecutableBatchRuleId(rule.id))
    .map((rule) => applyTenthExecutableBatchOverlay(rule));
}

export function tenthBatchBindingForRule(ruleId: string): TenthBatchEngineBinding | null {
  return TENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function tenthBatchLiveEngineReady(row: TenthBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || row.liveKeys[0] !== LIVE_KEY) {
    reasons.push("Twins must share fba_bsp — do not fork a second checklist.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function tenthBatchAssignmentOpensClock(
  _liveKey: TenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
): boolean {
  const entry = sowCatalogEntryByKey(LIVE_KEY);
  return (
    awardedCodeDutyStatus(entry?.service_codes ?? ["BC1", "BC2", "BC3"], orgFacts?.servicesOffered ?? []) ===
    "applies"
  );
}

export function tenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function tenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isTenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyTenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isTenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function tenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return TENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as TenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function tenthBatchOmitsInventedQuarterlyOutcomesUpiAndRightsMod(): boolean {
  const keys = TENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = TENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.length === 1 &&
    keys[0] === "fba_bsp" &&
    !keys.includes("human_rights_plan") &&
    !keys.includes("usteps_upi_accounts") &&
    !keys.includes("hhs_evac_drills_quarterly") &&
    !keys.includes("rhs_evac_drills_quarterly") &&
    !keys.includes("pps_evac_drills_quarterly") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("dsi_annual_outcome") &&
    !keys.includes("sei_annual_outcome") &&
    !keys.includes("sl_annual_outcome") &&
    !rules.includes("REQ-1.15.1") &&
    !rules.includes("REQ-1.4.2") &&
    !rules.includes("REQ-1.24.5") &&
    !rules.includes("REQ-3.4.3") &&
    !rules.includes("REQ-4.4.3") &&
    !rules.includes("REQ-5.4.3") &&
    !rules.includes("REQ-3.6") &&
    !rules.includes("REQ-4.6") &&
    !rules.includes("REQ-5.6")
  );
}
