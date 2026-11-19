// Needs you rows about people and paperwork (B5): punch fixes, cards, the
// 1056 outlook and overtime, plus the input every row builder reads. Pure.
// buildNeeds (needs-list.ts) calls these after the shift rows.
import { fmtDay, outlookMessage, type Outlook } from "./auth-outlook.ts";
import type { BoardShift } from "./board-model.ts";
import type { ShiftPunch } from "./late-punch.ts";
import type { ApprovalHome } from "./needs-approvers.ts";
import type { CardFinding } from "./needs-cards.ts";
import type { NeedItem } from "./needs-items.ts";
import type { Gap } from "./coverage.ts";
import { dayKey } from "./time.ts";

export type NeedsViewer = {
  userId: string;
  isOwner: boolean;
  /** Owner or agency-wide Admin: may decide claims (decideClaim). */
  isAgencyAdmin: boolean;
  canEditScheduling: boolean;
  canEditTimesheets: boolean;
};

export type NeedsInput = {
  now: Date;
  /** This week's days (YYYY-MM-DD), for claims' hours and overtime. */
  week: readonly string[];
  /** Last day (exclusive) open shifts are listed for: the end of next week. */
  openUntil: string;
  viewer: NeedsViewer;
  shifts: readonly BoardShift[];
  staff: ReadonlyMap<string, { name: string; phone: string | null }>;
  teams: ReadonlyMap<string, { name: string }>;
  clients: ReadonlyMap<string, { name: string; team_id: string | null }>;
  homes: ReadonlyMap<string, ApprovalHome>;
  punches: readonly ShiftPunch[];
  callouts: ReadonlyArray<{
    id: string;
    scheduled_shift_id: string;
    staff_id: string;
    reason: string | null;
    created_at: string;
  }>;
  swaps: ReadonlyArray<{
    id: string;
    shift_id: string;
    from_staff_id: string;
    to_staff_id: string | null;
    note: string | null;
  }>;
  timeOff: ReadonlyArray<{
    id: string;
    staff_id: string;
    start_date: string;
    end_date: string;
    type: string;
    note: string | null;
    status: string;
  }>;
  punchFixes: ReadonlyArray<{
    id: string;
    staff_id: string;
    client_id: string | null;
    service_type_code: string;
    clock_in_timestamp: string;
    clock_out_timestamp: string | null;
    corrected_clock_in: string | null;
    corrected_clock_out: string | null;
    edit_reason: string | null;
    override_reason: string | null;
  }>;
  cards: readonly CardFinding[];
  outlook: ReadonlyArray<{ clientId: string; code: string; unit: string; outlook: Outlook }>;
  otHours: number;
  /** Open shift id → people it was offered to. */
  offers: ReadonlyMap<string, number>;
  /** Shift id → when the person was asked to fix their punch. */
  asked: ReadonlyMap<string, string>;
  /** Staff id → when they were last sent a card reminder (today). */
  reminded: ReadonlyMap<string, string>;
  /** Coverage gaps at homes, today through the end of next week (B7). */
  gaps?: readonly Gap[];
};

export type Namer = (id: string | null) => string;

export const first = (name: string) => name.split(/\s+/)[0] ?? name;
export const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export function punchFixRows(i: NeedsInput, name: Namer): NeedItem[] {
  const out: NeedItem[] = [];
  for (const p of i.punchFixes) {
    const parts = [
      p.corrected_clock_in && p.corrected_clock_in !== p.clock_in_timestamp
        ? `clock-in to ${clock(p.corrected_clock_in)}`
        : null,
      p.corrected_clock_out && p.corrected_clock_out !== p.clock_out_timestamp
        ? `clock-out to ${clock(p.corrected_clock_out)}`
        : null,
    ].filter(Boolean);
    out.push({
      key: `punch_fix:${p.id}`,
      kind: "punch_fix",
      level: "info",
      tier: 2,
      at: p.clock_in_timestamp,
      title: `${name(p.staff_id)} · ${fmtDay(dayKey(p.clock_in_timestamp))} · ${(p.client_id && i.clients.get(p.client_id)?.name) || "Client"} ${p.service_type_code.toUpperCase()}`,
      why: `${parts.length ? `Asks to set ${parts.join(" and ")}` : "Asks for a time correction"}${p.edit_reason ? `: “${p.edit_reason}”` : "."}${p.override_reason ? ` Clock-in reason: “${p.override_reason}”.` : ""}`,
      staffId: p.staff_id,
      refId: p.id,
      approve: i.viewer.canEditTimesheets
        ? { ok: true }
        : { ok: false, reason: "Needs Timesheets edit access." },
    });
  }

  return out;
}

export function cardRows(i: NeedsInput, name: Namer): NeedItem[] {
  const out: NeedItem[] = [];
  for (const c of i.cards) {
    out.push({
      key: `card:${c.staffId}:${c.key}`,
      kind: c.expired ? "card_expired" : "card_expiring",
      level: c.expired ? "crit" : "warn",
      tier: c.expired ? 0 : 2,
      at: null,
      title: `${name(c.staffId)} · ${c.label} ${c.expired ? "expired" : "expires"} ${fmtDay(c.expiresOn)}`,
      why: `${c.shiftsAfter} scheduled shift${c.shiftsAfter > 1 ? "s" : ""} after that date.`,
      staffId: c.staffId,
      href: c.href,
      cardLabel: c.label,
      askedAt: i.reminded.get(c.staffId) ?? null,
    });
  }

  return out;
}

export function authRows(i: NeedsInput): NeedItem[] {
  const out: NeedItem[] = [];
  for (const o of i.outlook) {
    const st = o.outlook.status;
    if ((st !== "act" && st !== "watch") || o.code === "HHS") continue;
    out.push({
      key: `auth:${o.clientId}:${o.code}`,
      kind: "auth",
      level: st === "act" ? "crit" : "warn",
      tier: st === "act" ? 0 : 1,
      at: null,
      title: `${i.clients.get(o.clientId)?.name ?? "Client"} · ${o.code} · ${o.outlook.left < 0 ? `over by ${-o.outlook.left}` : `${o.outlook.left}`} ${o.unit}${o.outlook.left < 0 ? "" : " left"}`,
      why: `${outlookMessage(o.outlook, o.unit)} Time past the 1056 can't be billed.`,
      clientId: o.clientId,
    });
  }

  return out;
}

export function overtimeRows(
  i: NeedsInput,
  name: Namer,
  hoursNow: (id: string) => number,
): NeedItem[] {
  const out: NeedItem[] = [];
  for (const [id] of i.staff) {
    const h = hoursNow(id);
    if (h <= i.otHours) continue;
    out.push({
      key: `overtime:${id}`,
      kind: "overtime",
      level: "warn",
      tier: 2,
      at: null,
      title: `${name(id)} · ${h} h this week`,
      why: `${Math.round((h - i.otHours) * 100) / 100} h over the ${i.otHours} h threshold.`,
      staffId: id,
    });
  }
  return out;
}
