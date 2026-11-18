// Copy week on the server (B4): loads the source and target weeks, plans the
// copies (copy-week.ts planCopyWeek: same weekday, never overwrites), runs
// each copy through the rule engine with its person and, when refused, with
// no one on it (checkShiftRows in shift-guard.server.ts), and lets
// decideCopy() say how it lands: a draft, an open shift, or skipped. Called by
// previewCopyWeek and copyWeek (copy-week.functions.ts). Runs as the caller.
import {
  decideCopy,
  planCopyWeek,
  type CopyOutcome,
  type CopyRow,
  type CopyScope,
  type CopySource,
  type Skip,
} from "./copy-week.ts";
import { checkShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "./shift-guard.server.ts";
import { shiftPlace, type BoardClient, type BoardTeam } from "./board-model.ts";
import type { Finding } from "./rules-types.ts";
import { addDaysKey, toLocalRange } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PlannedCopy = CopyRow & { key: string; outcome: Exclude<CopyOutcome, { as: "skip" }> };
export type CopyPlan = { copies: PlannedCopy[]; skipped: Skip[]; source: number };

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

async function weekShifts(db: Db, orgId: string, week: string): Promise<CopySource[]> {
  const { startIso, endExclusiveIso } = toLocalRange(week, addDaysKey(week, 6));
  return must(
    await db
      .from("scheduled_shifts")
      .select(`${SHIFT_COLUMNS}, notes, open_spots`)
      .eq("organization_id", orgId)
      .gte("starts_at", startIso)
      .lt("starts_at", endExclusiveIso),
  );
}

const byShift = (findings: readonly Finding[]) => {
  const out = new Map<string, Finding[]>();
  for (const f of findings) if (f.shiftId) out.set(f.shiftId, [...(out.get(f.shiftId) ?? []), f]);
  return out;
};

export async function planCopy(
  db: Db,
  orgId: string,
  fromWeek: string,
  toWeek: string,
  scope: CopyScope,
): Promise<CopyPlan> {
  const [source, existing, teams] = await Promise.all([
    weekShifts(db, orgId, fromWeek),
    weekShifts(db, orgId, toWeek),
    db.from("teams").select("id, team_name, team_type").eq("organization_id", orgId),
  ]);
  const clientIds = [...new Set(source.map((s) => s.client_id).filter((x): x is string => !!x))];
  const clients: BoardClient[] = clientIds.length
    ? must(
        await db.from("clients").select("id, first_name, last_name, team_id").in("id", clientIds),
      )
    : [];
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const teamMap = new Map(must<BoardTeam[]>(teams).map((t) => [t.id, t]));
  const planned = planCopyWeek({
    source,
    existing,
    fromWeek,
    toWeek,
    scope,
    placeOf: (s) => shiftPlace(s, clientMap, teamMap),
  });

  // Every copy gets a key the engine reports findings under; segments point at their parent's.
  const keyOf = new Map(planned.copies.map((c, i) => [c.sourceId, `copy-${i}`]));
  const row = (c: CopyRow, staffId: string | null): ShiftRowIn => ({
    id: keyOf.get(c.sourceId)!,
    staff_id: staffId,
    client_id: c.client_id,
    team_id: c.team_id,
    service_code: c.service_code,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    parent_shift_id: c.parentSourceId ? (keyOf.get(c.parentSourceId) ?? null) : null,
    status: staffId ? "draft" : "open",
    shift_type: c.shift_type,
  });
  const first = byShift(
    (
      await checkShiftRows(
        db,
        orgId,
        planned.copies.map((c) => row(c, c.staff_id)),
      )
    ).findings,
  );
  const refused = planned.copies.filter(
    (c) => c.staff_id && (first.get(keyOf.get(c.sourceId)!) ?? []).some((f) => f.level !== "warn"),
  );
  const asOpen = byShift(
    (
      await checkShiftRows(
        db,
        orgId,
        refused.map((c) => row(c, null)),
      )
    ).findings,
  );

  const copies: PlannedCopy[] = [];
  const skipped = [...planned.skipped];
  const gone = new Set<string>();
  for (const c of planned.copies) {
    const key = keyOf.get(c.sourceId)!;
    if (c.parentSourceId && gone.has(c.parentSourceId)) {
      skipped.push({ sourceId: c.sourceId, why: "parent" });
      gone.add(c.sourceId);
      continue;
    }
    const outcome = decideCopy(first.get(key) ?? [], c.staff_id ? (asOpen.get(key) ?? []) : null);
    if (outcome.as === "skip") {
      skipped.push({ sourceId: c.sourceId, why: "blocked", message: outcome.message });
      gone.add(c.sourceId);
      continue;
    }
    copies.push({ ...c, key, outcome });
  }
  return { copies, skipped, source: planned.copies.length + planned.skipped.length };
}

/** Inserts the planned copies as drafts (open ones as unoffered open shifts). Returns the new ids. */
export async function insertCopies(
  db: Db,
  orgId: string,
  userId: string,
  copies: readonly PlannedCopy[],
) {
  const idOf = new Map(copies.map((c) => [c.sourceId, crypto.randomUUID()]));
  const rows = copies.map((c) => {
    const open = c.outcome.as === "open" || !c.staff_id;
    return {
      id: idOf.get(c.sourceId)!,
      organization_id: orgId,
      staff_id: open ? null : c.staff_id,
      client_id: c.client_id,
      team_id: c.team_id,
      service_code: (c.service_code ?? "").toUpperCase(),
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      shift_type: c.shift_type ?? "hourly",
      notes: c.notes,
      open_spots: open ? (c.open_spots ?? 1) : null,
      parent_shift_id: c.parentSourceId ? (idOf.get(c.parentSourceId) ?? null) : null,
      status: open ? "open" : "draft",
      published: false,
      created_by: userId,
    };
  });
  // Parents first: a segment's parent must exist before it.
  for (const batch of [
    rows.filter((r) => !r.parent_shift_id),
    rows.filter((r) => r.parent_shift_id),
  ]) {
    if (!batch.length) continue;
    const { error } = await db.from("scheduled_shifts").insert(batch);
    if (error)
      throw new Error(`The copy stopped: ${error.message}. Nothing after that point was copied.`);
  }
  return rows.map((r) => r.id);
}
