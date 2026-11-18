// Builds the Needs you list (B5) from what needs.server.ts loaded. Pure: every
// row, its words and whether this viewer may act on it. Kinds, tags and order
// are needs-items.ts; late/missed is late-punch.ts; cards are needs-cards.ts;
// who approves swaps and time off is needs-approvers.ts; the 1056 outlook is
// auth-outlook.ts. Office screen only: rows name clients and team members
// (texts to staff never do).
import { fmtDay, outlookMessage, type Outlook } from "./auth-outlook.ts";
import { isCancelled, shiftHours, staffHours, type BoardShift } from "./board-model.ts";
import { punchState, minutesLate, shiftWhen, type ShiftPunch } from "./late-punch.ts";
import { canApprove, homesOfShifts, type ApprovalHome } from "./needs-approvers.ts";
import type { CardFinding } from "./needs-cards.ts";
import { sortNeeds, type NeedItem } from "./needs-items.ts";
import { isEvvLockedCode } from "../evv-codes.ts";
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
  callouts: ReadonlyArray<{ id: string; scheduled_shift_id: string; staff_id: string; reason: string | null; created_at: string }>;
  swaps: ReadonlyArray<{ id: string; shift_id: string; from_staff_id: string; to_staff_id: string | null; note: string | null }>;
  timeOff: ReadonlyArray<{ id: string; staff_id: string; start_date: string; end_date: string; type: string; note: string | null; status: string }>;
  punchFixes: ReadonlyArray<{
    id: string; staff_id: string; client_id: string | null; service_type_code: string;
    clock_in_timestamp: string; clock_out_timestamp: string | null;
    corrected_clock_in: string | null; corrected_clock_out: string | null;
    edit_reason: string | null; override_reason: string | null;
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
};

const first = (name: string) => name.split(/\s+/)[0] ?? name;
const ms = (iso: string) => new Date(iso).getTime();
const range = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);
const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" })
    : "—";

export function buildNeeds(i: NeedsInput): NeedItem[] {
  const nowMs = i.now.getTime();
  const name = (id: string | null) => (id ? (i.staff.get(id)?.name ?? "Team member") : "Open");
  const place = (s: BoardShift) =>
    (s.team_id && i.teams.get(s.team_id)?.name) ||
    (s.client_id && i.clients.get(s.client_id)?.name) ||
    "Shift";
  const code = (s: BoardShift) => (s.service_code ?? "").toUpperCase();
  const where = (s: BoardShift) => `${shiftWhen(s)} · ${place(s)} ${code(s)}`.trim();
  const clientHome = new Map([...i.clients].map(([id, c]) => [id, c.team_id]));
  const homesOf = (list: BoardShift[]) => homesOfShifts(list, clientHome, i.homes);
  const live = i.shifts.filter((s) => !isCancelled(s));
  const byId = new Map(i.shifts.map((s) => [s.id, s]));
  const thisWeek = live.filter((s) => i.week.includes(dayKey(s.starts_at)));
  const hoursNow = (id: string) => staffHours(thisWeek, id);
  const out: NeedItem[] = [];
  const calledOut = new Set(i.callouts.map((c) => c.scheduled_shift_id));
  const noScheduling = { ok: false as const, reason: "Needs Scheduling edit access." };

  for (const c of i.callouts) {
    const s = byId.get(c.scheduled_shift_id);
    if (!s || isCancelled(s)) continue;
    out.push({
      key: `callout:${c.id}`, kind: "callout", level: "crit", tier: 0, at: s.starts_at,
      title: `${name(c.staff_id)} · ${where(s)}`,
      why: `${c.reason?.trim() || "No reason given"} · called out ${clock(c.created_at)}, ${fmtDay(dayKey(c.created_at))}. ${s.staff_id ? "Still on the shift until you move it." : "Shift is open."}`,
      shiftId: s.id, staffId: c.staff_id, refId: c.id,
    });
  }

  for (const s of live) {
    if (calledOut.has(s.id)) continue;
    const state = punchState(s, i.punches, i.now);
    if (!state) continue;
    const who = first(name(s.staff_id));
    out.push({
      key: `${state}:${s.id}`, kind: state, level: "crit", tier: 0, at: s.starts_at,
      title: `${name(s.staff_id)} · ${where(s)}`,
      why:
        state === "late"
          ? `${minutesLate(s, i.now)} min past the start and ${who} isn't clocked in.`
          : `No clock-in or clock-out. ${isEvvLockedCode(code(s)) ? "EVV has no visit, so it can't bill until a punch is added." : "No time on record for payroll."}`,
      shiftId: s.id, staffId: s.staff_id ?? undefined,
      phone: s.staff_id ? (i.staff.get(s.staff_id)?.phone ?? null) : null,
      askedAt: i.asked.get(s.id) ?? null,
    });
  }

  for (const s of live) {
    if (s.staff_id || ms(s.ends_at) <= nowMs || dayKey(s.starts_at) >= i.openUntil) continue;
    if (s.claim_requested_by) {
      const h = hoursNow(s.claim_requested_by);
      out.push({
        key: `claim:${s.id}`, kind: "claim", level: "info", tier: 1, at: s.starts_at,
        title: `${name(s.claim_requested_by)} wants ${where(s)}`,
        why: `${h} h → ${Math.round((h + shiftHours(s)) * 100) / 100} h this week.`,
        shiftId: s.id, staffId: s.claim_requested_by,
        approve: i.viewer.isAgencyAdmin
          ? { ok: true }
          : { ok: false, reason: "Only the owner or an agency-wide admin approves claims." },
      });
      continue;
    }
    const oneToOne = !!(s.team_id && s.client_id);
    const offered = i.offers.get(s.id) ?? 0;
    out.push({
      key: `open:${s.id}`, kind: oneToOne ? "one_to_one" : "open",
      level: oneToOne ? "crit" : "warn", tier: oneToOne ? 0 : 1, at: s.starts_at,
      title: oneToOne
        ? `${i.clients.get(s.client_id!)?.name ?? "Client"} · ${where(s)}`
        : where(s),
      why: `${oneToOne ? "Enhanced 1:1 staffing; house staff can't count as the 1:1. " : ""}${offered ? `Offered to ${offered}.` : "Not offered yet."}`,
      shiftId: s.id, offered,
    });
  }

  for (const w of i.swaps) {
    const s = byId.get(w.shift_id);
    if (!s || isCancelled(s) || !w.to_staff_id) continue;
    const h = hoursNow(w.to_staff_id);
    out.push({
      key: `swap:${w.id}`, kind: "swap", level: "info", tier: 1, at: s.starts_at,
      title: `${first(name(w.from_staff_id))} → ${first(name(w.to_staff_id))} · ${where(s)}`,
      why: `${first(name(w.to_staff_id))} accepted.${w.note ? ` “${w.note}”` : ""} ${first(name(w.to_staff_id))}: ${h} h → ${Math.round((h + shiftHours(s)) * 100) / 100} h this week.`,
      shiftId: s.id, staffId: w.to_staff_id, refId: w.id,
      approve: i.viewer.canEditScheduling
        ? canApprove("swap", i.viewer, homesOf([s]))
        : noScheduling,
    });
  }

  for (const t of i.timeOff) {
    const hit = live.filter(
      (s) =>
        s.staff_id === t.staff_id &&
        dayKey(s.starts_at) >= t.start_date &&
        dayKey(s.starts_at) <= t.end_date &&
        ms(s.ends_at) > nowMs,
    );
    if (t.status === "approved") {
      for (const s of hit)
        out.push({
          key: `uncovered:${t.id}:${s.id}`, kind: "uncovered", level: "warn", tier: 1, at: s.starts_at,
          title: `${name(t.staff_id)} · ${where(s)}`,
          why: `Time off approved for ${range(t.start_date, t.end_date)}. ${first(name(t.staff_id))} is still on this shift.`,
          shiftId: s.id, staffId: t.staff_id,
        });
      continue;
    }
    out.push({
      key: `timeoff:${t.id}`, kind: "timeoff", level: "info", tier: 2,
      at: null,
      title: `${name(t.staff_id)} · ${range(t.start_date, t.end_date)} · ${t.type.toUpperCase()}`,
      why: `${t.note?.trim() ? `${t.note.trim()}. ` : ""}${hit.length ? `${hit.length} scheduled shift${hit.length > 1 ? "s" : ""} would need someone else.` : "Nothing scheduled those days."}`,
      staffId: t.staff_id, refId: t.id,
      approve: i.viewer.canEditScheduling
        ? canApprove("timeoff", i.viewer, homesOf(hit))
        : noScheduling,
    });
  }

  for (const p of i.punchFixes) {
    const parts = [
      p.corrected_clock_in && p.corrected_clock_in !== p.clock_in_timestamp ? `clock-in to ${clock(p.corrected_clock_in)}` : null,
      p.corrected_clock_out && p.corrected_clock_out !== p.clock_out_timestamp ? `clock-out to ${clock(p.corrected_clock_out)}` : null,
    ].filter(Boolean);
    out.push({
      key: `punch_fix:${p.id}`, kind: "punch_fix", level: "info", tier: 2, at: p.clock_in_timestamp,
      title: `${name(p.staff_id)} · ${fmtDay(dayKey(p.clock_in_timestamp))} · ${(p.client_id && i.clients.get(p.client_id)?.name) || "Client"} ${p.service_type_code.toUpperCase()}`,
      why: `${parts.length ? `Asks to set ${parts.join(" and ")}` : "Asks for a time correction"}${p.edit_reason ? `: “${p.edit_reason}”` : "."}${p.override_reason ? ` Clock-in reason: “${p.override_reason}”.` : ""}`,
      staffId: p.staff_id, refId: p.id,
      approve: i.viewer.canEditTimesheets ? { ok: true } : { ok: false, reason: "Needs Timesheets edit access." },
    });
  }

  for (const c of i.cards) {
    out.push({
      key: `card:${c.staffId}:${c.key}`, kind: c.expired ? "card_expired" : "card_expiring",
      level: c.expired ? "crit" : "warn", tier: c.expired ? 0 : 2, at: null,
      title: `${name(c.staffId)} · ${c.label} ${c.expired ? "expired" : "expires"} ${fmtDay(c.expiresOn)}`,
      why: `${c.shiftsAfter} scheduled shift${c.shiftsAfter > 1 ? "s" : ""} after that date.`,
      staffId: c.staffId, href: c.href, cardLabel: c.label,
      askedAt: i.reminded.get(c.staffId) ?? null,
    });
  }

  for (const o of i.outlook) {
    const st = o.outlook.status;
    if ((st !== "act" && st !== "watch") || o.code === "HHS") continue;
    out.push({
      key: `auth:${o.clientId}:${o.code}`, kind: "auth", level: st === "act" ? "crit" : "warn",
      tier: st === "act" ? 0 : 1, at: null,
      title: `${i.clients.get(o.clientId)?.name ?? "Client"} · ${o.code} · ${o.outlook.left < 0 ? `over by ${-o.outlook.left}` : `${o.outlook.left}`} ${o.unit}${o.outlook.left < 0 ? "" : " left"}`,
      why: `${outlookMessage(o.outlook, o.unit)} Time past the 1056 can't be billed.`,
      clientId: o.clientId,
    });
  }

  for (const [id] of i.staff) {
    const h = hoursNow(id);
    if (h <= i.otHours) continue;
    out.push({
      key: `overtime:${id}`, kind: "overtime", level: "warn", tier: 2, at: null,
      title: `${name(id)} · ${h} h this week`,
      why: `${Math.round((h - i.otHours) * 100) / 100} h over the ${i.otHours} h threshold.`,
      staffId: id,
    });
  }
  return sortNeeds(out);
}
