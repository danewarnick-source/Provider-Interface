import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminCaller,
  agencyDb,
  CLIENT,
  DOC,
  labelFor,
  mockBedrock,
  RULE,
  SECTION,
  staffCaller,
} from "./ask-fixtures.ts";
import { runAskNectar } from "./ask.ts";
import {
  ADMIN_VIEW_ONLY,
  NECTAR_AI_LABEL,
  NOT_FOUND_ANSWER,
  PAY_HOURS_REFUSAL,
} from "./ask-types.ts";

/** A model that cites the source holding `needle`, or a made-up id when the prompt has none. */
function citing(needle: string, answer = "Here is what it says") {
  return (system: string) => `${answer} [S:${labelFor(system, needle) ?? "s99"}].`;
}

function loggedQuestions(db: ReturnType<typeof agencyDb>) {
  return db.tables.nectar_questions ?? [];
}

describe("askNectar engine (N5 Done when, mocked Bedrock)", () => {
  it("a team member gets no answer from a client who is not assigned to them", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(citing("Samplazine", "They take Samplazine"));
    const reply = await runAskNectar(staffCaller, "What medications does Umber take?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, false);
    assert.equal(reply.answer, NOT_FOUND_ANSWER);
    assert.deepEqual(reply.sources, []);
    // Scope came from the caller's own caseload, never the request.
    assert.deepEqual(db.callsTo("clients_for_staff")[0]!.payload, {
      _org: staffCaller.orgId,
      _staff: staffCaller.userId,
    });
    for (const call of bedrock.calls.model) {
      assert.doesNotMatch(call.system, /Umber|Unassigned|Samplazine|kitchen door/);
    }
    const [logged] = loggedQuestions(db);
    assert.equal(logged!.found, false);
    assert.equal(logged!.status, "open");
    assert.deepEqual(logged!.client_ids, []);
  });

  it("a team member gets no answer from a policy not meant for them", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(citing("every two hours"));
    const reply = await runAskNectar(staffCaller, "How often are overnight checks?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, false);
    assert.equal(reply.answer, NOT_FOUND_ANSWER);
    const search = db.callsTo("nectar_search_sections")[0]!.payload as Record<string, string[]>;
    assert.ok(!search.p_document_ids.includes(DOC.forOther));
    assert.ok(search.p_document_ids.includes(DOC.forAll));
    for (const call of bedrock.calls.model) assert.doesNotMatch(call.system, /every two hours/);
  });

  it("a team member gets no answer from a draft, an archived version or a contract", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(citing("visitor book"));
    const reply = await runAskNectar(staffCaller, "Where do visitors sign in?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, false);
    const search = db.callsTo("nectar_search_sections")[0]!.payload as Record<string, string[]>;
    for (const id of [DOC.draft, DOC.archived, DOC.contract]) {
      assert.ok(!search.p_document_ids.includes(id), id);
    }
    assert.equal(bedrock.calls.model.length, 0, "nothing matched, so no model call");
  });

  it("drops a section outside the caller's scope even if the search returns it", async () => {
    const db = agencyDb({ ignoreScope: true });
    const bedrock = mockBedrock(citing("every two hours"));
    const reply = await runAskNectar(staffCaller, "How often are overnight checks?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, false);
    for (const call of bedrock.calls.model) assert.doesNotMatch(call.system, /every two hours/);
  });

  it("a team member gets an answer from the state rules, with its source", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(
      citing("grievance policy", "The provider keeps a written grievance policy"),
    );
    const reply = await runAskNectar(staffCaller, "Do we need a grievance policy?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, true);
    assert.equal(reply.label, NECTAR_AI_LABEL);
    assert.equal(reply.answer, "The provider keeps a written grievance policy [1].");
    assert.deepEqual(reply.sources, [
      {
        id: SECTION.rule,
        kind: "state_rule",
        documentTitle: "DHHS91172 Scope of Work",
        heading: "1.18(3) Grievances",
        version: 1,
        documentId: null,
        stateRuleId: RULE,
        clientId: null,
      },
    ]);
    const [logged] = loggedQuestions(db);
    assert.equal(logged!.found, true);
    assert.equal(logged!.status, null);
    assert.deepEqual(logged!.cited_section_ids, [SECTION.rule]);
    assert.equal(reply.questionId, logged!.id);
    // The prompt wraps every source as untrusted data and asks for [S:<id>] citations.
    const { system } = bedrock.calls.model[0]!;
    assert.match(system, /<<<UNTRUSTED_DOCUMENT>>>/);
    assert.match(system, /\[S:s1\]/);
    assert.match(system, new RegExp(NOT_FOUND_ANSWER.replace(/[.']/g, ".")));
  });

  it("answers a team member from the plan and medications of an assigned client", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(citing("Examplol", "Avery takes Examplol twice a day"));
    const reply = await runAskNectar(staffCaller, "What medications does Avery take?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, true);
    assert.equal(reply.sources[0]!.kind, "medications");
    assert.equal(reply.sources[0]!.clientId, CLIENT.assigned);
    assert.deepEqual(loggedQuestions(db)[0]!.client_ids, [CLIENT.assigned]);
  });

  it("strips cited ids that were not sent and keeps the valid ones", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(
      (system) =>
        `Call the nurse [S:${labelFor(system, "call the nurse")}]. Then call 911 [S:s42] [S:${SECTION.contract}].`,
    );
    const reply = await runAskNectar(staffCaller, "What do I do about a missed dose?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.found, true);
    assert.equal(reply.answer, "Call the nurse [1]. Then call 911.");
    assert.deepEqual(
      reply.sources.map((s) => [s.id, s.kind, s.documentId]),
      [[SECTION.forAll, "library", DOC.forAll]],
    );
  });

  it("with no valid citation left, replaces the answer with the fixed message and logs found = false", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(() => "Call 911 right away [S:s42].");
    const reply = await runAskNectar(staffCaller, "What do I do about a missed dose?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(bedrock.calls.model.length, 1);
    assert.equal(reply.found, false);
    assert.equal(reply.answer, NOT_FOUND_ANSWER);
    assert.equal(loggedQuestions(db)[0]!.found, false);
  });

  it("no match: the fixed message with no model call, logged as open with found = false", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(() => "should not be called [S:s1]");
    const reply = await runAskNectar(staffCaller, "Where is the snow shovel kept?", {
      db: db.client,
      ...bedrock,
    });
    assert.equal(reply.answer, NOT_FOUND_ANSWER);
    assert.equal(reply.found, false);
    assert.equal(bedrock.calls.model.length, 0);
    const [logged] = loggedQuestions(db);
    assert.deepEqual(
      [logged!.found, logged!.status, logged!.scope, logged!.asked_by, logged!.answer],
      [false, "open", "staff", staffCaller.userId, NOT_FOUND_ANSWER],
    );
    assert.equal(logged!.asker_name, "Sam Staff");
  });

  it("pay and hours questions get the refusal with no model call and no search", async () => {
    for (const question of [
      "How much did I make this pay period?",
      "How many hours have I worked this week?",
    ]) {
      const db = agencyDb();
      const bedrock = mockBedrock(() => "should not be called");
      const reply = await runAskNectar(staffCaller, question, { db: db.client, ...bedrock });
      assert.equal(reply.answer, PAY_HOURS_REFUSAL);
      assert.equal(reply.refusal, "pay_hours");
      assert.equal(reply.found, false);
      assert.equal(bedrock.calls.model.length, 0);
      assert.equal(bedrock.calls.embed.length, 0);
      assert.equal(db.callsTo("nectar_search_sections").length, 0);
      assert.equal(db.callsTo("scheduled_shifts").length, 0);
      assert.equal(loggedQuestions(db)[0]!.answer, PAY_HOURS_REFUSAL);
    }
  });

  it("falls back to full text when the embedding call fails", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(citing("call the nurse"));
    const reply = await runAskNectar(staffCaller, "What do I do about a missed dose?", {
      db: db.client,
      model: bedrock.model,
      embed: async () => {
        throw new Error("Bedrock is down");
      },
    });
    assert.equal(reply.found, true);
    assert.equal(
      (db.callsTo("nectar_search_sections")[0]!.payload as Record<string, unknown>).p_embedding,
      undefined,
    );
  });
});

describe("askNectar engine: the admin view", () => {
  it("is for owners and agency-wide admins only", async () => {
    const bedrock = mockBedrock();
    await assert.rejects(
      runAskNectar({ ...adminCaller, agencyAdmin: false }, "How many clients do we have?", {
        db: agencyDb().client,
        ...bedrock,
      }),
      new RegExp(ADMIN_VIEW_ONLY),
    );
  });

  it("answers from every published document and agency facts, never drafts", async () => {
    const db = agencyDb();
    const bedrock = mockBedrock(citing("required policies are published", "Here is the count"));
    const reply = await runAskNectar(adminCaller, "How many required policies are published?", {
      db: db.client,
      ...bedrock,
    });
    const search = db.callsTo("nectar_search_sections")[0]!.payload as Record<string, string[]>;
    assert.ok(search.p_document_ids.includes(DOC.forOther));
    assert.ok(search.p_document_ids.includes(DOC.contract));
    assert.ok(!search.p_document_ids.includes(DOC.draft));
    assert.equal(reply.found, true);
    assert.equal(reply.sources[0]!.kind, "agency");
    assert.equal(reply.sources[0]!.id, "agency:required");
    assert.equal(loggedQuestions(db)[0]!.scope, "admin");
  });
});
