import test from "node:test";
import assert from "node:assert/strict";
import type { BoardShift } from "./board-model.ts";
import { approvalHome } from "./needs-approvers.ts";
import { cardFindings } from "./needs-cards.ts";
import { needsSummary } from "./needs-items.ts";
import { buildNeeds, type NeedsInput } from "./needs-list.ts";

// "Now" is Tue Nov 17 2026, 3:00p Denver (22:00Z). The week is Sun Nov 15 – Sat Nov 21.
const NOW = new Date("2026-11-17T22:00:00.000Z");
const WEEK = ["15", "16", "17", "18", "19", "20", "21"].map((d) => `2026-11-${d}`);

const shift = (id: string, o: Partial<BoardShift> = {}): BoardShift => ({
  id,
  staff_id: "nora",
  client_id: null,
  team_id: "maple",
  service_code: "RHS",
  starts_at: "2026-11-19T14:00:00.000Z", // Thu 7a
  ends_at: "2026-11-19T22:00:00.000Z",
  status: "published",
  published: true,
  parent_shift_id: null,
  open_spots: null,
  override_reason: null,
  shift_type: "hourly",
  notes: null,
  claim_requested_by: null,
  ...o,
});

const maple = approvalHome(
  { id: "maple", team_name: "Maple House", team_type: "rhs_home", manager_id: "lead" },
  null,
);

function input(o: Partial<NeedsInput> = {}): NeedsInput {
  return {
    now: NOW,
    week: WEEK,
    openUntil: "2026-11-29",
    viewer: {
      userId: "lead",
      isOwner: false,
      isAgencyAdmin: false,
      canEditScheduling: true,
      canEditTimesheets: true,
    },
    shifts: [],
    staff: new Map([
      ["nora", { name: "Nora Diaz", phone: "801-555-0101" }],
      ["ava", { name: "Ava Lin", phone: null }],
    ]),
    teams: new Map([["maple", { name: "Maple House" }]]),
    clients: new Map([["c1", { name: "Riley H", team_id: "maple" }]]),
    homes: new Map([["maple", maple]]),
    punches: [],
    callouts: [],
    swaps: [],
    timeOff: [],
    punchFixes: [],
    cards: [],
    outlook: [],
    otHours: 40,
    offers: new Map(),
    asked: new Map(),
    reminded: new Map(),
    ...o,
  };
}

test("late and missed rows; a call-out replaces the late row for its shift", () => {
  const late = shift("late", {
    starts_at: "2026-11-17T21:30:00.000Z",
    ends_at: "2026-11-18T05:00:00.000Z",
  });
  const missed = shift("missed", {
    starts_at: "2026-11-17T14:00:00.000Z",
    ends_at: "2026-11-17T20:00:00.000Z",
    client_id: "c1",
    team_id: null,
    service_code: "SLN",
  });
  const items = buildNeeds(input({ shifts: [late, missed] }));
  assert.deepEqual(
    items.map((i) => i.kind),
    ["missed", "late"],
  );
  assert.match(items[1]!.why, /^30 min past the start and Nora isn't clocked in/);
  assert.match(items[0]!.why, /EVV has no visit/);
  assert.equal(items[1]!.phone, "801-555-0101");

  const withCallout = buildNeeds(
    input({
      shifts: [late],
      callouts: [
        {
          id: "co",
          scheduled_shift_id: "late",
          staff_id: "nora",
          reason: "Sick",
          created_at: "2026-11-17T18:00:00.000Z",
        },
      ],
    }),
  );
  assert.deepEqual(
    withCallout.map((i) => i.kind),
    ["callout"],
  );
});

test("most urgent first: red, then open/claims/swaps, then requests and reminders", () => {
  const items = buildNeeds(
    input({
      shifts: [
        shift("open", { staff_id: null, status: "open" }),
        shift("one", { staff_id: null, status: "open", client_id: "c1" }),
        shift("claim", { staff_id: null, status: "open", claim_requested_by: "ava" }),
      ],
      timeOff: [
        {
          id: "t1",
          staff_id: "ava",
          start_date: "2026-11-24",
          end_date: "2026-11-24",
          type: "pto",
          note: null,
          status: "pending",
        },
      ],
      punchFixes: [
        {
          id: "p1",
          staff_id: "nora",
          client_id: "c1",
          service_type_code: "sln",
          clock_in_timestamp: "2026-11-16T14:00:00.000Z",
          clock_out_timestamp: "2026-11-16T20:00:00.000Z",
          corrected_clock_in: null,
          corrected_clock_out: "2026-11-16T21:00:00.000Z",
          edit_reason: "Forgot to clock out",
          override_reason: null,
        },
      ],
    }),
  );
  assert.deepEqual(
    items.map((i) => i.kind),
    ["one_to_one", "claim", "open", "punch_fix", "timeoff"],
  );
  assert.equal(items.find((i) => i.kind === "open")!.why, "Not offered yet.");
  assert.match(
    items.find((i) => i.kind === "punch_fix")!.why,
    /Asks to set clock-out to 2:00 PM: “Forgot to clock out”/,
  );
});

test("claims: only an owner or agency-wide admin may approve", () => {
  const s = shift("claim", { staff_id: null, status: "open", claim_requested_by: "ava" });
  const lead = buildNeeds(input({ shifts: [s] }))[0]!;
  assert.equal(lead.approve?.ok, false);
  const admin = buildNeeds(
    input({
      shifts: [s],
      viewer: {
        userId: "x",
        isOwner: false,
        isAgencyAdmin: true,
        canEditScheduling: true,
        canEditTimesheets: false,
      },
    }),
  )[0]!;
  assert.deepEqual(admin.approve, { ok: true });
});

test("swaps follow the home's approval setting; only partner-accepted swaps with a taker show", () => {
  const s = shift("s");
  const items = buildNeeds(
    input({
      shifts: [s],
      swaps: [
        { id: "w1", shift_id: "s", from_staff_id: "nora", to_staff_id: "ava", note: null },
        { id: "w2", shift_id: "s", from_staff_id: "nora", to_staff_id: null, note: null },
      ],
    }),
  ).filter((i) => i.kind === "swap");
  assert.equal(items.length, 1);
  assert.deepEqual(items[0]!.approve, { ok: true });
  assert.match(items[0]!.title, /^Nora → Ava/);
});

test("time off: pending says how many shifts it lands on; approved adds an uncovered row per shift", () => {
  const s = shift("s");
  const t = {
    id: "t1",
    staff_id: "nora",
    start_date: "2026-11-19",
    end_date: "2026-11-19",
    type: "pto",
    note: "Wedding",
    status: "pending",
  };
  const pending = buildNeeds(input({ shifts: [s], timeOff: [t] })).find(
    (i) => i.kind === "timeoff",
  )!;
  assert.match(pending.why, /^Wedding\. 1 scheduled shift would need someone else\./);
  assert.equal(pending.approve?.ok, false); // time off defaults to the owner
  const approved = buildNeeds(input({ shifts: [s], timeOff: [{ ...t, status: "approved" }] }));
  assert.deepEqual(
    approved.map((i) => [i.kind, i.shiftId]),
    [["uncovered", "s"]],
  );
});

test("viewers without the right access get the reason", () => {
  const viewer = {
    userId: "lead",
    isOwner: false,
    isAgencyAdmin: false,
    canEditScheduling: false,
    canEditTimesheets: false,
  };
  const items = buildNeeds(
    input({
      viewer,
      shifts: [shift("s")],
      swaps: [{ id: "w1", shift_id: "s", from_staff_id: "nora", to_staff_id: "ava", note: null }],
    }),
  );
  assert.deepEqual(items[0]!.approve, { ok: false, reason: "Needs Scheduling edit access." });
});

test("overtime this week and 1056 Watch / Act now (not HHS, not On pace)", () => {
  const long = (id: string, day: string) =>
    shift(id, {
      starts_at: `2026-11-${day}T14:00:00.000Z`,
      ends_at: `2026-11-${day}T23:00:00.000Z`,
    });
  const outlook = (code: string, status: "act" | "watch" | "ok", left: number) => ({
    clientId: "c1",
    code,
    unit: "h",
    outlook: { used: 0, left, status, runsOutOn: null, weeksEarly: null, unused: null },
  });
  const items = buildNeeds(
    input({
      shifts: ["15", "16", "17", "18", "19"].map((d) => long(`d${d}`, d)),
      outlook: [
        outlook("DSI", "act", -3),
        outlook("SEI", "watch", 20),
        outlook("HHS", "act", -1),
        outlook("SLN", "ok", 99),
      ],
    }),
  ).filter((i) => i.kind === "overtime" || i.kind === "auth");
  assert.deepEqual(
    items.map((i) => [i.kind, i.level]),
    [
      ["auth", "crit"],
      ["auth", "warn"],
      ["overtime", "warn"],
    ],
  );
  assert.match(items[0]!.title, /Riley H · DSI · over by 3 h$/);
  assert.match(items[2]!.why, /^5 h over the 40 h threshold/);
});

test("cards: expiring within 14 days with shifts after it; expired ones are red", () => {
  const person = {
    id: "nora",
    name: "Nora Diaz",
    active: true,
    age: 30,
    hireDate: "2020-01-01",
    timeOff: [],
  };
  const evidence = {
    nora: {
      items: [{ id: "i1", requirement_key: "cpr_first_aid", expires_on: "2026-11-27" }],
      files: [{ item_id: "i1", review_status: "accepted" as const, storage_path: "x" }],
    },
  };
  const after = shift("after", { starts_at: "2026-11-28T14:00:00.000Z" });
  const before = shift("before", { starts_at: "2026-11-20T14:00:00.000Z" });
  const cards = cardFindings([person], [after, before], evidence, "2026-11-17");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.shiftsAfter, 1);
  assert.equal(cards[0]!.expired, false);
  const far = cardFindings(
    [person],
    [after],
    {
      nora: { ...evidence.nora, items: [{ ...evidence.nora.items[0]!, expires_on: "2026-12-15" }] },
    },
    "2026-11-17",
  );
  assert.equal(far.length, 0);
  const [row] = buildNeeds(input({ cards }));
  assert.equal(row!.kind, "card_expiring");
  assert.match(row!.title, /Nora Diaz · CPR \/ First Aid expires Nov 27, 2026/);
});

test("needsSummary counts by kind", () => {
  const items = buildNeeds(
    input({
      shifts: [
        shift("a", { staff_id: null, status: "open" }),
        shift("b", {
          staff_id: null,
          status: "open",
          starts_at: "2026-11-20T14:00:00.000Z",
          ends_at: "2026-11-20T22:00:00.000Z",
        }),
      ],
    }),
  );
  assert.equal(needsSummary(items), "2 open shifts");
});
