import test from "node:test";
import assert from "node:assert/strict";
import {
  currentRun,
  decodeEvent,
  encodeEvent,
  nextEscalationStep,
  runEnd,
  shouldAutoStart,
  type Candidates,
  type LadderEvent,
  type LadderInput,
  type LadderShift,
} from "./escalation.ts";

// Thu Nov 19 2026, 3p–11p Denver (22:00Z–06:00Z).
const shift = (o: Partial<LadderShift> = {}): LadderShift => ({
  starts_at: "2026-11-19T22:00:00.000Z",
  ends_at: "2026-11-20T06:00:00.000Z",
  staff_id: null,
  status: "open",
  published: true,
  ...o,
});
const T = (hhmm: string) => `2026-11-19T${hhmm}:00.000Z`;
const cands = (o: Partial<Candidates> = {}): Candidates => ({
  lead: "maria",
  oncall: ["omar"],
  owners: ["dane"],
  holdover: ["ben", "ava"],
  ...o,
});
const started = (at = T("20:00"), by: string | null = null): LadderEvent => ({
  kind: "started",
  at,
  by,
});
const asked = (rung: "lead" | "oncall" | "owner" | "holdover", userId: string, at: string) =>
  ({ kind: "asked", rung, userId, at, failed: false }) as LadderEvent;
const answered = (
  rung: "lead" | "oncall" | "owner" | "holdover",
  userId: string,
  yes: boolean,
  at: string,
) => ({ kind: "answered", rung, userId, yes, at, detail: null }) as LadderEvent;

const input = (o: Partial<LadderInput> = {}): LadderInput => ({
  shift: shift(),
  events: [started()],
  waits: [15, 15, 10],
  holdoverAsk: true,
  candidates: cands(),
  now: new Date(T("20:00")),
  ...o,
});

test("every ladder event survives the round trip through the table's allowed values", () => {
  const events = [
    encodeEvent({ kind: "started", by: "dane" }),
    encodeEvent({ kind: "asked", rung: "lead", userId: "maria" }),
    encodeEvent({ kind: "asked", rung: "owner", userId: "dane", failed: true }),
    encodeEvent({ kind: "answered", rung: "lead", userId: "maria", yes: false, detail: "Can't" }),
    encodeEvent({ kind: "answered", rung: "holdover", userId: "ben", yes: true, detail: "Stayed" }),
    encodeEvent({ kind: "stopped", by: "dane" }),
    encodeEvent({ kind: "covered" }),
    encodeEvent({ kind: "finished" }),
  ];
  for (const e of events) {
    assert.ok(["sent", "acknowledged", "no_response", "failed"].includes(e.outcome));
    assert.ok(["in_app", "push", "system"].includes(e.channel));
  }
  const kinds = events.map((e) => decodeEvent({ ...e, created_at: T("20:00") }));
  assert.deepEqual(
    kinds.map((k) => k?.kind),
    ["started", "asked", "asked", "answered", "answered", "stopped", "covered", "finished"],
  );
  assert.equal((kinds[2] as { failed: boolean }).failed, true);
  assert.equal((kinds[3] as { yes: boolean }).yes, false);
  assert.equal((kinds[4] as { yes: boolean }).yes, true);
  assert.equal((kinds[0] as { by: string }).by, "dane");
});

test("call-out rows (no ladder role) are not ladder events", () => {
  const row = {
    step: 1,
    channel: "in_app",
    target_role: "manager",
    target_user_id: "dane",
    outcome: "acknowledged",
    detail: null,
    created_at: T("20:00"),
  };
  assert.equal(decodeEvent(row), null);
  assert.equal(decodeEvent({ ...row, channel: "system", target_role: null }), null);
});

test("starts at the home's lead", () => {
  assert.deepEqual(nextEscalationStep(input()), { kind: "ask", rung: "lead", targets: ["maria"] });
});

test("no home, no lead: straight to on-call; no one on call: the owner", () => {
  assert.deepEqual(nextEscalationStep(input({ candidates: cands({ lead: null }) })), {
    kind: "ask",
    rung: "oncall",
    targets: ["omar"],
  });
  assert.deepEqual(nextEscalationStep(input({ candidates: cands({ lead: null, oncall: [] }) })), {
    kind: "ask",
    rung: "owner",
    targets: ["dane"],
  });
});

test("waits the lead's minutes, then asks on-call", () => {
  const events = [started(), asked("lead", "maria", T("20:01"))];
  const waiting = nextEscalationStep(input({ events, now: new Date(T("20:10")) }));
  assert.equal(waiting.kind, "wait");
  if (waiting.kind === "wait") {
    assert.equal(waiting.until, T("20:16"));
    assert.deepEqual(waiting.next, { rung: "oncall", targets: ["omar"] });
    assert.deepEqual(waiting.asked, ["maria"]);
  }
  assert.deepEqual(nextEscalationStep(input({ events, now: new Date(T("20:16")) })), {
    kind: "ask",
    rung: "oncall",
    targets: ["omar"],
  });
});

test("a Can't moves on at once", () => {
  const events = [
    started(),
    asked("lead", "maria", T("20:01")),
    answered("lead", "maria", false, T("20:02")),
  ];
  assert.deepEqual(nextEscalationStep(input({ events, now: new Date(T("20:03")) })), {
    kind: "ask",
    rung: "oncall",
    targets: ["omar"],
  });
});

test("everyone at a step must say Can't before it moves on early", () => {
  const events = [
    started(),
    asked("owner", "dane", T("20:01")),
    asked("owner", "kim", T("20:01")),
    answered("owner", "dane", false, T("20:02")),
  ];
  const c = cands({ lead: null, oncall: [], owners: ["dane", "kim"] });
  assert.equal(
    nextEscalationStep(input({ events, candidates: c, now: new Date(T("20:03")) })).kind,
    "wait",
  );
});

test("hold-overs are asked one at a time, fairest first, then it finishes", () => {
  const base = [
    started(),
    asked("lead", "maria", T("20:00")),
    asked("oncall", "omar", T("20:15")),
    asked("owner", "dane", T("20:30")),
  ];
  const now = (t: string) => new Date(T(t));
  assert.deepEqual(nextEscalationStep(input({ events: base, now: now("20:40") })), {
    kind: "ask",
    rung: "holdover",
    targets: ["ben"],
  });
  const benAsked = [...base, asked("holdover", "ben", T("20:40"))];
  assert.deepEqual(nextEscalationStep(input({ events: benAsked, now: now("20:50") })), {
    kind: "ask",
    rung: "holdover",
    targets: ["ava"],
  });
  const both = [...benAsked, asked("holdover", "ava", T("20:50"))];
  assert.deepEqual(nextEscalationStep(input({ events: both, now: now("21:00") })), {
    kind: "end",
    why: "finished",
  });
});

test("with Ask someone to stay off, it finishes after the owner", () => {
  const events = [started(), asked("owner", "dane", T("20:00"))];
  const c = cands({ lead: null, oncall: [] });
  assert.deepEqual(
    nextEscalationStep(
      input({ events, candidates: c, holdoverAsk: false, now: new Date(T("20:10")) }),
    ),
    { kind: "end", why: "finished" },
  );
});

test("someone already asked as lead isn't asked again as owner", () => {
  const events = [started(), asked("lead", "dane", T("20:00"))];
  const c = cands({ lead: "dane", oncall: [], owners: ["dane"], holdover: [] });
  assert.deepEqual(
    nextEscalationStep(input({ events, candidates: c, now: new Date(T("20:15")) })),
    {
      kind: "end",
      why: "finished",
    },
  );
});

test("a shift with a person ends the run; the run's end makes it idle", () => {
  const events = [started(), asked("lead", "maria", T("20:00"))];
  assert.deepEqual(
    nextEscalationStep(input({ events, shift: shift({ staff_id: "x", status: "accepted" }) })),
    {
      kind: "end",
      why: "covered",
    },
  );
  const took = [...events, answered("lead", "maria", true, T("20:05"))];
  assert.equal(runEnd(currentRun(took)!), "covered");
  assert.deepEqual(nextEscalationStep(input({ events: took })), { kind: "idle" });
  const stopped: LadderEvent[] = [...events, { kind: "stopped", at: T("20:05"), by: "dane" }];
  assert.deepEqual(nextEscalationStep(input({ events: stopped })), { kind: "idle" });
  assert.deepEqual(nextEscalationStep(input({ events: [] })), { kind: "idle" });
});

test("once the shift is over with no one, the run finishes", () => {
  const events = [started(), asked("lead", "maria", T("20:00"))];
  assert.deepEqual(
    nextEscalationStep(input({ events, now: new Date("2026-11-20T06:00:00.000Z") })),
    {
      kind: "end",
      why: "finished",
    },
  );
});

test("a new run starts fresh: earlier asks don't count", () => {
  const events: LadderEvent[] = [
    started(T("18:00")),
    asked("lead", "maria", T("18:00")),
    { kind: "covered", at: T("18:10") },
    started(T("20:00")),
  ];
  assert.deepEqual(nextEscalationStep(input({ events })), {
    kind: "ask",
    rung: "lead",
    targets: ["maria"],
  });
});

test("a start and an ask written in the same instant stay in one run", () => {
  const events = [asked("lead", "maria", T("20:00")), started(T("20:00"))];
  assert.equal(currentRun(events)!.length, 2);
});

test("starts by itself inside the urgent window, once", () => {
  const now = new Date(T("18:30")); // 3.5 h before 3p Denver
  assert.equal(shouldAutoStart(shift(), [], 4, now), true);
  assert.equal(shouldAutoStart(shift(), [], 2, now), false);
  assert.equal(shouldAutoStart(shift({ published: false }), [], 4, now), false);
  assert.equal(shouldAutoStart(shift({ claim_requested_by: "x" }), [], 4, now), false);
  assert.equal(shouldAutoStart(shift({ staff_id: "x", status: "accepted" }), [], 4, now), false);
  assert.equal(shouldAutoStart(shift(), [started(T("18:00"))], 4, now), false);
  const stopped: LadderEvent[] = [
    started(T("18:00")),
    { kind: "stopped", at: T("18:05"), by: "d" },
  ];
  assert.equal(shouldAutoStart(shift(), stopped, 4, now), false);
  const finished: LadderEvent[] = [started(T("18:00")), { kind: "finished", at: T("18:05") }];
  assert.equal(shouldAutoStart(shift(), finished, 4, now), false);
  const covered: LadderEvent[] = [started(T("18:00")), { kind: "covered", at: T("18:05") }];
  assert.equal(shouldAutoStart(shift(), covered, 4, now), true);
  assert.equal(shouldAutoStart(shift(), [], 4, new Date("2026-11-20T06:00:00.000Z")), false);
});
