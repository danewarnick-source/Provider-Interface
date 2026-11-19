// Moves escalation ladders forward (escalation.ts decides; this writes). Each
// ask is a callout_escalation_events row plus a push (notifications type
// 'escalation', related_type 'shift_escalation'); "no one available" also
// tells the owner(s). Called by startEscalation (escalation.functions.ts),
// a "Can't" (escalation-answer.server.ts) and the scheduler tick
// (/api/public/hooks/scheduler-tick: runEscalations, every agency, which
// also starts ladders by itself inside the urgent window). Service role;
// callers check access. Rerunning gives the same result: the events are the
// record of what was asked.
import {
  currentRun,
  encodeEvent,
  nextEscalationStep,
  runEnd,
  shouldAutoStart,
  type LadderEvent,
  type LadderStep,
} from "./escalation.ts";
import { askNotice, finishedNotice } from "./escalation-view.ts";
import {
  ESC_SHIFT_COLUMNS,
  loadEscSettings,
  loadLadderEvents,
  loadLadderFacts,
  type EscShift,
  type LadderFacts,
} from "./escalation-load.server.ts";
import { notify } from "./notify.ts";
import { rows } from "./rule-staff-facts.server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const ESCALATION_NOTICE = { type: "escalation", related_type: "shift_escalation" };

async function insertEvents(
  admin: Db,
  s: EscShift,
  list: ReturnType<typeof encodeEvent>[],
): Promise<string> {
  const { data, error } = await admin
    .from("callout_escalation_events")
    .insert(
      list.map((e) => ({
        ...e,
        organization_id: s.organization_id,
        scheduled_shift_id: s.id,
      })),
    )
    .select("created_at");
  if (error) throw new Error(`The escalation step wasn't saved (${error.message}).`);
  return (data?.[0]?.created_at as string) ?? new Date().toISOString();
}

/** Does what one step says: ask, or end the run. Wait and idle write nothing. */
async function applyStep(admin: Db, s: EscShift, facts: LadderFacts, step: LadderStep) {
  if (step.kind === "ask") {
    const text = askNotice(s, step.rung, facts.place);
    const sent = await Promise.all(
      step.targets.map((id) =>
        notify(admin, {
          organization_id: s.organization_id,
          ...ESCALATION_NOTICE,
          ...text,
          recipient_role: "staff",
          recipient_user_id: id,
          urgency: "urgent",
          link_to: "/dashboard/schedule",
          related_id: s.id,
        }),
      ),
    );
    await insertEvents(
      admin,
      s,
      step.targets.map((userId, i) =>
        encodeEvent({ kind: "asked", rung: step.rung, userId, failed: !sent[i] }),
      ),
    );
    return;
  }
  if (step.kind !== "end") return;
  if (step.why === "covered") {
    const why = s.status === "cancelled" ? "Shift cancelled." : "The shift has a person.";
    await insertEvents(admin, s, [encodeEvent({ kind: "covered", detail: why })]);
    return;
  }
  await insertEvents(admin, s, [encodeEvent({ kind: "finished" })]);
  await notify(
    admin,
    facts.candidates.owners.map((id) => ({
      organization_id: s.organization_id,
      type: ESCALATION_NOTICE.type,
      related_type: "shift_escalation_finished",
      ...finishedNotice(s, facts.place),
      recipient_role: "admin",
      recipient_user_id: id,
      urgency: "urgent",
      link_to: "/dashboard/scheduler/needs?kind=open",
      related_id: s.id,
    })),
  );
}

export type AdvanceOpts = {
  /** Start a new run now (Start escalation); `by` is who pressed it. */
  start?: { by: string };
  /** Start a run where shouldAutoStart says so (the tick). */
  auto?: boolean;
  now?: Date;
};

/** Moves each shift's ladder one step if it's due. Returns each shift's step. */
export async function advanceEscalations(
  admin: Db,
  shifts: readonly EscShift[],
  opts: AdvanceOpts = {},
): Promise<Map<string, LadderStep>> {
  const now = opts.now ?? new Date();
  const out = new Map<string, LadderStep>();
  if (!shifts.length) return out;
  const orgIds = [...new Set(shifts.map((s) => s.organization_id))];
  const [settings, events] = await Promise.all([
    loadEscSettings(admin, orgIds),
    loadLadderEvents(
      admin,
      shifts.map((s) => s.id),
    ),
  ]);
  const starts = (s: EscShift) =>
    !!opts.start ||
    (!!opts.auto &&
      shouldAutoStart(
        s,
        events.get(s.id) ?? [],
        settings.get(s.organization_id)!.urgentHours,
        now,
      ));
  const running = (s: EscShift) => {
    const run = currentRun(events.get(s.id) ?? []);
    return !!run && !runEnd(run);
  };
  const active = shifts.filter((s) => starts(s) || running(s));
  const facts = await loadLadderFacts(admin, active, now);
  for (const s of shifts) {
    if (!facts.has(s.id)) {
      out.set(s.id, { kind: "idle" });
      continue;
    }
    const set = settings.get(s.organization_id)!;
    let ev: LadderEvent[] = events.get(s.id) ?? [];
    const by = opts.start?.by ?? null;
    if (starts(s)) {
      const at = await insertEvents(admin, s, [
        encodeEvent({
          kind: "started",
          by,
          detail: by ? "Started by hand." : "Started automatically.",
        }),
      ]);
      ev = [...ev, { kind: "started", at, by }];
    }
    const f = facts.get(s.id)!;
    const step = nextEscalationStep({
      shift: s,
      events: ev,
      waits: set.waits,
      holdoverAsk: set.holdoverAsk,
      candidates: f.candidates,
      now,
    });
    try {
      await applyStep(admin, s, f, step);
    } catch (e) {
      // One agency's failure doesn't stop the others' ladders.
      if (!opts.auto) throw e;
      console.error(`[escalation] ${s.id}: ${e instanceof Error ? e.message : "failed"}`);
    }
    out.set(s.id, step);
  }
  return out;
}

export async function loadEscShift(admin: Db, orgId: string, shiftId: string): Promise<EscShift> {
  const { data, error } = await admin
    .from("scheduled_shifts")
    .select(ESC_SHIFT_COLUMNS)
    .eq("id", shiftId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That shift no longer exists.");
  return data as EscShift;
}

/** Longest urgent window an agency can set (B2: 1–24 h). */
const MAX_URGENT_HOURS = 24;
/** Ladders with an event this recent are checked even if the shift has a person now. */
const RECENT_HOURS = 48;

/**
 * The scheduler tick's half: every open, published shift that starts within
 * the longest urgent window (each agency's own window decides), plus every
 * shift with a recent ladder event (so a covered shift's run is closed).
 */
export async function runEscalations(
  admin: Db,
  now = new Date(),
): Promise<{ checked: number; asked: number; ended: number }> {
  const t = now.getTime();
  const [open, recent] = await Promise.all([
    rows<EscShift>(
      admin
        .from("scheduled_shifts")
        .select(ESC_SHIFT_COLUMNS)
        .eq("published", true)
        .eq("status", "open")
        .is("staff_id", null)
        .lte("starts_at", new Date(t + MAX_URGENT_HOURS * 3_600_000).toISOString())
        .gt("ends_at", now.toISOString()),
    ),
    rows<{ scheduled_shift_id: string }>(
      admin
        .from("callout_escalation_events")
        .select("scheduled_shift_id")
        .not("scheduled_shift_id", "is", null)
        .gte("created_at", new Date(t - RECENT_HOURS * 3_600_000).toISOString()),
    ),
  ]);
  const have = new Set(open.map((s) => s.id));
  const more = [...new Set(recent.map((r) => r.scheduled_shift_id))].filter((id) => !have.has(id));
  const extra = more.length
    ? await rows<EscShift>(admin.from("scheduled_shifts").select(ESC_SHIFT_COLUMNS).in("id", more))
    : [];
  const steps = await advanceEscalations(admin, [...open, ...extra], { auto: true, now });
  const list = [...steps.values()];
  return {
    checked: list.length,
    asked: list.filter((s) => s.kind === "ask").length,
    ended: list.filter((s) => s.kind === "end").length,
  };
}
