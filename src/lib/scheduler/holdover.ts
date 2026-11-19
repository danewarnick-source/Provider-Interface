// Hold-overs (Decision 7). Pure. A hold-over is a published shift whose end
// was moved out because no one else could come; it is recorded in
// shift_changes with kind 'holdover' and its reason. Fairness: the person
// whose last hold-over was longest ago (never = first) is asked first, then
// the one with the fewest this month. holdoverCandidates picks who the ladder
// asks to stay (escalation.server.ts); holdoverRecord builds Settings › Open
// shifts › Hold-over record (loadHoldoverRecord, escalation.functions.ts).
import { dayKey } from "./time.ts";

export const HOLDOVER_REASON = "Held over: no one else available";

/** One hold-over: who stayed, when it was recorded, and why. */
export type HoldoverRecordRow = { staffId: string; at: string; reason: string | null };

type Fairness = { last: string | null; month: number; reason: string | null };

const monthOf = (iso: string | Date) => dayKey(iso).slice(0, 7);

function fairness(records: readonly HoldoverRecordRow[], now: Date): Map<string, Fairness> {
  const out = new Map<string, Fairness>();
  const thisMonth = monthOf(now);
  for (const r of records) {
    const f = out.get(r.staffId) ?? { last: null, month: 0, reason: null };
    if (!f.last || r.at > f.last) {
      f.last = r.at;
      f.reason = r.reason;
    }
    if (monthOf(r.at) === thisMonth) f.month += 1;
    out.set(r.staffId, f);
  }
  return out;
}

const NONE: Fairness = { last: null, month: 0, reason: null };

/** Next up first: never held over, then longest ago, then fewest this month. */
function fairer(a: Fairness, b: Fairness): number {
  if (a.last !== b.last) {
    if (!a.last) return -1;
    if (!b.last) return 1;
    return a.last.localeCompare(b.last);
  }
  return a.month - b.month;
}

export type HoldShift = {
  id: string;
  staff_id: string | null;
  team_id: string | null;
  client_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  published: boolean;
  shift_type?: string | null;
};

/**
 * Who could stay for an open shift: a published shift with a person that
 * ends exactly when the open one starts, at the same home or with the same
 * client (on-call shifts don't count). Fairest first; one shift per person.
 */
export function holdoverCandidates(
  open: Pick<HoldShift, "id" | "team_id" | "client_id" | "starts_at">,
  shifts: readonly HoldShift[],
  records: readonly HoldoverRecordRow[],
  now: Date,
  exclude: ReadonlySet<string> = new Set(),
): Array<{ staffId: string; shiftId: string }> {
  const start = new Date(open.starts_at).getTime();
  const seen = new Set<string>();
  const pool = shifts.filter((s) => {
    if (!s.staff_id || s.id === open.id || exclude.has(s.staff_id) || seen.has(s.staff_id))
      return false;
    if (!s.published || s.status === "cancelled" || s.shift_type === "oncall") return false;
    if (new Date(s.ends_at).getTime() !== start) return false;
    const same =
      (!!open.team_id && s.team_id === open.team_id) ||
      (!!open.client_id && s.client_id === open.client_id);
    if (same) seen.add(s.staff_id);
    return same;
  });
  const f = fairness(records, now);
  return pool
    .map((s) => ({ staffId: s.staff_id!, shiftId: s.id }))
    .sort(
      (a, b) =>
        fairer(f.get(a.staffId) ?? NONE, f.get(b.staffId) ?? NONE) ||
        a.staffId.localeCompare(b.staffId),
    );
}

export type HoldoverLine = {
  staffId: string;
  name: string;
  /** When they last stayed; null = never. */
  last: string | null;
  lastReason: string | null;
  month: number;
};

/** Settings › Hold-over record: everyone, next up first (ties by name). */
export function holdoverRecord(
  people: ReadonlyArray<{ id: string; name: string }>,
  records: readonly HoldoverRecordRow[],
  now: Date,
): HoldoverLine[] {
  const f = fairness(records, now);
  return people
    .map((p) => {
      const x = f.get(p.id) ?? NONE;
      return { staffId: p.id, name: p.name, last: x.last, lastReason: x.reason, month: x.month };
    })
    .sort(
      (a, b) =>
        fairer(
          { last: a.last, month: a.month, reason: null },
          { last: b.last, month: b.month, reason: null },
        ) || a.name.localeCompare(b.name),
    );
}
