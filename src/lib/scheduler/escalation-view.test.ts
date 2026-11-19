import test from "node:test";
import assert from "node:assert/strict";
import { nextEscalationStep, type LadderEvent, type LadderInput } from "./escalation.ts";
import {
  askCard,
  askedLines,
  askNotice,
  escalationView,
  finishedNotice,
} from "./escalation-view.ts";

// Thu Nov 19 2026, 3p–11p Denver. Times below are Denver: 21:41Z = 2:41 PM.
const shift = {
  starts_at: "2026-11-19T22:00:00.000Z",
  ends_at: "2026-11-20T06:00:00.000Z",
  staff_id: null,
  status: "open",
  published: true,
  service_code: "sln",
};
const NAMES: Record<string, string> = { maria: "Maria", omar: "Omar", dane: "Dane", ben: "Ben" };
const names = (id: string | null) => (id ? (NAMES[id] ?? "Someone") : "Someone");
const input = (events: LadderEvent[], now: string, o: Partial<LadderInput> = {}): LadderInput => ({
  shift,
  events,
  waits: [15, 15, 10],
  holdoverAsk: true,
  candidates: { lead: "maria", oncall: [], owners: ["dane"], holdover: ["ben"] },
  now: new Date(now),
  ...o,
});
const view = (events: LadderEvent[], now: string, o: Partial<LadderInput> = {}) =>
  escalationView(events, nextEscalationStep(input(events, now, o)), names);

const started: LadderEvent = { kind: "started", at: "2026-11-19T21:40:00.000Z", by: "dane" };
const askedMaria: LadderEvent = {
  kind: "asked",
  at: "2026-11-19T21:41:00.000Z",
  rung: "lead",
  userId: "maria",
  failed: false,
};

test("Needs you line: who was asked, when, and who's next", () => {
  assert.deepEqual(view([started, askedMaria], "2026-11-19T21:45:00.000Z"), {
    state: "running",
    line: "Asked Maria (lead) 2:41 PM · owner next at 2:56 PM",
  });
  assert.deepEqual(
    view([started, askedMaria], "2026-11-19T21:45:00.000Z", {
      candidates: { lead: "maria", oncall: ["omar"], owners: ["dane"], holdover: [] },
    }).line,
    "Asked Maria (lead) 2:41 PM · on-call next at 2:56 PM",
  );
  assert.equal(view([], "2026-11-19T21:45:00.000Z").state, "none");
});

test("Needs you line: stopped, finished, and covered", () => {
  const stop: LadderEvent = { kind: "stopped", at: "2026-11-19T21:50:00.000Z", by: "dane" };
  assert.deepEqual(view([started, askedMaria, stop], "2026-11-19T21:55:00.000Z"), {
    state: "stopped",
    line: "Escalation stopped 2:50 PM",
  });
  const done: LadderEvent = { kind: "finished", at: "2026-11-19T22:30:00.000Z" };
  assert.deepEqual(view([started, done], "2026-11-19T22:35:00.000Z"), {
    state: "finished",
    line: "No one available · escalation finished",
  });
  const took: LadderEvent = {
    kind: "answered",
    at: "2026-11-19T21:44:00.000Z",
    rung: "lead",
    userId: "maria",
    yes: true,
    detail: "Took it",
  };
  assert.equal(view([started, askedMaria, took], "2026-11-19T21:45:00.000Z").state, "none");
});

test("drawer: every step with its time and answer", () => {
  const cant: LadderEvent = {
    kind: "answered",
    at: "2026-11-19T21:43:00.000Z",
    rung: "lead",
    userId: "maria",
    yes: false,
    detail: "Can't",
  };
  const owner: LadderEvent = {
    kind: "asked",
    at: "2026-11-19T21:43:30.000Z",
    rung: "owner",
    userId: "dane",
    failed: false,
  };
  const lines = askedLines([started, askedMaria, cant, owner], names);
  assert.deepEqual(
    lines.map((l) => [l.text, l.answer]),
    [
      ["Started by Dane", ""],
      ["Maria (lead)", "Can't"],
      ["Dane (owner)", "No answer yet"],
    ],
  );
});

test("texts name the code, day, time and home, never a client", () => {
  assert.deepEqual(askNotice(shift, "lead", "Maple House"), {
    title: "Can you cover a shift?",
    body: "Can you cover SLN Thu, Nov 19 · 3p–11p at Maple House? Open My Schedule to take it.",
  });
  assert.match(askNotice(shift, "holdover", "").body, /Can you stay until 11p\?/);
  assert.match(finishedNotice(shift, "").body, /^No one took SLN Thu, Nov 19 · 3p–11p\./);
  assert.deepEqual(askCard(shift, "owner", "Maple House"), {
    title: "Can you cover Thu 3p–11p at Maple House?",
    detail: "SLN · Thu, Nov 19 · 3p–11p",
    yes: "Take it",
  });
  assert.equal(askCard(shift, "holdover", "").yes, "Stay until 11p");
});
