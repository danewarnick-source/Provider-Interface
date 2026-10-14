import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeDb, type Row } from "./fake-db.ts";
import {
  askedWhen,
  cardAnswer,
  countOpenQuestions,
  listQuestions,
  QuestionsInput,
  QuestionStatusInput,
  questionCard,
  setQuestionStatus,
  statusesFor,
  type QuestionRow,
} from "./questions-admin.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TODAY = "2026-10-12";

function row(id: string, overrides: Partial<QuestionRow & { organization_id: string }> = {}): Row {
  return {
    id,
    organization_id: ORG,
    asker_name: "Pat Example",
    question: `Question ${id}`,
    answer: "I couldn't find that in your agency's documents.",
    found: false,
    feedback: null,
    status: "open",
    created_at: "2026-10-10T16:00:00Z",
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  };
}

function db() {
  return new FakeDb({
    tables: {
      nectar_questions: [
        row("q-open"),
        row("q-down", {
          found: true,
          feedback: "down",
          answer: "Call the on-call supervisor [1] and write it down [2].",
          created_at: "2026-10-12T17:00:00Z",
        }),
        row("q-resolved", { status: "resolved", created_at: "2026-10-09T16:00:00Z" }),
        row("q-answered", { found: true, status: null }),
        row("q-elsewhere", { organization_id: OTHER_ORG }),
      ],
    },
  });
}

describe("Questions tab cards (N6, Decision 9)", () => {
  it("names the kind, the asker and when, as in the demo", () => {
    const notFound = questionCard(row("a") as unknown as QuestionRow, TODAY);
    assert.equal(notFound.kindLabel, "No answer found");
    assert.equal(notFound.asker, "Pat Example");
    assert.equal(notFound.when, "Oct 10");
    assert.equal(notFound.answer, null, "no answer shown when nothing was found");
    const down = questionCard(
      row("b", {
        found: true,
        feedback: "down",
        answer: "Do X [1].",
        created_at: "2026-10-12T17:00:00Z",
      }) as unknown as QuestionRow,
      TODAY,
    );
    assert.equal(down.kindLabel, "Marked not helpful");
    assert.equal(down.when, "Today");
    assert.equal(down.answer, "Do X.");
    assert.equal(
      questionCard(row("c", { asker_name: null }) as unknown as QuestionRow, TODAY).asker,
      "A team member",
    );
  });

  it("dates questions by the Mountain Time day", () => {
    assert.equal(askedWhen("2026-10-13T04:00:00Z", TODAY), "Today", "10 pm on Oct 12 in Utah");
    assert.equal(askedWhen("2026-10-11T12:00:00Z", TODAY), "Oct 11");
  });

  it("strips the [n] markers but keeps the answer's words and lines", () => {
    assert.equal(
      cardAnswer({ found: true, answer: "First [1].\nSecond [2][3]." }),
      "First.\nSecond.",
    );
    assert.equal(cardAnswer({ found: true, answer: "  " }), null);
    assert.equal(cardAnswer({ found: false, answer: "Refused." }), null);
  });
});

describe("Questions tab reads and writes (N6)", () => {
  it("lists one filter for this agency only, newest first; answered questions never show", async () => {
    const d = db();
    const ids = async (filter: "open" | "resolved" | "all") =>
      (await listQuestions(d.client, ORG, filter, TODAY)).questions.map((q) => q.id);
    assert.deepEqual(await ids("open"), ["q-down", "q-open"]);
    assert.deepEqual(await ids("resolved"), ["q-resolved"]);
    assert.deepEqual(await ids("all"), ["q-down", "q-open", "q-resolved"]);
    assert.deepEqual(statusesFor("all"), ["open", "resolved"]);
    const read = d.callsTo("nectar_questions")[0]!;
    assert.deepEqual(read.filters[0], ["eq", "organization_id", ORG]);
  });

  it("counts the open questions of this agency", async () => {
    assert.equal(await countOpenQuestions(db().client, ORG), 2);
    assert.equal(await countOpenQuestions(db().client, OTHER_ORG), 1);
  });

  it("Mark resolved records when and by whom; Reopen clears both; nothing is deleted", async () => {
    const d = db();
    await setQuestionStatus(d.client, { orgId: ORG, userId: ADMIN }, "q-open", "resolved");
    const resolved = d.tables.nectar_questions!.find((r) => r.id === "q-open")!;
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.resolved_by, ADMIN);
    assert.ok(typeof resolved.resolved_at === "string");
    await setQuestionStatus(d.client, { orgId: ORG, userId: ADMIN }, "q-open", "open");
    assert.deepEqual(
      [resolved.status, resolved.resolved_at, resolved.resolved_by],
      ["open", null, null],
    );
    assert.equal(d.tables.nectar_questions!.length, 5);
  });

  it("refuses another agency's question and an answered (unflagged) one", async () => {
    const d = db();
    await assert.rejects(
      setQuestionStatus(d.client, { orgId: ORG, userId: ADMIN }, "q-elsewhere", "resolved"),
      /Question not found/,
    );
    await assert.rejects(
      setQuestionStatus(d.client, { orgId: ORG, userId: ADMIN }, "q-answered", "resolved"),
      /Question not found/,
    );
    assert.equal(d.tables.nectar_questions!.find((r) => r.id === "q-elsewhere")!.status, "open");
    assert.equal(d.tables.nectar_questions!.find((r) => r.id === "q-answered")!.status, null);
  });

  it("a failed read says so instead of showing an empty list", async () => {
    const d = new FakeDb({ failing: ["nectar_questions"] });
    await assert.rejects(listQuestions(d.client, ORG, "open", TODAY), /Could not load/);
    await assert.rejects(countOpenQuestions(d.client, ORG), /Could not count/);
  });

  it("validates its inputs", () => {
    assert.equal(QuestionsInput.parse({ organizationId: ORG }).filter, "open");
    assert.throws(() => QuestionsInput.parse({ organizationId: ORG, filter: "assigned" }));
    assert.throws(() =>
      QuestionStatusInput.parse({ organizationId: ORG, questionId: "q1", status: "resolved" }),
    );
    assert.throws(() =>
      QuestionStatusInput.parse({ organizationId: ORG, questionId: ADMIN, status: "deleted" }),
    );
  });
});
