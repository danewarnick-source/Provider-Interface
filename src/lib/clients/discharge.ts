// Pure rules for discharging a client: input checks, the 30-day notice
// warning for agency-started discharges, the 7-day discharge summary clock,
// what a discharge ended (client_discharges.ended_items), and the facts Nectar
// may use to draft a summary. No Supabase — importable by node --test.

import { parseLocalDate, todayYmd } from "./dates.ts";

export const INITIATED_BY = {
  agency: "The agency",
  person: "The client or their guardian",
  dspd: "DSPD",
} as const;
export type InitiatedBy = keyof typeof INITIATED_BY;

/** Days of notice the agency gives before a discharge it starts. */
export const NOTICE_DAYS = 30;
/** Days after the discharge date the summary is due. */
export const SUMMARY_DAYS = 7;

export type DischargeInput = {
  dischargeDate: string;
  reason: string;
  initiatedBy: InitiatedBy | "";
  noticeDate: string;
  summaryText: string;
  summaryConfirmed: boolean;
};

const isYmd = (v: string) => parseLocalDate(v) !== null && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Whole days from `from` to `to` (both YYYY-MM-DD); null when either is blank. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** YYYY-MM-DD `days` after `ymd`. */
export function addDays(ymd: string, days: number): string {
  const d = parseLocalDate(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + days);
  return todayYmd(d);
}

/** Problems that block saving the discharge. */
export function dischargeProblems(input: DischargeInput): string[] {
  const out: string[] = [];
  if (!isYmd(input.dischargeDate)) out.push("Pick a discharge date.");
  if (!input.reason.trim()) out.push("Say why the client is being discharged.");
  if (input.reason.trim().length > 2000) out.push("The reason is too long.");
  if (!(input.initiatedBy in INITIATED_BY)) out.push("Say who started the discharge.");
  if (input.noticeDate) {
    if (!isYmd(input.noticeDate)) out.push("The notice date isn't a real date.");
    else if (isYmd(input.dischargeDate) && input.noticeDate > input.dischargeDate)
      out.push("The notice date can't be after the discharge date.");
  }
  if (input.summaryConfirmed && !input.summaryText.trim())
    out.push("There is no summary to confirm.");
  return out;
}

/**
 * Warning (not a block) when the agency started the discharge with less than
 * 30 days' notice, or with no notice date on file.
 */
export function noticeWarning(input: {
  initiatedBy: string;
  noticeDate: string;
  dischargeDate: string;
}): string | null {
  if (input.initiatedBy !== "agency" || !isYmd(input.dischargeDate)) return null;
  if (!input.noticeDate)
    return `Add the date notice was given. The agency gives ${NOTICE_DAYS} days' notice.`;
  const days = daysBetween(input.noticeDate, input.dischargeDate);
  if (days === null || days >= NOTICE_DAYS) return null;
  return `Notice was given ${days} day${days === 1 ? "" : "s"} before the discharge. The agency gives ${NOTICE_DAYS} days' notice.`;
}

export type SummaryClock = {
  dueOn: string;
  /** Days until due; negative when late. */
  daysLeft: number;
  state: "sent" | "due" | "late";
};

/** The 7-day discharge summary clock for one discharge. */
export function summaryClock(
  d: { discharge_date: string; summary_sent_on: string | null },
  today: string = todayYmd(),
): SummaryClock {
  const dueOn = addDays(d.discharge_date, SUMMARY_DAYS);
  const daysLeft = daysBetween(today, dueOn) ?? 0;
  if (d.summary_sent_on) return { dueOn, daysLeft, state: "sent" };
  return { dueOn, daysLeft, state: daysLeft < 0 ? "late" : "due" };
}

export type EndedItems = {
  authorizations: { id: string; service_code: string; previous_end_date: string | null }[];
  team: { staff_id: string; service_codes: string[] | null }[];
  shifts: { id: string; starts_at: string; staff_id: string | null }[];
};

function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** client_discharges.ended_items, defaulting missing lists to []. */
export function parseEndedItems(json: unknown): EndedItems {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    authorizations: list(o.authorizations),
    team: list(o.team),
    shifts: list(o.shifts),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One plain-English line per kind of thing a discharge ends. */
export function endedLines(items: EndedItems): string[] {
  const codes = [...new Set(items.authorizations.map((a) => a.service_code))].sort();
  return [
    items.authorizations.length
      ? `${plural(items.authorizations.length, "authorization")} ended (${codes.join(", ")})`
      : "No active authorizations",
    items.team.length
      ? `${plural(items.team.length, "team member")} taken off the client`
      : "No team members assigned",
    items.shifts.length
      ? `${plural(items.shifts.length, "future shift")} cancelled`
      : "No future shifts",
  ];
}

export type SummaryFacts = {
  firstName: string;
  admissionDate: string | null;
  dischargeDate: string;
  reason: string;
  initiatedBy: InitiatedBy;
  services: { code: string; start: string | null; end: string | null }[];
  goals: string[];
  notesInLast90Days: number;
};

/** The facts block Nectar drafts from. Only what is on file; nothing else. */
export function summaryFactsText(f: SummaryFacts): string {
  const lines = [
    `Client first name: ${f.firstName || "the client"}`,
    `Start date: ${f.admissionDate ?? "not on file"}`,
    `Discharge date: ${f.dischargeDate}`,
    `Started by: ${INITIATED_BY[f.initiatedBy]}`,
    `Reason: ${f.reason.trim()}`,
    `Services: ${f.services.length ? f.services.map((s) => `${s.code} (${s.start ?? "?"} to ${s.end ?? "open"})`).join("; ") : "none on file"}`,
    `Plan goals: ${f.goals.length ? f.goals.join("; ") : "none on file"}`,
    `Daily notes in the last 90 days: ${f.notesInLast90Days}`,
  ];
  return lines.join("\n");
}

/** The summary text from Nectar's JSON reply ({ "summary": "..." }); "" when unusable. */
export function parseSummaryDraft(content: string): string {
  const clean = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(clean || "{}") as { summary?: unknown };
    return typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  } catch {
    return "";
  }
}
