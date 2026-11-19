// The rotation builder's plan (B6): which drafts each rotation line creates,
// rebuilds or cancels in the next 4 weeks. Pure; no I/O. rotation.server.ts
// loads the lines and the shifts already booked, calls planRotationDrafts(),
// runs every draft through the rule engine (shift-guard.server.ts) and asks
// rotationWrite() what to write; it adds no rules of its own.
//   - Never overwrites: only drafts still attached to the line
//     (pattern_line_id), unpublished and not started are rebuilt. A hand edit
//     detaches a shift (pattern_line_id = null), so it is never touched.
//   - A day the line already built is never built again, even when its shift
//     was moved or cancelled by hand: `before` + `builtThrough` say which days
//     the last build covered.
//   - A new day is skipped when that person or client already has an
//     overlapping shift (copy-week.ts bookedClash).
//   - A draft the engine refuses because of its person lands open; one it
//     refuses even with no one on it is skipped, or cancelled when it was
//     already there (copy-week.ts decideCopy, the same as Copy week).
import { bookedClash, type CopyOutcome } from "./copy-week.ts";
import { dayKey } from "./time.ts";
import { rotationDays, slotOn, type RotationLine } from "./rotation.ts";

export type PlanShift = {
  id: string;
  staff_id: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string | null;
  shift_type: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  published: boolean;
  pattern_line_id: string | null;
};

/** One line to build: as saved now, as it was at its last build (null = never built), and the last day that build covered. */
export type LineBuild = {
  line: RotationLine;
  before: RotationLine | null;
  builtThrough: string | null;
};

/** A shift the line wants on a day. `id` set = an attached draft to rebuild; null = a new one. */
export type RotationDraft = {
  key: string;
  lineId: string;
  day: string;
  id: string | null;
  staff_id: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string;
  shift_type: string;
  starts_at: string;
  ends_at: string;
};

export type RotationSkip = { lineId: string; day: string; why: "person" | "client" };
export type RotationPlan = {
  drafts: RotationDraft[];
  cancels: { id: string; lineId: string }[];
  skipped: RotationSkip[];
};

type Booked = Pick<PlanShift, "staff_id" | "client_id" | "starts_at" | "ends_at" | "status">;

const ms = (iso: string) => new Date(iso).getTime();

function draftOf(line: RotationLine, day: string, id: string | null): RotationDraft {
  return {
    key: id ?? `rot-${line.id}-${day}`,
    lineId: line.id,
    id,
    staff_id: line.staff_id,
    client_id: line.client_id,
    team_id: line.team_id,
    service_code: (line.service_code ?? "").toUpperCase(),
    shift_type: line.shift_type ?? "hourly",
    ...slotOn(line, day), // day, starts_at, ends_at
  };
}

/** An attached draft the builder may still change: unpublished, draft or open, not started. */
export const rebuildable = (s: PlanShift, lineId: string, now: string) =>
  s.pattern_line_id === lineId &&
  !s.published &&
  (s.status === "draft" || s.status === "open") &&
  ms(s.starts_at) > ms(now);

export function planRotationDrafts(
  builds: readonly LineBuild[],
  existing: readonly PlanShift[],
  facts: { from: string; to: string; now: string },
): RotationPlan {
  const ids = new Set(builds.map((b) => b.line.id));
  const touched = new Set(
    existing
      .filter((s) => s.pattern_line_id && ids.has(s.pattern_line_id))
      .filter(
        (s) => rebuildable(s, s.pattern_line_id!, facts.now) && dayKey(s.starts_at) <= facts.to,
      )
      .map((s) => s.id),
  );
  // What's booked while planning: everything but the drafts being rebuilt, plus each planned draft.
  const booked: Booked[] = existing.filter((s) => !touched.has(s.id));
  const plan: RotationPlan = { drafts: [], cancels: [], skipped: [] };
  const lines = builds.map((b) => ({ ...b, days: rotationDays(b.line, facts.from, facts.to) }));

  // 1. Rebuild each line's attached drafts (or cancel them on days it no longer works).
  for (const { line, days } of lines) {
    for (const s of existing) {
      if (s.pattern_line_id !== line.id || !touched.has(s.id)) continue;
      const day = dayKey(s.starts_at);
      if (!days.includes(day)) {
        plan.cancels.push({ id: s.id, lineId: line.id });
        continue;
      }
      const d = draftOf(line, day, s.id);
      plan.drafts.push(d);
      booked.push({ ...d, status: "draft" });
    }
  }
  // 2. New days: not built before, no shift of this line on them, not started, nobody double-booked.
  for (const { line, before, builtThrough, days } of lines) {
    const handled = new Set(
      before && builtThrough && builtThrough >= facts.from
        ? rotationDays(before, facts.from, builtThrough)
        : [],
    );
    const attachedDays = new Set(
      existing.filter((s) => s.pattern_line_id === line.id).map((s) => dayKey(s.starts_at)),
    );
    for (const day of days) {
      if (attachedDays.has(day) || handled.has(day)) continue;
      const d = draftOf(line, day, null);
      if (ms(d.starts_at) <= ms(facts.now)) continue;
      const why = bookedClash(d, booked);
      if (why) {
        plan.skipped.push({ lineId: line.id, day, why });
        continue;
      }
      plan.drafts.push(d);
      booked.push({ ...d, status: "draft" });
    }
  }
  return plan;
}

type Landed = {
  staff_id: string | null;
  status: "draft" | "open";
  open_spots: number | null;
};

export type RotationWrite =
  | { kind: "insert"; draft: RotationDraft; land: Landed }
  | { kind: "update"; draft: RotationDraft; land: Landed }
  | { kind: "cancel"; id: string; message: string }
  | { kind: "skip"; draft: RotationDraft; message: string }
  | { kind: "none" };

/**
 * What to write for one draft, given how the engine says it lands
 * (decideCopy) and, for a rebuild, the shift as it is now. A rebuild that
 * already matches writes nothing.
 */
export function rotationWrite(
  draft: RotationDraft,
  outcome: CopyOutcome,
  current: PlanShift | null,
): RotationWrite {
  if (outcome.as === "skip")
    return current
      ? { kind: "cancel", id: current.id, message: outcome.message }
      : { kind: "skip", draft, message: outcome.message };
  const open = outcome.as === "open" || !draft.staff_id;
  const land: Landed = {
    staff_id: open ? null : draft.staff_id,
    status: open ? "open" : "draft",
    open_spots: open ? 1 : null,
  };
  if (!current) return { kind: "insert", draft, land };
  const same =
    current.staff_id === land.staff_id &&
    current.status === land.status &&
    current.client_id === draft.client_id &&
    current.team_id === draft.team_id &&
    (current.service_code ?? "").toUpperCase() === draft.service_code &&
    (current.shift_type ?? "hourly") === draft.shift_type &&
    ms(current.starts_at) === ms(draft.starts_at) &&
    ms(current.ends_at) === ms(draft.ends_at);
  return same ? { kind: "none" } : { kind: "update", draft, land };
}
