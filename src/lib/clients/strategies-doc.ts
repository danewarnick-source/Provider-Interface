// The support strategies document sent to the support coordinator: what the
// preview shows and the PDF prints. Built from the APPROVED strategies only:
// agency, client, PCSP plan year, support coordinator, date prepared and
// approver; each goal with its supports (text, details, codes, strategy
// bullets); services that need no strategy with the reason; the §1.24(5)
// footer. Pure (no Supabase), node --test.

import { formatDate } from "./dates.ts";
import type { CSTContent } from "./training.functions.ts";
import { UPI_STRATEGY_CODES, strategyNeedText } from "./strategy-rules.ts";
import { groupByGoal, isUploadDoc, strategyView } from "./support-strategies.ts";

export type DocSupport = { support: string; details: string; codes: string[]; bullets: string[] };
export type DocNotNeeded = { goal: string; support: string; codes: string[]; reason: string };

export type StrategiesDoc = {
  title: string;
  provider: string;
  client: string;
  planYear: string;
  coordinator: string;
  prepared: string;
  approved: string;
  goals: { goal: string; supports: DocSupport[] }[];
  notNeeded: DocNotNeeded[];
  /** Why it was approved with supports lacking a strategy, when it was. */
  approvalNote: string | null;
  footer: string[];
};

export type StrategiesDocInput = {
  providerName: string | null;
  clientName: string;
  plan: { start_date: string | null; end_date: string | null } | null;
  coordinatorName: string | null;
  approverName: string | null;
  approvedAt: string | null;
  /** YYYY-MM-DD the document is prepared. */
  preparedOn: string;
  content: CSTContent | null;
};

export const NOT_ON_FILE = "Not on file";
export const NO_STRATEGY_TEXT = "No strategy written yet.";

const or = (v: string | null | undefined) => (v && v.trim() ? v.trim() : NOT_ON_FILE);

/** "Aug 1, 2026 – Jul 31, 2027", or "Not on file". */
export function planYearText(plan: StrategiesDocInput["plan"]): string {
  if (!plan?.start_date && !plan?.end_date) return NOT_ON_FILE;
  return `${formatDate(plan.start_date, undefined, "?")} – ${formatDate(plan.end_date, undefined, "open")}`;
}

/** The document, or null when there is nothing written per support (none, or an uploaded file). */
export function buildStrategiesDoc(input: StrategiesDocInput): StrategiesDoc | null {
  const content = input.content;
  if (!content || isUploadDoc(content) || !content.sections.length) return null;
  const views = content.sections.map(strategyView);
  const needed = views.filter((v) => v.need.kind === "needed");
  const notNeeded = views
    .filter((v) => v.need.kind !== "needed")
    .map((v) => ({
      goal: v.goal,
      support: v.support,
      codes: v.codes,
      reason: strategyNeedText(v.need),
    }));
  const codes = new Set(views.flatMap((v) => v.codes.map((c) => c.toUpperCase())));
  const footer = [
    "Support strategies are written for each service in the Person's PCSP (DHHS91172 SOW §1.24(5)) and are submitted to the Person's Support Coordinator within 30 days of PCSP activation.",
    "ELS, MTP, PBA, Professional Medication Monitoring and Respite need no support strategy; the BSP is the strategy for Behavior Consultation and the Medical Care Plan for Professional Nursing.",
  ];
  if ([...codes].some((c) => UPI_STRATEGY_CODES.has(c))) {
    footer.push(
      "SEI / SJD employment support strategies are also entered in UPI within 2 weeks of a PCSP update (§30.3(6), §33.3(5)).",
    );
  }
  return {
    title: "Support Strategies",
    provider: or(input.providerName),
    client: or(input.clientName),
    planYear: planYearText(input.plan),
    coordinator: or(input.coordinatorName),
    prepared: formatDate(input.preparedOn),
    approved: input.approvedAt
      ? `${formatDate(input.approvedAt)} by ${input.approverName?.trim() || "a team member"}`
      : "Not approved",
    goals: groupByGoal(needed).map((g) => ({
      goal: g.goal || "Not linked to a goal",
      supports: g.items.map((v) => ({
        support: v.support || "Support",
        details: v.details,
        codes: v.codes,
        bullets: v.bullets,
      })),
    })),
    notNeeded,
    approvalNote: content.approval_note?.trim() || null,
    footer,
  };
}

/** "support-strategies-pat-example.pdf". */
export function strategiesFileName(clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `support-strategies-${slug || "client"}.pdf`;
}
