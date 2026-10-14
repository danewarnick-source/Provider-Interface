import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { denverWallToIso } from "../denver-date.ts";
import {
  GIVE_LOG_COLUMNS,
  asNeededMeds,
  dayWindow,
  dueDoses,
  followupsDue,
  isLateDose,
  isPrnOverride,
  loggedOnDay,
  notGivenRecord,
  prnStatus,
  prnWarning,
  takenAtProblem,
  type GiveLog,
  type GiveMed,
} from "./give-meds.ts";

const DAY = "2026-10-14";
const at = (h: number, m = 0) => denverWallToIso(DAY, h, m);
const med = (over: Partial<GiveMed> = {}): GiveMed => ({
  id: "m1",
  medication_name: "Sertraline",
  scheduled_times: ["08:00", "20:00"],
  is_prn: false,
  is_active: true,
  ...over,
});
const log = (over: Partial<GiveLog> = {}): GiveLog => ({
  id: "l1",
  medication_id: "m1",
  scheduled_for: at(8),
  status: "administered",
  actual_taken_at: at(8, 5),
  ...over,
});

describe("dueDoses", () => {
  it("lists scheduled doses nobody has charted, earliest first", () => {
    const due = dueDoses([med()], [], DAY);
    assert.deepEqual(
      due.map((d) => d.time),
      ["08:00", "20:00"],
    );
  });

  it("drops a dose once it is charted, given or not given", () => {
    assert.deepEqual(
      dueDoses([med()], [log()], DAY).map((d) => d.time),
      ["20:00"],
    );
    const refused = log({ status: "refused", actual_taken_at: null });
    assert.deepEqual(
      dueDoses([med()], [refused], DAY).map((d) => d.time),
      ["20:00"],
    );
  });

  it("keeps only doses inside the window (clock-in to now)", () => {
    const due = dueDoses([med()], [], DAY, { start: at(6), end: at(12) });
    assert.deepEqual(
      due.map((d) => d.time),
      ["08:00"],
    );
  });

  it("skips paused, stopped and as-needed medications", () => {
    assert.equal(dueDoses([med({ paused_at: at(1) })], [], DAY).length, 0);
    assert.equal(dueDoses([med({ discontinued_at: at(1), is_active: false })], [], DAY).length, 0);
    assert.equal(dueDoses([med({ is_prn: true })], [], DAY).length, 0);
  });

  it("day window runs from Denver midnight to now", () => {
    const w = dayWindow(DAY, new Date(at(9)));
    assert.equal(w.start, at(0));
    assert.equal(w.end, new Date(at(9)).toISOString());
  });
});

describe("as needed and follow-ups", () => {
  const prn = med({
    id: "p1",
    medication_name: "Ibuprofen",
    is_prn: true,
    scheduled_times: [],
    prn_min_hours: 4,
    prn_max_per_day: 2,
  });

  it("lists active PRNs apart from scheduled meds", () => {
    assert.deepEqual(
      asNeededMeds([med(), prn]).map((m) => m.id),
      ["p1"],
    );
  });

  it("warns with the next allowed time when it's too soon", () => {
    const logs = [
      log({ medication_id: "p1", is_prn: true, actual_taken_at: at(10), scheduled_for: at(10) }),
    ];
    const check = prnStatus(prn, logs, new Date(at(12)));
    assert.equal(check.tooSoon, true);
    assert.equal(check.nextAllowedAt?.toISOString(), new Date(at(14)).toISOString());
    assert.match(prnWarning(check, () => "2:00 PM") ?? "", /too soon.*Next allowed at 2:00 PM/);
    assert.equal(
      prnWarning(prnStatus(prn, logs, new Date(at(15))), () => ""),
      null,
    );
  });

  it("follow-ups due are PRN doses past their due time and not answered", () => {
    const due = log({ id: "a", is_prn: true, prn_followup_due_at: at(9) });
    const later = log({ id: "b", is_prn: true, prn_followup_due_at: at(13) });
    const done = log({
      id: "c",
      is_prn: true,
      prn_followup_due_at: at(9),
      prn_followup_at: at(9, 30),
    });
    assert.deepEqual(
      followupsDue([due, later, done], new Date(at(12))).map((l) => l.id),
      ["a"],
    );
  });

  it("logged today lists charted doses by the time taken, newest first", () => {
    const a = log({ id: "a", actual_taken_at: at(8) });
    const b = log({ id: "b", actual_taken_at: at(20) });
    const other = log({ id: "x", actual_taken_at: denverWallToIso("2026-10-13", 20, 0) });
    assert.deepEqual(
      loggedOnDay([a, b, other], DAY).map((l) => l.id),
      ["b", "a"],
    );
  });
});

describe("not given", () => {
  it("maps each reason to a status and a MAR reason", () => {
    assert.deepEqual(notGivenRecord("refused"), { status: "refused", exceptionReason: "Refused" });
    assert.deepEqual(notGivenRecord("not_home"), {
      status: "omitted",
      exceptionReason: "Not home",
    });
    assert.deepEqual(notGivenRecord("held", "BP low"), {
      status: "held",
      exceptionReason: "Held by nurse or prescriber: BP low",
    });
    assert.equal(notGivenRecord("asleep").status, "missed");
  });

  it("other needs a note", () => {
    assert.throws(() => notGivenRecord("other", " "), /Say why/);
    assert.equal(notGivenRecord("other", "At the ER").exceptionReason, "Other: At the ER");
  });
});

describe("dose times", () => {
  const now = new Date(at(12));
  it("refuses a time in the future or more than 24 hours back", () => {
    assert.match(takenAtProblem(at(12, 10), now) ?? "", /future/);
    assert.match(takenAtProblem(denverWallToIso("2026-10-13", 11, 0), now) ?? "", /24 hours/);
    assert.equal(takenAtProblem(at(11), now), null);
    assert.equal(takenAtProblem(at(12, 1), now), null);
  });

  it("marks a scheduled dose taken more than 60 minutes late", () => {
    assert.equal(isLateDose(log({ actual_taken_at: at(9, 1) })), true);
    assert.equal(isLateDose(log({ actual_taken_at: at(9) })), false);
    assert.equal(isLateDose(log({ actual_taken_at: at(11), is_prn: true })), false);
    assert.equal(isLateDose(log({ status: "refused", actual_taken_at: null })), false);
  });

  it("spots a PRN given past its limit", () => {
    assert.equal(isPrnOverride({ exception_reason: "PRN limit override: nurse said" }), true);
    assert.equal(isPrnOverride({ exception_reason: "Refused" }), false);
  });

  it("loads each dose's med training mark for the logged list", () => {
    const cols = GIVE_LOG_COLUMNS.split(", ");
    assert.ok(cols.includes("given_without_current_training"));
    assert.ok(cols.includes("training_issue"));
  });
});
