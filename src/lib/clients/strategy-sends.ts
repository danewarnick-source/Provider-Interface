// Support strategies sent to the support coordinator (SOW §1.24(5)): due 30
// days after the current PCSP's activation date, and again for each new
// PCSP. The ONE rule every screen reads (strategies card, Overview, Needs
// attention, the Client file and the Evidence grid): a send belongs to a
// plan, so a new plan year starts with none and older plans keep theirs.
// Approved Nectar strategies or an approved uploaded document can be sent.
// Clients set up before sends were recorded count as sent when an accepted
// "Support Strategies" Evidence file is on record and no send exists.
// Pure (no Supabase), node --test.

import { formatDate } from "./dates.ts";
import { STRATEGIES_DUE_DAYS, addDaysYmd } from "./plan-dates.ts";
import type { EvidenceMatrixChip } from "../evidence/status.ts";
import { daysBetweenIso, dueChipLabel, isEvidenceSkipped, matrixChip } from "../evidence/status.ts";
import type { EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";

/** Days after activation that the reminder starts. */
export const STRATEGIES_REMIND_DAYS = 25;

/** A live (not voided) send of one plan's strategies. */
export type StrategySend = {
  id: string;
  planId: string;
  sentOn: string;
  sentTo: string | null;
  /** Who recorded it (name). */
  by: string | null;
};

/** An accepted "Support Strategies" Evidence file from before sends were recorded. */
export type LegacyStrategyFile = { on: string; by: string | null };

export type StrategySendInput = {
  /** The client's codes need support strategies (strategy-rules.ts). */
  needed: boolean;
  /** The current plan year, if any. */
  plan: { id: string; activated_on: string | null } | null;
  /** Strategies (written or an uploaded document) are approved for this plan. */
  approved: boolean;
  /** Live sends for the client, any plan. */
  sends: readonly StrategySend[];
  legacyFile: LegacyStrategyFile | null;
  /** YYYY-MM-DD. */
  today: string;
};

type Due = { dueOn: string; dueSoon: boolean; overdue: boolean };

export type StrategySendState =
  | { kind: "not_needed" }
  | { kind: "no_activation"; hasPlan: boolean }
  | ({ kind: "not_approved" } & Due)
  | ({ kind: "not_sent" } & Due)
  | {
      kind: "sent";
      sendId: string | null;
      sentOn: string;
      sentTo: string | null;
      by: string | null;
      late: boolean;
    };

/** Due 30 days after activation; reminded from day 25; overdue after day 30. */
function dueFor(activatedOn: string, today: string): Due {
  const dueOn = addDaysYmd(activatedOn, STRATEGIES_DUE_DAYS)!;
  const remindOn = addDaysYmd(activatedOn, STRATEGIES_REMIND_DAYS)!;
  const overdue = today > dueOn;
  return { dueOn, overdue, dueSoon: !overdue && today >= remindOn };
}

/** Approved for this plan: published, and approved after the plan was added. */
export function strategiesApprovedFor(
  training: { status: string | null; approved_at: string | null } | null,
  plan: { created_at?: string | null } | null,
): boolean {
  if (!training || training.status !== "published" || !training.approved_at) return false;
  return !(plan?.created_at && plan.created_at > training.approved_at);
}

export function strategySendState(input: StrategySendInput): StrategySendState {
  if (!input.needed) return { kind: "not_needed" };
  const { plan, today } = input;
  const activated = plan?.activated_on?.slice(0, 10) || null;
  const send = plan ? input.sends.find((s) => s.planId === plan.id) : undefined;
  if (send) {
    const dueOn = activated ? addDaysYmd(activated, STRATEGIES_DUE_DAYS) : null;
    return {
      kind: "sent",
      sendId: send.id,
      sentOn: send.sentOn,
      sentTo: send.sentTo,
      by: send.by,
      late: !!dueOn && send.sentOn > dueOn,
    };
  }
  if (!input.sends.length && input.legacyFile) {
    const f = input.legacyFile;
    return { kind: "sent", sendId: null, sentOn: f.on, sentTo: null, by: f.by, late: false };
  }
  if (!plan || !activated) return { kind: "no_activation", hasPlan: !!plan };
  const due = dueFor(activated, today);
  return input.approved ? { kind: "not_sent", ...due } : { kind: "not_approved", ...due };
}

/** "Sent to Angela Duty · Oct 8, 2026 · Dane Warnick". */
export function sentLine(s: Extract<StrategySendState, { kind: "sent" }>): string {
  return [
    `Sent to ${s.sentTo?.trim() || "the support coordinator"}`,
    formatDate(s.sentOn),
    ...(s.by ? [s.by] : []),
  ].join(" · ");
}

/** The status in a few words (strategies card, File row). */
export function sendStateText(s: StrategySendState): string {
  switch (s.kind) {
    case "not_needed":
      return "Not needed for this client's codes";
    case "no_activation":
      return s.hasPlan ? "Add the PCSP activation date" : "Upload the PCSP first";
    case "not_approved":
      return `Not approved yet · due ${formatDate(s.dueOn)}`;
    case "not_sent":
      return `Not sent to the support coordinator · due ${formatDate(s.dueOn)}`;
    case "sent":
      return sentLine(s) + (s.late ? " · late" : "");
  }
}

/** Needs attention: from day 25 (or when the activation date is missing); nothing otherwise. */
export function strategyAttention(
  s: StrategySendState,
): { title: string; detail: string; overdue: boolean } | null {
  if (s.kind === "no_activation") {
    return s.hasPlan
      ? {
          title: "Support strategies due date unknown",
          detail: "Add the PCSP activation date",
          overdue: false,
        }
      : null;
  }
  if (s.kind !== "not_sent" && s.kind !== "not_approved") return null;
  if (!s.dueSoon && !s.overdue) return null;
  return {
    title: `Support strategies not sent to the support coordinator — due ${formatDate(s.dueOn)}`,
    detail: s.kind === "not_approved" ? "Approve them, then mark as sent" : "Mark them as sent",
    overdue: s.overdue,
  };
}

/** The Client file card: on file once sent; due date while waiting. */
export function strategyFileFact(s: StrategySendState): { onFile: boolean; dueOn: string | null } {
  if (s.kind === "sent") return { onFile: true, dueOn: null };
  if (s.kind === "not_sent" || s.kind === "not_approved") return { onFile: false, dueOn: s.dueOn };
  return { onFile: false, dueOn: null };
}

/** The Evidence grid chip for the "Support Strategies" item. */
export function strategyChip(
  s: StrategySendState,
  itemId: string,
  today: string,
): EvidenceMatrixChip {
  switch (s.kind) {
    case "not_needed":
      return { kind: "na", label: "N/A", itemId };
    case "sent":
      return { kind: "complete", label: "Complete", itemId };
    case "no_activation":
      return { kind: "add", label: "Add", itemId };
    default: {
      if (s.overdue) return { kind: "missing", label: "Missing", itemId };
      return { kind: "due", label: dueChipLabel(daysBetweenIso(today, s.dueOn) ?? 0), itemId };
    }
  }
}

/**
 * An Evidence grid chip: the client "Support Strategies" item follows the
 * send rule (`states` by client id); a skipped item stays skipped; every
 * other item is matrixChip.
 */
export function evidenceChip(
  args: { item: EvidenceItemRow; file: EvidenceFileRow | null; today: string },
  states: Readonly<Record<string, StrategySendState>> | undefined,
): EvidenceMatrixChip {
  const { item, today } = args;
  const state =
    item.subject_type === "client" && item.requirement_key === "support_strategies"
      ? states?.[item.subject_id]
      : undefined;
  if (!state || isEvidenceSkipped(item)) return matrixChip(args);
  return strategyChip(state, item.id, today);
}
