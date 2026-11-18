// The Needs you row (B5): its kinds, tags, urgency and order. Pure. Rows are
// built by needs-list.ts and drawn by components/scheduler/needs/. Most urgent
// first: tier 0 (red: call-outs, late and missed clock-ins, 1:1 not covered,
// expired cards, 1056 Act now), then tier 1 (open shifts, claims, swaps,
// shifts left uncovered by time off, 1056 Watch), then tier 2 (time off,
// punch fixes, cards expiring, overtime). Within a tier, the earliest first.
import type { Approval } from "./needs-approvers.ts";

export type NeedKind =
  | "callout"
  | "late"
  | "missed"
  | "one_to_one"
  | "open"
  | "claim"
  | "swap"
  | "timeoff"
  | "uncovered"
  | "punch_fix"
  | "card_expired"
  | "card_expiring"
  | "auth"
  | "overtime";

export const NEED_TAG: Record<NeedKind, string> = {
  callout: "Call-out",
  late: "Late clock-in",
  missed: "Missed visit",
  one_to_one: "1:1 not covered",
  open: "Open shift",
  claim: "Claim",
  swap: "Swap",
  timeoff: "Time off",
  uncovered: "Uncovered after time off",
  punch_fix: "Punch fix",
  card_expired: "Card expired",
  card_expiring: "Card expiring",
  auth: "1056",
  overtime: "Overtime",
};

export const NEED_KINDS = Object.keys(NEED_TAG) as NeedKind[];

export type NeedLevel = "crit" | "warn" | "info";

export type NeedItem = {
  key: string;
  kind: NeedKind;
  level: NeedLevel;
  tier: 0 | 1 | 2;
  /** When it happens (a shift's start); null sorts last in its tier. */
  at: string | null;
  /** Where and when. */
  title: string;
  /** Why it's here. */
  why: string;
  shiftId?: string;
  staffId?: string;
  /** The call-out, swap, time-off or timesheet row the action acts on. */
  refId?: string;
  /** Late / missed: the person's phone, when the viewer may see it. */
  phone?: string | null;
  /** Late / missed: when they were asked to fix their punch. Card: when reminded. */
  askedAt?: string | null;
  /** Claim, swap, time off, punch fix: may this viewer decide it? */
  approve?: Approval;
  /** Open shift / 1:1: people it was offered to (0 = not offered yet). */
  offered?: number;
  /** Card: Open in Evidence. */
  href?: string | null;
  /** Card: what it is, for the reminder. */
  cardLabel?: string;
  /** 1056: the client. */
  clientId?: string;
};

export function sortNeeds(items: NeedItem[]): NeedItem[] {
  return [...items].sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.at && b.at ? a.at.localeCompare(b.at) : a.at ? -1 : b.at ? 1 : 0) ||
      a.key.localeCompare(b.key),
  );
}

const PLURAL: Partial<Record<NeedKind, string>> = {
  callout: "Call-outs",
  late: "Late clock-ins",
  missed: "Missed visits",
  open: "Open shifts",
  claim: "Claims",
  swap: "Swaps",
  punch_fix: "Punch fixes",
  card_expired: "Cards expired",
  card_expiring: "Cards expiring",
};

/** "2 call-outs · 1 claim", for the board banner. */
export function needsSummary(items: readonly NeedItem[]): string {
  const counts = new Map<NeedKind, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  return [...counts]
    .map(([k, n]) => `${n} ${(n > 1 ? (PLURAL[k] ?? NEED_TAG[k]) : NEED_TAG[k]).toLowerCase()}`)
    .join(" · ");
}

export const isNeedKind = (v: unknown): v is NeedKind =>
  typeof v === "string" && (NEED_KINDS as string[]).includes(v);
