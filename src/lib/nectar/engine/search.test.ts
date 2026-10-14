import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeDb } from "./fake-db.ts";
import {
  inScope,
  MIN_VECTOR_SIMILARITY,
  rankHits,
  searchSections,
  TOP_SECTIONS,
  type SearchScope,
  type SectionHit,
} from "./search.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const scope: SearchScope = {
  orgId: ORG,
  documentIds: ["doc-1"],
  stateRuleIds: ["rule-1"],
  clientIds: ["client-1"],
};

function hit(id: string, extra: Partial<SectionHit>): SectionHit {
  return {
    id,
    organization_id: ORG,
    document_id: "doc-1",
    state_document_id: null,
    client_id: null,
    version: 1,
    heading: null,
    body: "text",
    text_rank: null,
    vector_similarity: null,
    ...extra,
  };
}

describe("inScope", () => {
  it("admits a row only through an allowed document, state rule or client", () => {
    assert.equal(inScope(hit("a", {}), scope), true);
    assert.equal(inScope(hit("b", { document_id: "doc-2" }), scope), false);
    assert.equal(inScope(hit("c", { organization_id: "other-org" }), scope), false);
    assert.equal(
      inScope(
        hit("d", { organization_id: null, document_id: null, state_document_id: "rule-1" }),
        scope,
      ),
      true,
    );
    assert.equal(
      inScope(
        hit("e", { organization_id: null, document_id: null, state_document_id: "rule-2" }),
        scope,
      ),
      false,
    );
    assert.equal(inScope(hit("f", { client_id: "client-1" }), scope), true);
    assert.equal(inScope(hit("g", { client_id: "client-2" }), scope), false);
  });
});

describe("rankHits", () => {
  it("merges full text and embeddings, keeping matches of either list", () => {
    const ranked = rankHits(
      [
        hit("text-only", { text_rank: 0.5 }),
        hit("vector-only", { vector_similarity: 0.8 }),
        hit("both", { text_rank: 0.4, vector_similarity: 0.7 }),
        hit("weak-vector", { vector_similarity: MIN_VECTOR_SIMILARITY - 0.01 }),
      ],
      scope,
    );
    assert.deepEqual(
      ranked.map((h) => h.id),
      ["both", "text-only", "vector-only"],
    );
  });

  it("drops rows outside the scope and keeps the top 8", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      hit(`s${String(i).padStart(2, "0")}`, { text_rank: 1 - i / 100 }),
    );
    const ranked = rankHits(
      [...many, hit("outside", { document_id: "doc-9", text_rank: 9 })],
      scope,
    );
    assert.equal(ranked.length, TOP_SECTIONS);
    assert.equal(ranked[0]!.id, "s00");
    assert.ok(!ranked.some((h) => h.id === "outside"));
  });
});

describe("searchSections", () => {
  it("calls nectar_search_sections with the scope's ids only, and the embedding when there is one", async () => {
    const db = new FakeDb().onRpc("nectar_search_sections", () => ({
      data: [hit("a", { text_rank: 0.2 })],
      error: null,
    }));
    const rows = await searchSections(db.client, scope, "missed dose", "[0.1]");
    assert.equal(rows.length, 1);
    assert.deepEqual(db.callsTo("nectar_search_sections")[0]!.payload, {
      p_organization_id: ORG,
      p_document_ids: ["doc-1"],
      p_state_document_ids: ["rule-1"],
      p_client_ids: ["client-1"],
      p_query: "missed dose",
      p_embedding: "[0.1]",
      p_limit: 20,
    });
    await searchSections(db.client, scope, "missed dose", null);
    assert.equal(
      "p_embedding" in (db.callsTo("nectar_search_sections")[1]!.payload as object),
      false,
    );
  });

  it("does not search an empty scope, and reports a failed search", async () => {
    const db = new FakeDb();
    assert.deepEqual(
      await searchSections(
        db.client,
        { orgId: ORG, documentIds: [], stateRuleIds: [], clientIds: [] },
        "q",
        null,
      ),
      [],
    );
    assert.equal(db.calls.length, 0);
    await assert.rejects(searchSections(db.client, scope, "q", null), /Could not search/);
  });
});
