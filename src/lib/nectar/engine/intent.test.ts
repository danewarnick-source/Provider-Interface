import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { questionWantsPayOrHours, questionWantsSchedule } from "./intent.ts";

describe("questionWantsPayOrHours", () => {
  it("catches pay and earnings questions", () => {
    assert.equal(questionWantsPayOrHours("what's my pay?"), true);
    assert.equal(questionWantsPayOrHours("How much did I make this period?"), true);
    assert.equal(questionWantsPayOrHours("estimated earnings"), true);
    assert.equal(questionWantsPayOrHours("what is my hourly rate"), true);
    assert.equal(questionWantsPayOrHours("overtime pay this week"), true);
    assert.equal(questionWantsPayOrHours("When is payroll?"), true);
  });

  it("catches hours-worked questions, including the pay period", () => {
    assert.equal(questionWantsPayOrHours("how many hours did I work this pay period?"), true);
    assert.equal(questionWantsPayOrHours("How many hours have I worked this week?"), true);
    assert.equal(questionWantsPayOrHours("hours this month"), true);
    assert.equal(questionWantsPayOrHours("hours worked this period"), true);
  });

  it("lets schedule and policy questions through", () => {
    assert.equal(questionWantsPayOrHours("what's my schedule this week?"), false);
    assert.equal(questionWantsPayOrHours("when do I work with Client A?"), false);
    assert.equal(
      questionWantsPayOrHours("how many shifts have I worked with Client B this month?"),
      false,
    );
    assert.equal(questionWantsPayOrHours("Walk me through the reimbursement process."), false);
    assert.equal(questionWantsPayOrHours("What's the overtime policy?"), false);
    assert.equal(questionWantsPayOrHours("What do I do if a dose is missed?"), false);
    assert.equal(questionWantsPayOrHours(""), false);
  });
});

describe("questionWantsSchedule", () => {
  it("finds own-schedule and day-name questions", () => {
    assert.equal(questionWantsSchedule("what's my schedule this week?"), true);
    assert.equal(questionWantsSchedule("when do I work?"), true);
    assert.equal(questionWantsSchedule("do I work Tuesday?"), true);
    assert.equal(questionWantsSchedule("am I scheduled Friday"), true);
  });

  it("finds questions about shifts with a client", () => {
    assert.equal(questionWantsSchedule("When's the next time I work with Client A?"), true);
    assert.equal(
      questionWantsSchedule("How many shifts have I worked with Client B this month?"),
      true,
    );
  });

  it("never treats pay or hours, or a policy question, as a schedule question", () => {
    assert.equal(questionWantsSchedule("how many hours did I work this pay period?"), false);
    assert.equal(questionWantsSchedule("what's my pay?"), false);
    assert.equal(questionWantsSchedule("What does the grievance policy say?"), false);
  });
});
