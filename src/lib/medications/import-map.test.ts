import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { howTakenFromImport, scheduledTimesFromImport } from "./import-map.ts";

describe("import-map", () => {
  it("maps support level wording to how they take it", () => {
    assert.equal(howTakenFromImport("independent"), "self");
    assert.equal(howTakenFromImport("staff_observed"), "self");
    assert.equal(howTakenFromImport("reminder"), "assist");
    assert.equal(howTakenFromImport("set_up"), "assist");
    assert.equal(howTakenFromImport("Full assist"), "assist");
    assert.equal(howTakenFromImport("staff_administered"), "assist");
    assert.equal(howTakenFromImport("rn"), "nurse");
    assert.equal(howTakenFromImport("delegated"), "nurse");
    assert.equal(howTakenFromImport(""), null);
    assert.equal(howTakenFromImport(null), null);
    assert.equal(howTakenFromImport("unknown thing"), null);
  });

  it("reads 24-hour times as written", () => {
    assert.deepEqual(scheduledTimesFromImport({ scheduled_times: ["20:00", "8:00"] }), [
      "08:00",
      "20:00",
    ]);
    assert.deepEqual(scheduledTimesFromImport({ scheduled_time: "08:00, 14:30" }), [
      "08:00",
      "14:30",
    ]);
  });

  it("uses am_pm to read 12-hour times", () => {
    assert.deepEqual(scheduledTimesFromImport({ scheduled_time: "8:00", am_pm: "PM" }), ["20:00"]);
    assert.deepEqual(scheduledTimesFromImport({ scheduled_time: "8:00", am_pm: "AM" }), ["08:00"]);
    assert.deepEqual(scheduledTimesFromImport({ scheduled_time: "8:00", am_pm: "Both" }), [
      "08:00",
      "20:00",
    ]);
    assert.deepEqual(scheduledTimesFromImport({ scheduled_time: "12:00", am_pm: "AM" }), ["00:00"]);
    assert.deepEqual(scheduledTimesFromImport({ scheduled_time: "8 pm" }), ["20:00"]);
  });

  it("never makes up a time from am_pm alone", () => {
    assert.deepEqual(scheduledTimesFromImport({ am_pm: "AM" }), []);
    assert.deepEqual(scheduledTimesFromImport({ schedule: "twice daily" }), []);
  });

  it("falls back to the schedule text", () => {
    assert.deepEqual(scheduledTimesFromImport({ schedule: "Give at 7:30 am and 7:30 pm" }), [
      "07:30",
      "19:30",
    ]);
  });
});
