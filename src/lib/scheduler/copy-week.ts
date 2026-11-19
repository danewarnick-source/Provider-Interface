// Copy week (B4): which shifts of one week land in a later week, and how.
// Pure; no I/O. copy-week.server.ts loads the two weeks, calls planCopyWeek(),
// runs every copy through the rule engine (shift-guard.server.ts) and hands
// the findings to decideCopy(); it adds no rules of its own.
//   planCopyWeek  same weekday and wall-clock time in the target week; never
//                 overwrites: a copy is skipped when the target week already
//                 has a live shift overlapping it for the same person or the
//                 same client, or the very same shift (place, code, times).
//   decideCopy    a copy the engine refuses because of its person (time off,
//                 an expired card, over the cap) lands as an open shift; one
//                 the engine refuses even with no one on it is skipped.
import type { Finding } from "./rules-types.ts";
import { fmtDay } from "./auth-outlook.ts";
import { addDaysKey, daysBetween, dayKey, shiftByDays } from "./time.ts";

export type CopySource = {
  id: string;
  staff_id: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  shift_type: string | null;
  notes: string | null;
  open_spots: number | null;
  parent_shift_id: string | null;
};

/** "all", "community", or a teams.id (one home or program). */
export type CopyScope = string;

export type CopyRow = Omit<CopySource, "id" | "status" | "parent_shift_id"> & {
  sourceId: string;
  /** The source of this segment's parent; the server maps it to the parent copy's new id. */
  parentSourceId: string | null;
};

export type SkipWhy = "person" | "client" | "duplicate" | "parent" | "blocked";
export type Skip = { sourceId: string; why: SkipWhy; message?: string };

const live = (s: { status: string }) => s.status !== "cancelled" && s.status !== "declined";
const ms = (iso: string) => new Date(iso).getTime();
const overlaps = (
  a: { starts_at: string; ends_at: string },
  b: { starts_at: string; ends_at: string },
) => ms(a.starts_at) < ms(b.ends_at) && ms(b.starts_at) < ms(a.ends_at);

type Booked = Pick<CopySource, "staff_id" | "client_id" | "starts_at" | "ends_at" | "status">;

/**
 * "person" / "client" when a live shift already overlaps `row` for the same
 * person or the same client, else null. Also used by the rotation builder.
 */
export function bookedClash(
  row: Pick<CopySource, "staff_id" | "client_id" | "starts_at" | "ends_at">,
  existing: readonly Booked[],
): "person" | "client" | null {
  for (const e of existing) {
    if (!live(e) || !overlaps(e, row)) continue;
    if (row.staff_id && e.staff_id === row.staff_id) return "person";
    if (row.client_id && e.client_id === row.client_id) return "client";
  }
  return null;
}

/** Why `copy` would overwrite something already in the target week, or null. */
function clash(copy: CopyRow, existing: readonly CopySource[]): SkipWhy | null {
  const same = existing.some(
    (e) =>
      live(e) &&
      e.team_id === copy.team_id &&
      e.client_id === copy.client_id &&
      (e.service_code ?? "").toUpperCase() === (copy.service_code ?? "").toUpperCase() &&
      ms(e.starts_at) === ms(copy.starts_at) &&
      ms(e.ends_at) === ms(copy.ends_at),
  );
  return same ? "duplicate" : bookedClash(copy, existing);
}

export function planCopyWeek(input: {
  source: readonly CopySource[];
  existing: readonly CopySource[];
  fromWeek: string;
  toWeek: string;
  scope: CopyScope;
  /** The filter key a shift belongs to (board-model.ts shiftPlace). */
  placeOf: (s: CopySource) => string;
}): { copies: CopyRow[]; skipped: Skip[] } {
  const delta = daysBetween(input.fromWeek, input.toWeek);
  const last = addDaysKey(input.fromWeek, 6);
  const picked = input.source
    .filter((s) => live(s))
    .filter((s) => {
      const d = dayKey(s.starts_at);
      return d >= input.fromWeek && d <= last;
    })
    .filter((s) => input.scope === "all" || input.placeOf(s) === input.scope)
    // Parents before their segments, then by time.
    .sort(
      (a, b) =>
        Number(!!a.parent_shift_id) - Number(!!b.parent_shift_id) ||
        a.starts_at.localeCompare(b.starts_at),
    );
  const copies: CopyRow[] = [];
  const skipped: Skip[] = [];
  const copied = new Set<string>();
  for (const s of picked) {
    if (s.parent_shift_id && !copied.has(s.parent_shift_id)) {
      skipped.push({ sourceId: s.id, why: "parent" });
      continue;
    }
    const row: CopyRow = {
      sourceId: s.id,
      parentSourceId: s.parent_shift_id,
      staff_id: s.staff_id,
      client_id: s.client_id,
      team_id: s.team_id,
      service_code: s.service_code,
      starts_at: shiftByDays(s.starts_at, delta),
      ends_at: shiftByDays(s.ends_at, delta),
      shift_type: s.shift_type,
      notes: s.notes,
      open_spots: s.staff_id ? null : (s.open_spots ?? 1),
    };
    const why = clash(row, input.existing);
    if (why) {
      skipped.push({ sourceId: s.id, why });
      continue;
    }
    copies.push(row);
    copied.add(s.id);
  }
  return { copies, skipped };
}

export type CopyOutcome =
  | { as: "draft"; note: string | null }
  | { as: "open"; message: string }
  | { as: "skip"; message: string };

const refusing = (fs: readonly Finding[]) =>
  fs.filter((f) => f.level === "block" || f.level === "reason");

/**
 * How one copy lands, from the engine's findings for it with its person
 * (`staffed`) and with no one on it (`asOpen`; null when the copy has no person).
 * A "needs a reason" finding that isn't about the person (e.g. past the 1056)
 * copies as a draft and is asked for at Send.
 */
export function decideCopy(
  staffed: readonly Finding[],
  asOpen: readonly Finding[] | null,
): CopyOutcome {
  const refused = refusing(staffed);
  const warn = staffed.find((f) => f.level === "warn")?.message ?? null;
  if (!refused.length) return { as: "draft", note: warn };
  const block = (fs: readonly Finding[]) => fs.find((f) => f.level === "block");
  if (asOpen) {
    const openRules = new Set(refusing(asOpen).map((f) => f.rule));
    const personal = refused.filter((f) => !openRules.has(f.rule));
    if (personal.length) {
      const stillBlocked = block(asOpen);
      return stillBlocked
        ? { as: "skip", message: stillBlocked.message }
        : { as: "open", message: personal[0]!.message };
    }
  }
  const b = block(refused);
  if (b) return { as: "skip", message: b.message };
  return { as: "draft", note: `Needs a reason at Send: ${refused[0]!.message}` };
}

/** A week for the Copy week dialog: "Oct 25–31", or "Oct 25 – Nov 1" across months. */
export function weekSpan(start: string): string {
  const a = fmtDay(start).replace(/, \d{4}$/, "");
  const b = fmtDay(addDaysKey(start, 6)).replace(/, \d{4}$/, "");
  const [am, bm] = [a.split(" ")[0], b.split(" ")[0]];
  return am === bm ? `${a}–${b.split(" ")[1]}` : `${a} – ${b}`;
}
