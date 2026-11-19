// Records a shift_changes row when a PUBLISHED shift's day, time, person,
// open or cancelled state changes (B4). The one helper every board edit path
// calls after its write: saveShift (edit, drag, assign, make open, copy-drag
// into an existing shift), cancelShift and restoreShift (scheduler.functions.ts),
// swaps (requests.server.ts), Start escalation on a call-out
// (escalation.functions.ts) and Take it / Stay (escalation-answer.server.ts,
// service role; a Stay is kind 'holdover' with its reason).
// The rule for "is this a change, and who's affected" is changeOf()
// (shift-change.ts); drafts never published make no row. Runs as the calling
// user: shift_changes RLS lets schedulers (scheduling edit) insert.
import { changeOf, snapshotOf, type ShiftSnapshot } from "./shift-change.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** The scheduled_shifts columns a change snapshot keeps. */
export const SNAPSHOT_COLUMNS =
  "staff_id, starts_at, ends_at, status, published, service_code, team_id, client_id";

type SnapshotRow = Parameters<typeof snapshotOf>[0];

/** The shift as it stands, for the "before" of a change; null when it doesn't exist. */
export async function loadSnapshot(
  db: Db,
  orgId: string,
  shiftId: string,
): Promise<ShiftSnapshot | null> {
  const { data, error } = await db
    .from("scheduled_shifts")
    .select(SNAPSHOT_COLUMNS)
    .eq("id", shiftId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? snapshotOf(data as SnapshotRow) : null;
}

/**
 * How a change was made. A hold-over (escalation-answer.server.ts) is kind
 * 'holdover' with its reason. `told`: the change was made by the only person
 * it affects (Take it, Stay), so it is recorded as already sent and seen.
 */
export type ChangeOpts = { kind?: "edit" | "holdover"; reason?: string | null; told?: boolean };

/**
 * Saves the change between `before` and the row as written (`after`), if it
 * is one, and returns its id. A failed insert throws: the edit is saved, but
 * staff would not hear about it, so the scheduler is told.
 */
export async function recordShiftChange(
  db: Db,
  orgId: string,
  userId: string,
  shiftId: string,
  before: ShiftSnapshot | null,
  after: SnapshotRow,
  opts: ChangeOpts = {},
): Promise<string | null> {
  if (!before) return null;
  const next = snapshotOf(after);
  const change = changeOf(before, next);
  if (!change) return null;
  const { data, error } = await db
    .from("shift_changes")
    .insert({
      organization_id: orgId,
      shift_id: shiftId,
      affected_staff_ids: change.affected,
      before,
      after: next,
      changed_by: userId,
      kind: opts.kind ?? "edit",
      reason: opts.reason ?? null,
      ...(opts.told ? { sent_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error)
    throw new Error(
      `The shift was saved, but its change record wasn't (${error.message}). Make the change again or tell the person yourself.`,
    );
  if (opts.told && change.affected.length) {
    const { error: aErr } = await db.from("shift_change_acks").upsert(
      change.affected.map((staff_id) => ({
        change_id: data.id,
        staff_id,
        organization_id: orgId,
      })),
      { onConflict: "change_id,staff_id", ignoreDuplicates: true },
    );
    if (aErr) console.error(`[shift-change] ack insert failed: ${aErr.message}`);
  }
  return data.id as string;
}
