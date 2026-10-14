import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeDb } from "./fake-db.ts";
import {
  feedbackPatch,
  loadAskerAndAgency,
  logQuestion,
  questionRow,
  QUESTION_NOT_FOUND,
  recordFeedback,
} from "./questions.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ME = "11111111-1111-4111-8111-111111111111";
const SOMEONE = "22222222-2222-4222-8222-222222222222";
const caller = { userId: ME, orgId: ORG, view: "staff" as const, agencyAdmin: false };

describe("nectar_questions log", () => {
  it("logs not found as open, found as not flagged, with the asker and scope", () => {
    const base = {
      question: "q",
      answer: "a",
      citedSectionIds: ["s", "s"],
      clientIds: [],
      askerName: "Sam Staff",
    };
    const open = questionRow(caller, { ...base, found: false });
    assert.equal(open.status, "open");
    assert.equal(open.asked_by, ME);
    assert.equal(open.scope, "staff");
    assert.deepEqual(open.cited_section_ids, ["s"]);
    assert.equal(questionRow(caller, { ...base, found: true }).status, null);
  });

  it("returns the new row's id, or null without failing the answer when the log fails", async () => {
    const db = new FakeDb({ tables: { nectar_questions: [] } });
    const id = await logQuestion(db.client, caller, {
      question: "q",
      answer: "a",
      found: false,
      citedSectionIds: [],
      clientIds: [],
      askerName: null,
    });
    assert.equal(db.tables.nectar_questions![0]!.id, id);
    const failing = new FakeDb({ failing: ["nectar_questions"] });
    const quiet = console.error;
    console.error = () => {};
    try {
      assert.equal(
        await logQuestion(failing.client, caller, {
          question: "q",
          answer: "a",
          found: false,
          citedSectionIds: [],
          clientIds: [],
          askerName: null,
        }),
        null,
      );
    } finally {
      console.error = quiet;
    }
  });

  it("reads the asker's name and the agency's name", async () => {
    const db = new FakeDb({
      tables: {
        profiles: [{ id: ME, full_name: " Sam Staff ", email: "sam@example.test" }],
        organizations: [{ id: ORG, name: "Sample Supports" }],
      },
    });
    assert.deepEqual(await loadAskerAndAgency(db.client, caller), {
      askerName: "Sam Staff",
      orgName: "Sample Supports",
    });
  });
});

describe("feedback (thumbs up / down)", () => {
  it("a thumbs-down opens the question again; a thumbs-up clears an open flag on a found answer", () => {
    assert.deepEqual(feedbackPatch({ found: true, status: "resolved", feedback: null }, "down"), {
      feedback: "down",
      status: "open",
      resolved_at: null,
      resolved_by: null,
    });
    assert.deepEqual(feedbackPatch({ found: true, status: "open", feedback: "down" }, "up"), {
      feedback: "up",
      status: null,
    });
    assert.deepEqual(feedbackPatch({ found: false, status: "open", feedback: null }, "up"), {
      feedback: "up",
      status: "open",
    });
    assert.deepEqual(feedbackPatch({ found: true, status: "resolved", feedback: null }, "up"), {
      feedback: "up",
      status: "resolved",
    });
  });

  it("only the asker may rate a question; the write happens after that check", async () => {
    const question = {
      id: "q-1",
      organization_id: ORG,
      asked_by: ME,
      found: true,
      status: null,
      feedback: null,
    };
    const read = new FakeDb({
      tables: { nectar_questions: [question, { ...question, id: "q-2", asked_by: SOMEONE }] },
    });
    const write = new FakeDb({ tables: { nectar_questions: [{ ...question }] } });
    assert.deepEqual(await recordFeedback(read.client, write.client, caller, "q-1", "down"), {
      questionId: "q-1",
      feedback: "down",
      status: "open",
      off: false,
    });
    assert.equal(write.tables.nectar_questions![0]!.status, "open");
    assert.deepEqual(write.callsTo("nectar_questions")[0]!.filters, [
      ["eq", "id", "q-1"],
      ["eq", "organization_id", ORG],
      ["eq", "asked_by", ME],
    ]);
    await assert.rejects(
      recordFeedback(read.client, write.client, caller, "q-2", "down"),
      new RegExp(QUESTION_NOT_FOUND),
    );
    await assert.rejects(
      recordFeedback(read.client, write.client, caller, "q-9", "up"),
      new RegExp(QUESTION_NOT_FOUND),
    );
    assert.equal(write.calls.length, 1, "no write for someone else's question");
  });
});
