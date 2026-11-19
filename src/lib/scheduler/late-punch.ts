// Late clock-ins and missed visits (B5). Pure. A published shift with a
// person is LATE once LATE_NUDGE_MINUTES have passed since its start with no
// clock-in, and MISSED once it has ended with none. A clock-in counts when it
// is linked to the shift (evv_timesheets.scheduled_shift_id) or, for punches
// made without the link, when the same person clocked in for the same client
// between an hour before the start and the end. Segments (nested 1:1s) and
// cancelled, open or declined shifts are never watched.
// Callers: needs-list.ts (Needs you rows) and late-alerts.server.ts (the
// background nudge to the staff member at +10 min and the lead at +30 min).
// Texts carry the code, day and time only, never a client's name.
import { fmtSpan } from "./board-model.ts";
import { dayKey, parseLocalDate } from "./time.ts";

/** No agency setting exists for these yet (B2 has none), so they are fixed here. */
export const LATE_NUDGE_MINUTES = 10;
export const LATE_LEAD_MINUTES = 30;
/** The background job ignores shifts that started longer ago than this. */
export const LATE_LOOKBACK_HOURS = 12;

export type PunchShift = {
  id: string;
  staff_id: string | null;
  client_id: string | null;
  service_code: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  published: boolean;
  parent_shift_id: string | null;
};

export type ShiftPunch = {
  scheduled_shift_id: string | null;
  staff_id: string;
  client_id: string | null;
  clock_in_timestamp: string;
};

const ms = (iso: string) => new Date(iso).getTime();
const MIN = 60_000;
const UNWATCHED = new Set(["cancelled", "open", "declined"]);

export function isWatched(s: PunchShift): boolean {
  return s.published && !!s.staff_id && !s.parent_shift_id && !UNWATCHED.has(s.status);
}

export function hasPunch(s: PunchShift, punches: readonly ShiftPunch[]): boolean {
  const from = ms(s.starts_at) - 60 * MIN;
  const to = ms(s.ends_at);
  return punches.some(
    (p) =>
      p.scheduled_shift_id === s.id ||
      (!p.scheduled_shift_id &&
        p.staff_id === s.staff_id &&
        !!s.client_id &&
        p.client_id === s.client_id &&
        ms(p.clock_in_timestamp) >= from &&
        ms(p.clock_in_timestamp) <= to),
  );
}

export type PunchState = "late" | "missed";

export function punchState(
  s: PunchShift,
  punches: readonly ShiftPunch[],
  now: Date,
  nudgeMinutes = LATE_NUDGE_MINUTES,
): PunchState | null {
  if (!isWatched(s)) return null;
  if (now.getTime() < ms(s.starts_at) + nudgeMinutes * MIN) return null;
  if (hasPunch(s, punches)) return null;
  return now.getTime() >= ms(s.ends_at) ? "missed" : "late";
}

export const minutesLate = (s: Pick<PunchShift, "starts_at">, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - ms(s.starts_at)) / MIN));

export type LateAlertKind = "nudge" | "lead";
export type LateAlert = { shift: PunchShift; kind: LateAlertKind };

/**
 * The alerts the background job owes now: the staff nudge while the shift is
 * still running (≥ nudge minutes late), the lead alert at ≥ lead minutes.
 * `sent` holds "nudge:<shiftId>" / "lead:<shiftId>" already sent, so each
 * goes once. Shifts that started more than LATE_LOOKBACK_HOURS ago are left
 * alone, so turning the job on never floods anyone with old shifts.
 */
export function lateAlerts(
  shifts: readonly PunchShift[],
  punches: readonly ShiftPunch[],
  sent: ReadonlySet<string>,
  now: Date,
  minutes: { nudge: number; lead: number } = { nudge: LATE_NUDGE_MINUTES, lead: LATE_LEAD_MINUTES },
): LateAlert[] {
  const out: LateAlert[] = [];
  const oldest = now.getTime() - LATE_LOOKBACK_HOURS * 60 * MIN;
  for (const s of shifts) {
    if (!isWatched(s) || ms(s.starts_at) < oldest || hasPunch(s, punches)) continue;
    const late = minutesLate(s, now);
    if (late >= minutes.nudge && now.getTime() < ms(s.ends_at) && !sent.has(`nudge:${s.id}`))
      out.push({ shift: s, kind: "nudge" });
    if (late >= minutes.lead && !sent.has(`lead:${s.id}`)) out.push({ shift: s, kind: "lead" });
  }
  return out;
}

/** "Tue, Nov 18 · 2p–10p" in Denver time. */
export function shiftWhen(s: Pick<PunchShift, "starts_at" | "ends_at">): string {
  const day = parseLocalDate(dayKey(s.starts_at)).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} · ${fmtSpan(s)}`;
}

const codeOf = (s: Pick<PunchShift, "service_code">) =>
  (s.service_code ?? "").toUpperCase() || "Shift";

/** Notification text for a late alert. `who` is the staff member's first name (lead alert only). */
export function lateAlertText(
  s: PunchShift,
  kind: LateAlertKind,
  now: Date,
  who = "The team member",
): { title: string; body: string } {
  const late = minutesLate(s, now);
  if (kind === "nudge")
    return {
      title: "You haven't clocked in",
      body: `You're ${late} minutes past the start of your ${codeOf(s)} shift (${shiftWhen(s)}). Clock in, or open the shift and tap Call out.`,
    };
  return {
    title: "Not clocked in",
    body: `${who} isn't clocked in for ${codeOf(s)} · ${shiftWhen(s)}, ${late} minutes past the start.`,
  };
}

/** The "Ask them to fix their punch" notice to the staff member. */
export function punchFixAskText(s: PunchShift): { title: string; body: string } {
  return {
    title: "Add the time for a shift",
    body: `Your ${codeOf(s)} shift (${shiftWhen(s)}) has no clock-in. If you worked it, add the time in My time corrections.`,
  };
}

/**
 * Who gets the +30 minute alert: the lead of the shift's home (not a host
 * home's host), else the agency's schedulers (Owners and agency-wide Admins
 * with Scheduling edit). A client shift with no home goes to the schedulers.
 */
export function lateLeadRecipients(
  home: { team_type: string | null; manager_id: string | null } | null,
  schedulers: readonly string[],
): string[] {
  if (home?.manager_id && home.team_type !== "host_home") return [home.manager_id];
  return [...schedulers];
}
