import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { knowledgeHref, knowledgeView, parseKnowledgeSearch } from "./knowledge-nav.ts";

const DOC = "0aa8750d-932b-4832-97c5-2d7f8b00930f";
const RULE = "256f037e-3487-4c8a-bc32-201eab1c42cc";

describe("knowledge-nav.ts (N4)", () => {
  it("keeps only known tabs, ids that are uuids and New document prefills", () => {
    assert.deepEqual(parseKnowledgeSearch({ tab: "required" }), { tab: "required" });
    assert.deepEqual(parseKnowledgeSearch({ tab: "sources" }), {}, "old tabs fall back to Library");
    assert.deepEqual(parseKnowledgeSearch({ doc: DOC, rule: "nope" }), { doc: DOC });
    assert.deepEqual(parseKnowledgeSearch({ new: true, slot: "grievances", question: DOC }), {
      new: true,
      slot: "grievances",
      question: DOC,
    });
    assert.deepEqual(parseKnowledgeSearch({ new: "1", slot: "Bad Slot!" }), { new: true });
    assert.deepEqual(
      parseKnowledgeSearch({ slot: "grievances" }),
      {},
      "a slot only with New document",
    );
  });

  it("builds the links N6 uses for source chips and Add to library", () => {
    assert.equal(knowledgeHref(), "/dashboard/hub/knowledge");
    assert.equal(knowledgeHref({ doc: DOC }), `/dashboard/hub/knowledge?doc=${DOC}`);
    assert.equal(knowledgeHref({ rule: RULE }), `/dashboard/hub/knowledge?rule=${RULE}`);
    assert.equal(knowledgeHref({ tab: "required" }), "/dashboard/hub/knowledge?tab=required");
    assert.equal(
      knowledgeHref({ new: true, question: DOC }),
      `/dashboard/hub/knowledge?new=true&question=${DOC}`,
    );
    const back = new URL(`https://x${knowledgeHref({ new: true, slot: "emergencies" })}`);
    assert.deepEqual(parseKnowledgeSearch(Object.fromEntries(back.searchParams)), {
      new: true,
      slot: "emergencies",
    });
  });

  it("decides which page to show: New document, a document, a state rule, or the tabs", () => {
    assert.deepEqual(knowledgeView({ new: true, slot: "grievances", doc: DOC }), {
      kind: "new",
      slot: "grievances",
      question: undefined,
    });
    assert.deepEqual(knowledgeView({ doc: DOC }), { kind: "document", id: DOC });
    assert.deepEqual(knowledgeView({ rule: RULE }), { kind: "state_rule", id: RULE });
    assert.deepEqual(knowledgeView({}), { kind: "tabs", tab: "library" });
    assert.deepEqual(knowledgeView({ tab: "reviews" }), { kind: "tabs", tab: "reviews" });
  });
});
