import test from "node:test";
import assert from "node:assert/strict";
import {
  clientPlace,
  filterOptions,
  fmtSpan,
  homeCode,
  moveTimes,
  nextStatus,
  placeOptions,
  resizeTimes,
  shiftPlace,
  shiftWrite,
  staffHours,
  timesOn,
  wallClock,
  weekDays,
  type BoardShift,
  type BoardTeam,
} from "./board-model.ts";

const shift = (o: Partial<BoardShift> = {}): BoardShift => ({
  id: "s1",
  staff_id: "a",
  client_id: "c1",
  team_id: null,
  service_code: "DSI",
  starts_at: "2026-11-10T14:00:00.000Z",
  ends_at: "2026-11-10T22:00:00.000Z", // Tue 7a–3p Denver
  status: "draft",
  published: false,
  parent_shift_id: null,
  open_spots: null,
  override_reason: null,
  shift_type: "hourly",
  notes: null,
  claim_requested_by: null,
  ...o,
});
const teams = new Map<string, BoardTeam>([
  ["maple", { id: "maple", team_name: "Maple House", team_type: "rhs_home" }],
  ["ruiz", { id: "ruiz", team_name: "Ruiz", team_type: "host_home" }],
  ["lehi", { id: "lehi", team_name: "Lehi Day Program", team_type: "day_program" }],
]);

test("home codes: RHS homes and day programs only", () => {
  assert.equal(homeCode("rhs_home"), "RHS");
  assert.equal(homeCode("day_program"), "DSG");
  assert.equal(homeCode("host_home"), null);
  assert.equal(homeCode("other"), null);
});

test("filters: Everything, staffed homes and programs, Community, Host homes", () => {
  assert.deepEqual(
    filterOptions([...teams.values()]).map((f) => f.label),
    ["Everything", "Maple House", "Lehi Day Program", "Community", "Host homes"],
  );
  assert.equal(clientPlace({ team_id: "maple" }, teams), "maple");
  assert.equal(clientPlace({ team_id: "ruiz" }, teams), "host");
  assert.equal(clientPlace({ team_id: null }, teams), "community");
  const clients = new Map([["c1", { id: "c1", first_name: "R", last_name: "H", team_id: "ruiz" }]]);
  assert.equal(shiftPlace({ team_id: "lehi", client_id: null }, clients, teams), "lehi");
  assert.equal(shiftPlace({ team_id: null, client_id: "c1" }, clients, teams), "host");
});

test("a person change sets the status; the same person keeps it", () => {
  assert.equal(nextStatus({ status: "accepted", published: true, staff_id: "a" }, "a"), "accepted");
  assert.equal(nextStatus({ status: "published", published: true, staff_id: "a" }, null), "open");
  assert.equal(nextStatus({ status: "open", published: true, staff_id: null }, "b"), "published");
  assert.equal(nextStatus({ status: "draft", published: false, staff_id: "a" }, "b"), "draft");
});

test("moving keeps the wall-clock times, across a DST change", () => {
  const s = shift({ starts_at: "2026-10-30T13:00:00.000Z", ends_at: "2026-10-30T21:00:00.000Z" }); // Fri 7a–3p MDT
  const moved = moveTimes(s, "2026-11-02"); // Mon, MST
  assert.equal(fmtSpan(moved), "7a–3p");
  assert.equal(moved.starts_at, "2026-11-02T14:00:00.000Z");
});

test("edge drag snaps to quarter hours and keeps 15 minutes", () => {
  const s = shift();
  assert.equal(fmtSpan(resizeTimes(s, "end", 38)), "7a–3:45p");
  assert.equal(fmtSpan(resizeTimes(s, "start", -60)), "6a–3p");
  assert.equal(fmtSpan(resizeTimes(s, "end", -10_000)), "7a–7:15a");
});

test("timesOn: overnight ends the next morning", () => {
  const t = timesOn("2026-11-10", "23:00", "07:00");
  assert.equal(t.starts_at, "2026-11-11T06:00:00.000Z");
  assert.equal(t.ends_at, "2026-11-11T14:00:00.000Z");
  assert.equal(wallClock(t.starts_at), "23:00");
});

test("hours and week days", () => {
  const list = [
    shift(),
    shift({ id: "s2", status: "cancelled" }),
    shift({ id: "s3", staff_id: "b" }),
  ];
  assert.equal(staffHours(list, "a"), 8);
  assert.deepEqual(weekDays("2026-11-12"), [
    "2026-11-08",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
  ]);
});

test("shiftWrite: an open shift has a spot; a staffed one none", () => {
  assert.equal(shiftWrite("o", shift()).open_spots, null);
  assert.equal(shiftWrite("o", shift(), { staff_id: null }).open_spots, 1);
  assert.equal(shiftWrite("o", shift(), { staff_id: "b" }).staff_id, "b");
});

test("places: staffed homes, then clients under each active code (no HHS/RHS)", () => {
  const clients = [
    { id: "c1", first_name: "Riley", last_name: "H", team_id: "maple" },
    { id: "c2", first_name: "Elena", last_name: "V", team_id: "ruiz" },
  ];
  const codes = [
    {
      client_id: "c1",
      service_code: "dsi",
      service_start_date: "2026-07-01",
      service_end_date: null,
    },
    {
      client_id: "c1",
      service_code: "SEI",
      service_start_date: "2026-07-01",
      service_end_date: "2026-11-10",
    },
    { client_id: "c2", service_code: "HHS", service_start_date: null, service_end_date: null },
  ];
  const all = placeOptions("2026-11-10", [...teams.values()], clients, codes);
  assert.deepEqual(
    all.map((p) => p.label),
    ["Maple House", "Lehi Day Program", "Riley H · DSI"],
  );
  assert.equal(all[0]!.usedAt, "home");
  const locked = placeOptions("2026-11-09", [...teams.values()], clients, codes, new Set(["c1"]));
  assert.deepEqual(
    locked.map((p) => p.key),
    ["team:maple", "client:c1:DSI", "client:c1:SEI"],
  );
});
