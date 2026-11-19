// The escalation ladder (Decision 7, ESCALATION-PLAN.md). Pure. When an open,
// published shift has no one on it, the platform asks, in order: the home's
// lead, whoever is on call, the owner(s), then (if "Ask someone to stay" is
// on) the people whose shift ends when this one starts, one at a time. Each
// step waits its B2 minutes; a "Can't" from everyone asked at a step moves on
// at once. It ends when the shift has a person, someone stops it, or no one
// is left ("finished").
// The record is callout_escalation_events (rows with scheduled_shift_id). Its
// outcome CHECK allows only sent / acknowledged / no_response / failed, so
// each ladder event is stored as (channel, target_role, outcome); encodeEvent
// and decodeEvent below are the one place that mapping lives.
// Callers: escalation.server.ts (start, advance, the scheduler tick),
// escalation-answer.server.ts (Take it / Stay / Can't), escalation-view.ts.

export type Rung = "lead" | "oncall" | "owner" | "holdover";
export const RUNGS: readonly Rung[] = ["lead", "oncall", "owner", "holdover"];
export const RUNG_LABEL: Record<Rung, string> = {
  lead: "lead",
  oncall: "on-call",
  owner: "owner",
  holdover: "asked to stay",
};
const RUNG_STEP: Record<Rung, number> = { lead: 1, oncall: 2, owner: 3, holdover: 4 };
const DEFAULT_WAIT = 15;

export type LadderEvent =
  | { kind: "started"; at: string; by: string | null }
  | { kind: "asked"; at: string; rung: Rung; userId: string; failed: boolean }
  | {
      kind: "answered";
      at: string;
      rung: Rung;
      userId: string;
      yes: boolean;
      detail: string | null;
    }
  | { kind: "stopped"; at: string; by: string | null }
  | { kind: "covered"; at: string }
  | { kind: "finished"; at: string };

/** The columns of callout_escalation_events a ladder event reads and writes. */
export type EventRow = {
  step: number;
  channel: string;
  target_role: string | null;
  target_user_id: string | null;
  outcome: string;
  detail: string | null;
  created_at: string;
};
export type EventInsert = Omit<EventRow, "created_at">;

const SYSTEM: Record<string, "started" | "stopped" | "covered" | "finished"> = {
  start: "started",
  stop: "stopped",
  covered: "covered",
  finished: "finished",
};
const isRung = (v: string | null): v is Rung => !!v && (RUNGS as string[]).includes(v);

/** A row as a ladder event; null for call-out rows that aren't part of a ladder. */
export function decodeEvent(r: EventRow): LadderEvent | null {
  const at = r.created_at;
  if (r.channel === "system") {
    const kind = SYSTEM[r.target_role ?? ""];
    if (kind === "started" || kind === "stopped") return { kind, at, by: r.target_user_id };
    return kind ? { kind, at } : null;
  }
  if (!isRung(r.target_role) || !r.target_user_id) return null;
  if (r.channel === "push")
    return {
      kind: "asked",
      at,
      rung: r.target_role,
      userId: r.target_user_id,
      failed: r.outcome === "failed",
    };
  if (r.channel === "in_app")
    return {
      kind: "answered",
      at,
      rung: r.target_role,
      userId: r.target_user_id,
      yes: r.outcome === "acknowledged",
      detail: r.detail,
    };
  return null;
}

type Encodable =
  | { kind: "started" | "stopped"; by: string | null; detail?: string }
  | { kind: "covered" | "finished"; detail?: string }
  | { kind: "asked"; rung: Rung; userId: string; failed?: boolean }
  | { kind: "answered"; rung: Rung; userId: string; yes: boolean; detail: string };

/** The row to insert for a ladder event (without organization and shift). */
export function encodeEvent(e: Encodable): EventInsert {
  const base = { target_user_id: null as string | null, detail: null as string | null };
  switch (e.kind) {
    case "started":
    case "stopped":
      return {
        ...base,
        step: 0,
        channel: "system",
        target_role: e.kind === "started" ? "start" : "stop",
        target_user_id: e.by,
        outcome: e.kind === "started" ? "sent" : "acknowledged",
        detail: e.detail ?? null,
      };
    case "covered":
      return {
        ...base,
        step: 0,
        channel: "system",
        target_role: "covered",
        outcome: "acknowledged",
        detail: e.detail ?? null,
      };
    case "finished":
      return {
        ...base,
        step: 5,
        channel: "system",
        target_role: "finished",
        outcome: "no_response",
        detail: e.detail ?? "No one available.",
      };
    case "asked":
      return {
        step: RUNG_STEP[e.rung],
        channel: "push",
        target_role: e.rung,
        target_user_id: e.userId,
        outcome: e.failed ? "failed" : "sent",
        detail: null,
      };
    case "answered":
      return {
        step: RUNG_STEP[e.rung],
        channel: "in_app",
        target_role: e.rung,
        target_user_id: e.userId,
        outcome: e.yes ? "acknowledged" : "failed",
        detail: e.detail,
      };
  }
}

const ms = (iso: string) => new Date(iso).getTime();
/** Oldest first; a "started" sorts before anything written in the same instant. */
const byTime = (a: LadderEvent, b: LadderEvent) =>
  ms(a.at) - ms(b.at) || Number(b.kind === "started") - Number(a.kind === "started");

/** The events of the latest run (from its "started"), oldest first; null when never started. */
export function currentRun(events: readonly LadderEvent[]): LadderEvent[] | null {
  const sorted = [...events].sort(byTime);
  let from = -1;
  sorted.forEach((e, i) => {
    if (e.kind === "started") from = i;
  });
  return from < 0 ? null : sorted.slice(from);
}

export type RunEnd = "stopped" | "covered" | "finished";

/** How a run ended (a yes answer covers the shift); null while it runs. */
export function runEnd(run: readonly LadderEvent[]): RunEnd | null {
  for (const e of run) {
    if (e.kind === "stopped" || e.kind === "covered" || e.kind === "finished") return e.kind;
    if (e.kind === "answered" && e.yes) return "covered";
  }
  return null;
}

export type LadderShift = {
  starts_at: string;
  ends_at: string;
  staff_id: string | null;
  status: string;
  published: boolean;
  claim_requested_by?: string | null;
};

/** An open, published shift with no one on it. */
export const needsPerson = (s: LadderShift) => !s.staff_id && s.status === "open" && s.published;

export type Candidates = {
  lead: string | null;
  oncall: readonly string[];
  owners: readonly string[];
  /** Fairest first (holdover.ts holdoverCandidates). */
  holdover: readonly string[];
};

export type LadderInput = {
  shift: LadderShift;
  events: readonly LadderEvent[];
  /** Minutes at lead, on-call, owner (B2 escalation_waits). A hold-over ask waits the owner's. */
  waits: readonly number[];
  holdoverAsk: boolean;
  candidates: Candidates;
  now: Date;
};

export type Target = { rung: Rung; targets: string[] };

export type LadderStep =
  | { kind: "idle" }
  | { kind: "end"; why: "covered" | "finished" }
  | ({ kind: "ask" } & Target)
  | {
      kind: "wait";
      rung: Rung;
      asked: string[];
      askedAt: string;
      until: string;
      next: Target | null;
    };

export const waitFor = (waits: readonly number[], rung: Rung) =>
  waits[Math.min(RUNG_STEP[rung], 3) - 1] ?? DEFAULT_WAIT;

/** The first step after `after` with someone not yet asked in this run. */
function nextTarget(i: LadderInput, asked: ReadonlySet<string>, after: Rung | null): Target | null {
  const from = after === null ? 0 : after === "holdover" ? 3 : RUNGS.indexOf(after) + 1;
  const fresh = (ids: readonly (string | null)[]) =>
    [...new Set(ids)].filter((id): id is string => !!id && !asked.has(id));
  for (const rung of RUNGS.slice(from)) {
    const c = i.candidates;
    const targets =
      rung === "lead"
        ? fresh([c.lead])
        : rung === "oncall"
          ? fresh(c.oncall)
          : rung === "owner"
            ? fresh(c.owners)
            : i.holdoverAsk
              ? fresh(c.holdover).slice(0, 1)
              : [];
    if (targets.length) return { rung, targets };
  }
  return null;
}

/** What the ladder does now for one shift. Idempotent: the same events give the same step. */
export function nextEscalationStep(i: LadderInput): LadderStep {
  const run = currentRun(i.events);
  if (!run || runEnd(run)) return { kind: "idle" };
  if (!needsPerson(i.shift)) return { kind: "end", why: "covered" };
  if (i.now.getTime() >= ms(i.shift.ends_at)) return { kind: "end", why: "finished" };
  const asks = run.filter((e): e is Extract<LadderEvent, { kind: "asked" }> => e.kind === "asked");
  const asked = new Set(asks.map((a) => a.userId));
  if (!asks.length) {
    const first = nextTarget(i, asked, null);
    return first ? { kind: "ask", ...first } : { kind: "end", why: "finished" };
  }
  const last = asks[asks.length - 1]!;
  const batch = asks.filter(
    (a) => a.rung === last.rung && (last.rung !== "holdover" || a.userId === last.userId),
  );
  const saidNo = new Set(
    run
      .filter((e) => e.kind === "answered" && !e.yes && e.rung === last.rung)
      .map((e) => (e as { userId: string }).userId),
  );
  const until = new Date(ms(last.at) + waitFor(i.waits, last.rung) * 60_000);
  const next = nextTarget(i, asked, last.rung);
  if (batch.every((a) => saidNo.has(a.userId)) || i.now >= until)
    return next ? { kind: "ask", ...next } : { kind: "end", why: "finished" };
  return {
    kind: "wait",
    rung: last.rung,
    asked: batch.map((a) => a.userId),
    askedAt: last.at,
    until: until.toISOString(),
    next,
  };
}

/**
 * Should the scheduler tick start a ladder: an open, published shift with no
 * pending claim, starting within the urgent window and not over, that never
 * escalated or whose last run ended because it had a person (it's open again).
 * A run someone stopped, or one that finished with nobody, isn't restarted.
 */
export function shouldAutoStart(
  shift: LadderShift,
  events: readonly LadderEvent[],
  urgentHours: number,
  now: Date,
): boolean {
  if (!needsPerson(shift) || shift.claim_requested_by) return false;
  const t = now.getTime();
  if (ms(shift.ends_at) <= t || ms(shift.starts_at) - t > urgentHours * 3_600_000) return false;
  const run = currentRun(events);
  return !run || runEnd(run) === "covered";
}
