// The rotation builder on the server (B6): loads what's booked in the next
// 4 weeks, plans each line's drafts (rotation-plan.ts), runs every draft
// through the rule engine with its person and, when refused, with no one on
// it (checkShiftRows in shift-guard.server.ts; no rules of its own), and
// writes the result: new drafts carry pattern_line_id and created_from
// 'rotation'; rebuilt drafts are updated in place; drafts the line no longer
// wants are cancelled (kept on record). Called by rotation.functions.ts (save,
// end, preview; as the caller, RLS applies) and by the scheduler-tick hook
// once a day per line (runRotationBuilds, service role).
import { checkShiftRows, type ShiftRowIn } from "./shift-guard.server.ts";
import { decideCopy } from "./copy-week.ts";
import type { Finding } from "./rules-types.ts";
import {
  planRotationDrafts,
  rotationWrite,
  type LineBuild,
  type PlanShift,
  type RotationSkip,
  type RotationWrite,
} from "./rotation-plan.ts";
import { builtThroughOf, HORIZON_DAYS, type RotationLine } from "./rotation.ts";
import type { DayOutcome } from "./rotation-preview.ts";
import { addDaysKey, dayKey, toLocalRange } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const LINE_COLUMNS =
  "id, organization_id, staff_id, client_id, team_id, service_code, shift_type, cycle, cycle_start, weekday_mask, start_time_local, end_time_local, effective_from, effective_until, active, updated_at";
export type StoredLine = RotationLine & { organization_id: string; updated_at: string };

const PLAN_COLUMNS =
  "id, staff_id, client_id, team_id, service_code, shift_type, starts_at, ends_at, status, published, pattern_line_id";

export type BuildPlan = {
  writes: RotationWrite[];
  cancels: string[];
  skipped: RotationSkip[];
  outcomes: Array<DayOutcome & { lineId: string }>;
};

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

/** A line as last built: its stored row, and the last day that build covered. */
export const rebuildOf = (stored: StoredLine, line: RotationLine = stored): LineBuild => ({
  line,
  before: stored,
  builtThrough: builtThroughOf(dayKey(stored.updated_at)),
});

/** Shifts in the window (a day either side for overnights) of these lines, people and clients. */
async function loadBooked(db: Db, orgId: string, lines: RotationLine[], from: string, to: string) {
  const { startIso } = toLocalRange(addDaysKey(from, -1));
  const { endExclusiveIso } = toLocalRange(addDaysKey(to, 1));
  const base = () =>
    db
      .from("scheduled_shifts")
      .select(PLAN_COLUMNS)
      .eq("organization_id", orgId)
      .gte("starts_at", startIso)
      .lt("starts_at", endExclusiveIso);
  const ids = (k: "id" | "staff_id" | "client_id") => [
    ...new Set(lines.map((l) => l[k]).filter((x): x is string => !!x)),
  ];
  const [byLine, byStaff, byClient] = await Promise.all([
    base().in("pattern_line_id", ids("id")),
    ids("staff_id").length ? base().in("staff_id", ids("staff_id")) : { data: [], error: null },
    ids("client_id").length ? base().in("client_id", ids("client_id")) : { data: [], error: null },
  ]);
  const seen = new Map<string, PlanShift>();
  for (const r of [byLine, byStaff, byClient].flatMap((x) => must<PlanShift[]>(x)))
    seen.set(r.id, r);
  return [...seen.values()];
}

const byShift = (findings: readonly Finding[]) => {
  const out = new Map<string, Finding[]>();
  for (const f of findings) if (f.shiftId) out.set(f.shiftId, [...(out.get(f.shiftId) ?? []), f]);
  return out;
};

const SKIP_TEXT: Record<RotationSkip["why"], string> = {
  person: "they already have a shift then",
  client: "the client already has a shift then",
};

/** What a build would do, checked by the rule engine. Writes nothing. */
export async function planBuild(
  db: Db,
  orgId: string,
  builds: readonly LineBuild[],
  now: Date,
): Promise<BuildPlan> {
  const from = dayKey(now);
  const to = addDaysKey(from, HORIZON_DAYS - 1);
  const existing = await loadBooked(
    db,
    orgId,
    builds.map((b) => b.line),
    from,
    to,
  );
  const plan = planRotationDrafts(builds, existing, { from, to, now: now.toISOString() });
  const keyOf = (d: { id: string | null; key: string }) => d.id ?? d.key;
  const row = (d: (typeof plan.drafts)[number], staffId: string | null): ShiftRowIn => ({
    id: keyOf(d),
    staff_id: staffId,
    client_id: d.client_id,
    team_id: d.team_id,
    service_code: d.service_code,
    starts_at: d.starts_at,
    ends_at: d.ends_at,
    status: staffId ? "draft" : "open",
    shift_type: d.shift_type,
  });
  const first = byShift(
    (
      await checkShiftRows(
        db,
        orgId,
        plan.drafts.map((d) => row(d, d.staff_id)),
      )
    ).findings,
  );
  const refused = plan.drafts.filter(
    (d) => d.staff_id && (first.get(keyOf(d)) ?? []).some((f) => f.level !== "warn"),
  );
  const asOpen = byShift(
    (
      await checkShiftRows(
        db,
        orgId,
        refused.map((d) => row(d, null)),
      )
    ).findings,
  );
  const current = new Map(existing.map((s) => [s.id, s]));
  const outcomes: BuildPlan["outcomes"] = [];
  const writes = plan.drafts.map((d) => {
    const outcome = decideCopy(
      first.get(keyOf(d)) ?? [],
      d.staff_id ? (asOpen.get(keyOf(d)) ?? []) : null,
    );
    outcomes.push({
      lineId: d.lineId,
      day: d.day,
      as: outcome.as,
      message: outcome.as === "draft" ? outcome.note : outcome.message,
    });
    return rotationWrite(d, outcome, d.id ? (current.get(d.id) ?? null) : null);
  });
  for (const s of plan.skipped)
    outcomes.push({ lineId: s.lineId, day: s.day, as: "skip", message: SKIP_TEXT[s.why] });
  return { writes, cancels: plan.cancels.map((c) => c.id), skipped: plan.skipped, outcomes };
}

export type BuildResult = { created: number; updated: number; cancelled: number; open: number };

/** Writes a planned build. Only unpublished shifts are ever updated or cancelled. */
export async function applyBuild(
  db: Db,
  orgId: string,
  plan: BuildPlan,
  userId: string | null,
  now: Date,
): Promise<BuildResult> {
  const fields = (w: Extract<RotationWrite, { kind: "insert" | "update" }>) => ({
    staff_id: w.land.staff_id,
    client_id: w.draft.client_id,
    team_id: w.draft.team_id,
    service_code: w.draft.service_code,
    shift_type: w.draft.shift_type,
    starts_at: w.draft.starts_at,
    ends_at: w.draft.ends_at,
    status: w.land.status,
    open_spots: w.land.open_spots,
  });
  const inserts = plan.writes.flatMap((w) =>
    w.kind === "insert"
      ? [
          {
            ...fields(w),
            organization_id: orgId,
            published: false,
            pattern_line_id: w.draft.lineId,
            created_from: "rotation",
            created_by: userId,
          },
        ]
      : [],
  );
  if (inserts.length) {
    const { error } = await db.from("scheduled_shifts").insert(inserts);
    if (error) throw new Error(`The rotation's drafts weren't saved: ${error.message}`);
  }
  let updated = 0;
  for (const w of plan.writes) {
    if (w.kind !== "update") continue;
    const { error } = await db
      .from("scheduled_shifts")
      .update(fields(w))
      .eq("id", w.draft.id)
      .eq("organization_id", orgId)
      .eq("published", false);
    if (error) throw new Error(`A rotation draft wasn't updated: ${error.message}`);
    updated++;
  }
  const cancels = [
    ...plan.cancels,
    ...plan.writes.flatMap((w) => (w.kind === "cancel" ? [w.id] : [])),
  ];
  if (cancels.length) {
    const { error } = await db
      .from("scheduled_shifts")
      .update({ status: "cancelled", cancelled_at: now.toISOString() })
      .in("id", cancels)
      .eq("organization_id", orgId)
      .eq("published", false);
    if (error) throw new Error(`The rotation's old drafts weren't cancelled: ${error.message}`);
  }
  const open = plan.writes.filter(
    (w) => (w.kind === "insert" || w.kind === "update") && w.land.status === "open",
  ).length;
  return { created: inserts.length, updated, cancelled: cancels.length, open };
}

/** Once a day per line (scheduler-tick): top up the 4 weeks and re-check attached drafts. */
export async function runRotationBuilds(admin: Db, now = new Date()) {
  const since = new Date(now.getTime() - 20 * 3_600_000).toISOString();
  const today = dayKey(now);
  const due = must<StoredLine[]>(
    await admin
      .from("recurring_shift_patterns")
      .select(LINE_COLUMNS)
      .eq("active", true)
      .lt("updated_at", since)
      .or(`effective_until.is.null,effective_until.gte.${today}`),
  );
  const byOrg = new Map<string, StoredLine[]>();
  for (const l of due) byOrg.set(l.organization_id, [...(byOrg.get(l.organization_id) ?? []), l]);
  const totals: BuildResult & { lines: number; failed: number } = {
    lines: 0,
    failed: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    open: 0,
  };
  for (const [orgId, lines] of byOrg) {
    try {
      const plan = await planBuild(
        admin,
        orgId,
        lines.map((l) => rebuildOf(l)),
        now,
      );
      const r = await applyBuild(admin, orgId, plan, null, now);
      // The touch is the build's record: updated_at = when the line was last built.
      const { error } = await admin
        .from("recurring_shift_patterns")
        .update({ updated_at: now.toISOString() })
        .in(
          "id",
          lines.map((l) => l.id),
        );
      if (error) throw new Error(error.message);
      totals.lines += lines.length;
      totals.created += r.created;
      totals.updated += r.updated;
      totals.cancelled += r.cancelled;
      totals.open += r.open;
    } catch {
      totals.failed += lines.length;
    }
  }
  return totals;
}
