import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dailyLogProgram,
  dailyNoteGapsFor,
  hostedDailyNoteDays,
  isHostHomeProviderPosition,
  missingDailyNotes,
  type DailyNoteAssignment,
} from "./daily-log-missing.ts";

const BLAKE = { id: "blake", name: "Blake" };
const DATES = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"];
const HOST = "harvey";
const RESPITE = "jake";

const assign = (
  staffId: string,
  isHost: boolean,
  startDate = "2026-01-01",
): DailyNoteAssignment => ({
  clientId: BLAKE.id,
  staffId,
  startDate,
  isHost,
});

describe("dailyLogProgram / host position", () => {
  it("HHS and RP5 are daily-note programs", () => {
    assert.equal(dailyLogProgram({ codes: ["HHS"] }), "HHS");
    assert.equal(dailyLogProgram({ codes: ["RP5", "SLN"] }), "RP5");
    assert.equal(dailyLogProgram({ codes: ["SLN"] }), null);
    assert.equal(dailyLogProgram({ codes: null }), null);
  });

  it("Host Home Provider by key or label", () => {
    assert.equal(isHostHomeProviderPosition({ key: "hhp", label: "x" }), true);
    assert.equal(isHostHomeProviderPosition({ key: "x", label: "Host Home Provider" }), true);
    assert.equal(
      isHostHomeProviderPosition({ key: "dsp", label: "Direct Support Professional" }),
      false,
    );
  });
});

describe("missingDailyNotes", () => {
  it("two staff on one HHS client: one gap per day, owned by the host only", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign(HOST, true), assign(RESPITE, false)],
      notes: [],
      dates: DATES,
    });
    assert.equal(gaps.length, 4);
    for (const g of gaps) assert.deepEqual(g.hostStaffIds, [HOST]);
    assert.equal(dailyNoteGapsFor(gaps, HOST).length, 4);
    assert.equal(dailyNoteGapsFor(gaps, RESPITE).length, 0);
  });

  it("a note by the host meets that day", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign(HOST, true), assign(RESPITE, false)],
      notes: [{ client_id: BLAKE.id, log_date: "2026-09-28", user_id: HOST }],
      dates: DATES,
    });
    assert.deepEqual(
      gaps.map((g) => g.date),
      ["2026-09-26", "2026-09-27", "2026-09-29"],
    );
  });

  it("a note by a respite worker meets that day for the host too", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign(HOST, true), assign(RESPITE, false)],
      notes: [{ client_id: BLAKE.id, log_date: "2026-09-29", user_id: RESPITE }],
      dates: DATES,
    });
    assert.deepEqual(
      dailyNoteGapsFor(gaps, HOST).map((g) => g.date),
      ["2026-09-26", "2026-09-27", "2026-09-28"],
    );
  });

  it("a note by someone not assigned to the client doesn't count", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign(HOST, true)],
      notes: [{ client_id: BLAKE.id, log_date: "2026-09-29", user_id: "stranger" }],
      dates: DATES,
    });
    assert.equal(gaps.length, 4);
  });

  it("days before the assignment's start date don't count", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign(HOST, true, "2026-09-28")],
      notes: [],
      dates: DATES,
    });
    assert.deepEqual(
      gaps.map((g) => g.date),
      ["2026-09-28", "2026-09-29"],
    );
    assert.deepEqual(
      hostedDailyNoteDays({
        clients: [BLAKE],
        assignments: [assign(HOST, true, "2026-09-28")],
        dates: DATES,
        staffId: HOST,
      }).map((d) => d.date),
      ["2026-09-28", "2026-09-29"],
    );
  });

  it("a host who starts later owns only their days; earlier days are the client's", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign(RESPITE, false, "2026-09-26"), assign(HOST, true, "2026-09-28")],
      notes: [],
      dates: DATES,
    });
    assert.deepEqual(
      gaps.map((g) => [g.date, g.hostStaffIds]),
      [
        ["2026-09-26", []],
        ["2026-09-27", []],
        ["2026-09-28", [HOST]],
        ["2026-09-29", [HOST]],
      ],
    );
  });

  it("no host: the gap is the client's, never every assigned staff member's", () => {
    const gaps = missingDailyNotes({
      clients: [BLAKE],
      assignments: [assign("a", false), assign("b", false)],
      notes: [],
      dates: DATES,
    });
    assert.equal(gaps.length, 4);
    for (const g of gaps) assert.deepEqual(g.hostStaffIds, []);
    assert.equal(dailyNoteGapsFor(gaps, "a").length, 0);
    assert.equal(dailyNoteGapsFor(gaps, "b").length, 0);
  });

  it("an unassigned client has no gaps", () => {
    assert.deepEqual(
      missingDailyNotes({ clients: [BLAKE], assignments: [], notes: [], dates: DATES }),
      [],
    );
  });
});
