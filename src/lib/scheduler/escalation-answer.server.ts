// A person answers an escalation ask from My Schedule (escalation-staff.functions.ts):
// Take it puts them on the open shift through the rule engine
// (shift-guard.server.ts, then claim_open_shift_first so only one person can
// win); Stay moves the end of their own shift to the open shift's end through
// the rule engine, cancels the open shift (covered) and records a hold-over
// (shift_changes kind 'holdover' with its reason); Can't records the answer and
// moves the ladder on at once. Service role, after checking that this person
// was asked in the ladder that is still running. Staff can't write shifts
// under RLS, so this is the only path that lets them.
import { currentRun, encodeEvent, needsPerson, runEnd, type LadderEvent } from "./escalation.ts";
import { advanceEscalations, loadEscShift } from "./escalation.server.ts";
import { loadLadderEvents, type EscShift } from "./escalation-load.server.ts";
import { fmtClock } from "./board-model.ts";
import { HOLDOVER_REASON } from "./holdover.ts";
import { guardShiftRows, SHIFT_COLUMNS } from "./shift-guard.server.ts";
import { recordShiftChange, SNAPSHOT_COLUMNS } from "./shift-change.server.ts";
import { snapshotOf } from "./shift-change.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type Answer = "yes" | "no";
const COVERED = "Already covered: someone else has this shift now.";

/** This person's unanswered ask in the running ladder, or why there isn't one. */
export function openAsk(events: readonly LadderEvent[], userId: string) {
  const run = currentRun(events);
  if (!run || runEnd(run)) return null;
  const asks = run.filter(
    (e): e is Extract<LadderEvent, { kind: "asked" }> => e.kind === "asked" && e.userId === userId,
  );
  const answered = run.some((e) => e.kind === "answered" && e.userId === userId);
  return asks.length && !answered ? asks[asks.length - 1]! : null;
}

async function record(admin: Db, s: EscShift, e: Parameters<typeof encodeEvent>[0]) {
  const { error } = await admin
    .from("callout_escalation_events")
    .insert({ ...encodeEvent(e), organization_id: s.organization_id, scheduled_shift_id: s.id });
  if (error) throw new Error(`Your answer wasn't saved (${error.message}). Try again.`);
}

async function takeIt(admin: Db, s: EscShift, userId: string) {
  const warnings = await guardShiftRows(admin, s.organization_id, [{ ...s, staff_id: userId }]);
  const { data: ok, error } = await admin.rpc("claim_open_shift_first", {
    _shift: s.id,
    _staff: userId,
  });
  if (error) throw new Error(error.message);
  if (!ok) throw new Error(COVERED);
  const after = await admin
    .from("scheduled_shifts")
    .select(SNAPSHOT_COLUMNS)
    .eq("id", s.id)
    .single();
  if (after.error) throw new Error(after.error.message);
  await recordShiftChange(admin, s.organization_id, userId, s.id, snapshotOf(s), after.data, {
    told: true,
  });
  return { warnings, endsAt: s.ends_at };
}

async function stay(admin: Db, s: EscShift, userId: string) {
  const { data: mine, error } = await admin
    .from("scheduled_shifts")
    .select(`${SHIFT_COLUMNS}, published, override_reason`)
    .eq("organization_id", s.organization_id)
    .eq("staff_id", userId)
    .eq("ends_at", s.starts_at)
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);
  // Same rule as holdoverCandidates: the same home or the same client.
  const own = ((mine ?? []) as Array<EscShift & { override_reason: string | null }>).find(
    (x) =>
      (!!s.team_id && x.team_id === s.team_id) || (!!s.client_id && x.client_id === s.client_id),
  );
  if (!own) throw new Error("Your shift before this one wasn't found, so it can't be extended.");
  const warnings = await guardShiftRows(
    admin,
    s.organization_id,
    [{ ...own, ends_at: s.ends_at }],
    { reason: HOLDOVER_REASON },
  );
  // The open shift is covered by the hold-over; it stays on record, cancelled.
  const { data: cur } = await admin
    .from("scheduled_shifts")
    .select("notes")
    .eq("id", s.id)
    .single();
  const notes = (cur?.notes as string | null) ?? null;
  const cancelled = await admin
    .from("scheduled_shifts")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      notes: `${notes ? `${notes}\n` : ""}Covered by a hold-over.`,
    })
    .eq("id", s.id)
    .eq("status", "open")
    .is("staff_id", null)
    .select(SNAPSHOT_COLUMNS);
  if (cancelled.error) throw new Error(cancelled.error.message);
  if (!cancelled.data?.length) throw new Error(COVERED);
  const extended = await admin
    .from("scheduled_shifts")
    .update({ ends_at: s.ends_at, override_reason: own.override_reason ?? HOLDOVER_REASON })
    .eq("id", own.id)
    .eq("ends_at", own.ends_at)
    .select(SNAPSHOT_COLUMNS);
  if (extended.error || !extended.data?.length) {
    await admin
      .from("scheduled_shifts")
      .update({ status: "open", cancelled_at: null, notes })
      .eq("id", s.id);
    throw new Error("Your shift changed while you answered. Reload and try again.");
  }
  await recordShiftChange(
    admin,
    s.organization_id,
    userId,
    own.id,
    snapshotOf(own),
    extended.data[0],
    {
      kind: "holdover",
      reason: HOLDOVER_REASON,
      told: true,
    },
  );
  await recordShiftChange(
    admin,
    s.organization_id,
    userId,
    s.id,
    snapshotOf(s),
    cancelled.data[0],
    {
      told: true,
    },
  );
  return { warnings, endsAt: s.ends_at };
}

export async function answerAsk(
  admin: Db,
  orgId: string,
  shiftId: string,
  userId: string,
  answer: Answer,
): Promise<{ warnings: string[]; endsAt: string | null }> {
  const s = await loadEscShift(admin, orgId, shiftId);
  const events = (await loadLadderEvents(admin, [s.id])).get(s.id) ?? [];
  const ask = openAsk(events, userId);
  if (!ask) throw new Error("This ask is over. Nothing to answer.");
  if (answer === "no") {
    await record(admin, s, {
      kind: "answered",
      rung: ask.rung,
      userId,
      yes: false,
      detail: "Can't",
    });
    await advanceEscalations(admin, [s]);
    return { warnings: [], endsAt: null };
  }
  if (!needsPerson(s)) throw new Error(COVERED);
  const done =
    ask.rung === "holdover" ? await stay(admin, s, userId) : await takeIt(admin, s, userId);
  await record(admin, s, {
    kind: "answered",
    rung: ask.rung,
    userId,
    yes: true,
    detail: ask.rung === "holdover" ? `Stayed until ${fmtClock(s.ends_at)}` : "Took it",
  });
  return done;
}
