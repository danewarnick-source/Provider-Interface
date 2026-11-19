import test from "node:test";
import assert from "node:assert/strict";
import {
  editorInput,
  lineFromInput,
  newState,
  rotationPlaces,
  stateFromLine,
  type RotationPlace,
} from "./rotation-form.ts";
import { patternLabel, rotationDays } from "./rotation.ts";

const TODAY = "2026-11-19";
const places = rotationPlaces(
  [
    { id: "maple", team_name: "Maple House", team_type: "rhs_home" },
    { id: "host", team_name: "Hill Host", team_type: "host_home" },
  ],
  [
    { id: "sam", first_name: "Sam", last_name: "Lee", team_id: null },
    { id: "ann", first_name: "Ann", last_name: "Ray", team_id: "host" },
    { id: "zed", first_name: "Zed", last_name: "Ode", team_id: null },
  ],
  [
    { client_id: "sam", service_code: "slh", service_start_date: null, service_end_date: null },
    { client_id: "sam", service_code: "SLN", service_start_date: null, service_end_date: null },
    { client_id: "ann", service_code: "HHS", service_start_date: null, service_end_date: null },
    {
      client_id: "zed",
      service_code: "COM",
      service_start_date: null,
      service_end_date: "2026-11-01",
    },
  ],
  TODAY,
);

test("tabs: staffed homes with their code, then clients with active scheduled codes", () => {
  assert.deepEqual(
    places.map((p) => [p.key, p.label, p.codes]),
    [
      ["team:maple", "Maple House", ["RHS"]],
      ["client:sam", "Sam Lee", ["SLH", "SLN"]],
    ],
  );
});

const sam = places[1] as RotationPlace;

test("Save stays disabled until who, pattern, slot and start are set", () => {
  const s = newState(sam, TODAY);
  assert.equal(editorInput(s, sam).why, "Pick who works it, or Open.");
  assert.equal(
    editorInput({ ...s, who: "dev", kind: "weekdays", mask: 0 }, sam).why,
    "Pick at least one weekday.",
  );
  assert.match(
    editorInput({ ...s, who: "dev", kind: "custom", customText: "6" }, sam).why ?? "",
    /6-1/,
  );
  assert.equal(
    editorInput({ ...s, who: "dev", kind: "alt-weekend", startsOn: "2026-11-20" }, sam).why,
    "Every other weekend starts on a Saturday.",
  );
  assert.equal(editorInput({ ...s, who: "dev", code: "COM" }, sam).why, "Pick the service code.");
  assert.equal(editorInput({ ...s, who: "dev" }, sam).why, null);
});

test("a client line Mon/Wed 4p–8p SLH becomes the right input and line", () => {
  const s = {
    ...newState(sam, TODAY),
    who: "dev",
    kind: "weekdays" as const,
    mask: 0b0001010,
    start: "16:00",
    end: "20:00",
  };
  const { input } = editorInput(s, sam);
  assert.ok(input);
  assert.deepEqual(
    { ...input, id: undefined },
    {
      id: undefined,
      staff_id: "dev",
      client_id: "sam",
      team_id: null,
      service_code: "SLH",
      shift_type: null,
      cycle: null,
      weekday_mask: 0b0001010,
      starts_on: TODAY,
      start_time: "16:00",
      end_time: "20:00",
      ends_on: null,
    },
  );
  const line = lineFromInput(input, "l1");
  assert.equal(patternLabel(line), "Mon, Wed");
  assert.deepEqual(rotationDays(line, "2026-11-22", "2026-11-28"), ["2026-11-23", "2026-11-25"]);
});

test("an open line saves no person; a stored line comes back into the editor unchanged", () => {
  const maple = places[0] as RotationPlace;
  const s = {
    ...newState(maple, TODAY),
    who: "open",
    kind: "2-2-3" as const,
    shiftType: "eve",
    start: "15:00",
    end: "23:00",
  };
  const { input } = editorInput(s, maple);
  assert.equal(input?.staff_id, null);
  assert.deepEqual(input?.cycle, [2, 2, 3, 2, 2, 3]);
  const back = stateFromLine(lineFromInput(input!, "l9"));
  assert.deepEqual(back, { ...s, id: "l9" });
  const custom = stateFromLine(lineFromInput({ ...input!, cycle: [6, 1] }, "l8"));
  assert.equal(custom.kind, "custom");
  assert.equal(custom.customText, "6-1");
});
