// Builds the Needs you list (B5) from what needs.server.ts loaded. Pure: every
// row, its words and whether this viewer may act on it. This file makes the
// shift rows (call-outs, late and missed clock-ins, open shifts and claims,
// swaps, time off); needs-rows.ts makes the rest (punch fixes, cards, 1056,
// overtime). Kinds, tags and order are needs-items.ts; late/missed is
// late-punch.ts; who approves is needs-approvers.ts. Office screen only: rows
// name clients and team members (texts to staff never do).
import { fmtDay } from "./auth-outlook.ts";
import { isCancelled, shiftHours, staffHours, type BoardShift } from "./board-model.ts";
import { punchState, minutesLate, shiftWhen } from "./late-punch.ts";
import { canApprove, homesOfShifts } from "./needs-approvers.ts";
import { sortNeeds, type NeedItem } from "./needs-items.ts";
import {
  authRows,
  cardRows,
  clock,
  first,
  overtimeRows,
  punchFixRows,
  type NeedsInput,
} from "./needs-rows.ts";
import { isEvvLockedCode } from "../evv-codes.ts";
import { dayKey } from "./time.ts";

export type { NeedsInput, NeedsViewer } from "./needs-rows.ts";

const ms = (iso: string) => new Date(iso).getTime();
const range = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);

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
      key: `callout:${c.id}`,
      kind: "callout",
      level: "crit",
      tier: 0,
      at: s.starts_at,
      title: `${name(c.staff_id)} · ${where(s)}`,
      why: `${c.reason?.trim() || "No reason given"} · called out ${clock(c.created_at)}, ${fmtDay(dayKey(c.created_at))}. ${s.staff_id ? "Still on the shift until you move it." : "Shift is open."}`,
      shiftId: s.id,
      staffId: c.staff_id,
      refId: c.id,
    });
  }

  for (const s of live) {
    if (calledOut.has(s.id)) continue;
    const state = punchState(s, i.punches, i.now);
    if (!state) continue;
    const who = first(name(s.staff_id));
    out.push({
      key: `${state}:${s.id}`,
      kind: state,
      level: "crit",
      tier: 0,
      at: s.starts_at,
      title: `${name(s.staff_id)} · ${where(s)}`,
      why:
        state === "late"
          ? `${minutesLate(s, i.now)} min past the start and ${who} isn't clocked in.`
          : `No clock-in or clock-out. ${isEvvLockedCode(code(s)) ? "EVV has no visit, so it can't bill until a punch is added." : "No time on record for payroll."}`,
      shiftId: s.id,
      staffId: s.staff_id ?? undefined,
      phone: s.staff_id ? (i.staff.get(s.staff_id)?.phone ?? null) : null,
      askedAt: i.asked.get(s.id) ?? null,
    });
  }

  for (const s of live) {
    if (s.staff_id || ms(s.ends_at) <= nowMs || dayKey(s.starts_at) >= i.openUntil) continue;
    if (s.claim_requested_by) {
      const h = hoursNow(s.claim_requested_by);
      out.push({
        key: `claim:${s.id}`,
        kind: "claim",
        level: "info",
        tier: 1,
        at: s.starts_at,
        title: `${name(s.claim_requested_by)} wants ${where(s)}`,
        why: `${h} h → ${Math.round((h + shiftHours(s)) * 100) / 100} h this week.`,
        shiftId: s.id,
        staffId: s.claim_requested_by,
        approve: i.viewer.isAgencyAdmin
          ? { ok: true }
          : { ok: false, reason: "Only the owner or an agency-wide admin approves claims." },
      });
      continue;
    }
    const oneToOne = !!(s.team_id && s.client_id);
    const offered = i.offers.get(s.id) ?? 0;
    out.push({
      key: `open:${s.id}`,
      kind: oneToOne ? "one_to_one" : "open",
      level: oneToOne ? "crit" : "warn",
      tier: oneToOne ? 0 : 1,
      at: s.starts_at,
      title: oneToOne ? `${i.clients.get(s.client_id!)?.name ?? "Client"} · ${where(s)}` : where(s),
      why: `${oneToOne ? "Enhanced 1:1 staffing; house staff can't count as the 1:1. " : ""}${offered ? `Offered to ${offered}.` : "Not offered yet."}`,
      shiftId: s.id,
      offered,
    });
  }

  for (const w of i.swaps) {
    const s = byId.get(w.shift_id);
    if (!s || isCancelled(s) || !w.to_staff_id) continue;
    const h = hoursNow(w.to_staff_id);
    out.push({
      key: `swap:${w.id}`,
      kind: "swap",
      level: "info",
      tier: 1,
      at: s.starts_at,
      title: `${first(name(w.from_staff_id))} → ${first(name(w.to_staff_id))} · ${where(s)}`,
      why: `${first(name(w.to_staff_id))} accepted.${w.note ? ` “${w.note}”` : ""} ${first(name(w.to_staff_id))}: ${h} h → ${Math.round((h + shiftHours(s)) * 100) / 100} h this week.`,
      shiftId: s.id,
      staffId: w.to_staff_id,
      refId: w.id,
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
          key: `uncovered:${t.id}:${s.id}`,
          kind: "uncovered",
          level: "warn",
          tier: 1,
          at: s.starts_at,
          title: `${name(t.staff_id)} · ${where(s)}`,
          why: `Time off approved for ${range(t.start_date, t.end_date)}. ${first(name(t.staff_id))} is still on this shift.`,
          shiftId: s.id,
          staffId: t.staff_id,
        });
      continue;
    }
    out.push({
      key: `timeoff:${t.id}`,
      kind: "timeoff",
      level: "info",
      tier: 2,
      at: null,
      title: `${name(t.staff_id)} · ${range(t.start_date, t.end_date)} · ${t.type.toUpperCase()}`,
      why: `${t.note?.trim() ? `${t.note.trim()}. ` : ""}${hit.length ? `${hit.length} scheduled shift${hit.length > 1 ? "s" : ""} would need someone else.` : "Nothing scheduled those days."}`,
      staffId: t.staff_id,
      refId: t.id,
      approve: i.viewer.canEditScheduling
        ? canApprove("timeoff", i.viewer, homesOf(hit))
        : noScheduling,
    });
  }

  out.push(
    ...punchFixRows(i, name),
    ...cardRows(i, name),
    ...authRows(i),
    ...overtimeRows(i, name, hoursNow),
  );
  return sortNeeds(out);
}
