// What changed on a PUBLISHED shift, who it affects, and how it reads to them
// (B4). Pure; no I/O. shift-change.server.ts records a shift_changes row with
// changeOf() on every board edit; send-changes.server.ts collapses the unsent
// ones per shift (collapseChanges) and notifies the people noticeFor() names;
// the staff phone's change cards use changeCard(). Drafts that were never
// published make no change. Texts never name a client: code, day, time and,
// on the phone card only, the home's name.
import { fmtSpan } from "./board-model.ts";
import { dayKey, parseLocalDate } from "./time.ts";

/** The parts of a shift a change record keeps (shift_changes.before / after). */
export type ShiftSnapshot = {
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  published: boolean;
  service_code: string | null;
  team_id: string | null;
  client_id: string | null;
};

export type ChangeRow = {
  id: string;
  shift_id: string;
  affected_staff_ids: string[];
  before: ShiftSnapshot;
  after: ShiftSnapshot;
  changed_at: string;
};

export function snapshotOf(r: {
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  status?: string | null;
  published?: boolean | null;
  service_code: string | null;
  team_id?: string | null;
  client_id: string | null;
}): ShiftSnapshot {
  return {
    staff_id: r.staff_id ?? null,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    status: r.status ?? "draft",
    published: !!r.published,
    service_code: r.service_code,
    team_id: r.team_id ?? null,
    client_id: r.client_id ?? null,
  };
}

const t = (iso: string) => new Date(iso).getTime();
const cancelled = (s: ShiftSnapshot) => s.status === "cancelled";

/** True when day, time, person, open or cancelled differs. */
export function materiallyDifferent(a: ShiftSnapshot, b: ShiftSnapshot): boolean {
  return (
    a.staff_id !== b.staff_id ||
    t(a.starts_at) !== t(b.starts_at) ||
    t(a.ends_at) !== t(b.ends_at) ||
    cancelled(a) !== cancelled(b)
  );
}

const people = (...ids: Array<string | null>) => [...new Set(ids.filter((x): x is string => !!x))];

/**
 * The change to record, or null: only a shift that was published before the
 * edit, and only when day, time, person, open or cancelled changed.
 * Affected = the old person and the new one.
 */
export function changeOf(
  before: ShiftSnapshot,
  after: ShiftSnapshot,
): { affected: string[] } | null {
  if (!before.published || !materiallyDifferent(before, after)) return null;
  return { affected: people(before.staff_id, after.staff_id) };
}

/** One net change per shift: the first before, the last after, everyone affected on the way. */
export type NetChange = {
  shiftId: string;
  changeIds: string[];
  affected: string[];
  before: ShiftSnapshot;
  after: ShiftSnapshot;
  /** False when the edits cancel out (moved and moved back): nothing to tell anyone. */
  real: boolean;
};

export function collapseChanges(rows: readonly ChangeRow[]): NetChange[] {
  const byShift = new Map<string, ChangeRow[]>();
  for (const r of [...rows].sort((a, b) => a.changed_at.localeCompare(b.changed_at)))
    byShift.set(r.shift_id, [...(byShift.get(r.shift_id) ?? []), r]);
  return [...byShift.entries()].map(([shiftId, list]) => {
    const before = list[0]!.before;
    const after = list[list.length - 1]!.after;
    const real = materiallyDifferent(before, after);
    return {
      shiftId,
      changeIds: list.map((r) => r.id),
      // Net no-op: nobody hears about it. Otherwise only the ends matter.
      affected: real ? people(before.staff_id, after.staff_id) : [],
      before,
      after,
      real,
    };
  });
}

const weekday = (iso: string) =>
  parseLocalDate(dayKey(iso)).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
  });
const code = (s: ShiftSnapshot) => (s.service_code ?? "").toUpperCase();

export type ChangeCard = { title: string; detail: string; kind: "changed" | "new" | "removed" | "cancelled" };

/**
 * How one net change reads to one person. `place` is the home's name when the
 * shift is at a home (never a client's name); empty for the push.
 */
export function changeCard(c: Pick<NetChange, "before" | "after">, viewerId: string, place = ""): ChangeCard {
  const at = place ? ` at ${place}` : "";
  const { before: b, after: a } = c;
  const had = b.staff_id === viewerId && !cancelled(b);
  const has = a.staff_id === viewerId && !cancelled(a);
  const when = (s: ShiftSnapshot) => `${weekday(s.starts_at)} ${fmtSpan(s)}`;
  if (had && !has) {
    if (cancelled(a))
      return { kind: "cancelled", title: `Cancelled: your ${weekday(b.starts_at)} shift`, detail: `${code(b)} ${when(b)}${at}` };
    return { kind: "removed", title: "Removed from your schedule", detail: `${code(b)} ${when(b)}${at}` };
  }
  if (!had && has) {
    const back = b.staff_id === viewerId && cancelled(b);
    return { kind: "new", title: back ? "Back on your schedule" : "New shift for you", detail: `${code(a)} ${when(a)}${at}` };
  }
  const sameDay = dayKey(b.starts_at) === dayKey(a.starts_at);
  return {
    kind: "changed",
    title: `Your ${weekday(b.starts_at)} shift changed`,
    detail: sameDay
      ? `${fmtSpan(b)} → ${fmtSpan(a)}${at}`
      : `${when(b)} → ${when(a)}${at}`,
  };
}

/** The one push a person gets at Send: their changes and their newly published shifts. */
export function noticeFor(
  viewerId: string,
  changes: readonly Pick<NetChange, "before" | "after">[],
  newShifts: number,
  weekLabel: string,
): { type: "shift_changed" | "shifts_published"; title: string; body: string } {
  if (!changes.length)
    return {
      type: "shifts_published",
      title: "Your schedule was published",
      body: `You have ${newShifts} new shift${newShifts === 1 ? "" : "s"} for the week of ${weekLabel}.`,
    };
  if (changes.length === 1 && !newShifts) {
    const card = changeCard(changes[0]!, viewerId);
    return { type: "shift_changed", title: card.title, body: card.detail };
  }
  const n = changes.length + newShifts;
  return {
    type: "shift_changed",
    title: "Schedule update",
    body: `${n} change${n === 1 ? "" : "s"} to your week of ${weekLabel}. Open My Schedule to see them.`,
  };
}
