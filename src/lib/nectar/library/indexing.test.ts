import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batches,
  EMBED_DIMENSIONS,
  embeddingInput,
  sectionRows,
  shouldEmbed,
  vectorLiteral,
} from "./indexing.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sections = [
  { heading: "Purpose", body: "Why the policy exists.", position: 0 },
  { heading: null, body: "More text.", position: 1 },
];

describe("knowledge_sections rows (N3)", () => {
  it("write a library version's sections with its organization, document and version", () => {
    const rows = sectionRows(
      {
        kind: "library",
        organizationId: ORG,
        documentId: "doc-1",
        version: 3,
        title: "Grievance Policy",
      },
      sections,
      ["[0.1]", null],
    );
    assert.deepEqual(rows[0], {
      organization_id: ORG,
      document_id: "doc-1",
      state_document_id: null,
      version: 3,
      heading: "Purpose",
      body: "Why the policy exists.",
      position: 0,
      embedding: "[0.1]",
    });
    assert.equal(rows[1]!.embedding, null, "no embedding yet: still found by full-text search");
  });

  it("write a state rule's sections with no organization", () => {
    const [row] = sectionRows(
      { kind: "state", stateDocumentId: "sr-1", version: 1, title: "SOW" },
      sections,
    );
    assert.equal(row!.organization_id, null);
    assert.equal(row!.document_id, null);
    assert.equal(row!.state_document_id, "sr-1");
  });

  it("embed the title, heading and text at size 1024", () => {
    assert.equal(
      embeddingInput("Grievance Policy", sections[0]!),
      "Grievance Policy\nPurpose\nWhy the policy exists.",
    );
    assert.equal(embeddingInput("T", { heading: null, body: "x".repeat(9000) }).length, 8000);
    assert.equal(EMBED_DIMENSIONS, 1024);
    const vec = Array.from({ length: 1024 }, (_, i) => i / 1024);
    assert.equal(vectorLiteral(vec), `[${vec.join(",")}]`);
    assert.equal(vectorLiteral(vec.slice(1)), null, "wrong size");
    assert.equal(vectorLiteral([...vec.slice(1), Number.NaN]), null);
    assert.equal(vectorLiteral("nope"), null);
  });

  it("embed in batches, and only while the agency has Nectar and Ask on", () => {
    assert.deepEqual(batches(10, 4), [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9],
    ]);
    assert.deepEqual(batches(0), []);
    assert.equal(shouldEmbed({ enabled: true, ask: true }), true);
    assert.equal(shouldEmbed({ enabled: false, ask: true }), false);
    assert.equal(shouldEmbed({ enabled: true, ask: false }), false);
  });
});
