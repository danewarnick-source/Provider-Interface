import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ABOUT_MAX_ITEMS,
  aboutPrompt,
  boldLead,
  checkAboutItems,
  docKindLabel,
  docsPrompt,
  hasNewKeyDocs,
  parseAboutReply,
  sourceLabel,
  summarySources,
  unreadableDocs,
  type AboutDoc,
} from "./about-me.ts";

const doc = (
  id: string,
  type: string,
  pages: string[],
  uploadedAt = "2026-09-01T00:00:00Z",
): AboutDoc => ({
  id,
  type,
  name: `${id}.pdf`,
  uploadedAt,
  pages,
});
const DOCS = [
  doc("pcsp-1", "pcsp", ["Likes music.", "Walks every morning."]),
  doc("bsp-1", "bsp", ["Gets upset by loud rooms."]),
  doc("scan-1", "face_sheet", [""]),
];

describe("checkAboutItems", () => {
  it("keeps bullets whose source is one of the client's documents and drops the rest", () => {
    const out = checkAboutItems(
      [
        { text: "Loves music.", source_doc_id: "pcsp-1", source_page: 1 },
        { text: "Made up fact.", source_doc_id: "not-a-doc", source_page: 1 },
        { text: "No source at all." },
        { text: "Walks every morning.", source_doc_id: "pcsp-1", source_page: 9 },
        { text: "  Gets upset by   loud rooms. ", source_doc_id: "bsp-1", source_page: "1" },
        { text: "", source_doc_id: "pcsp-1", source_page: 1 },
        "junk",
      ],
      DOCS,
    );
    assert.deepEqual(out, [
      { text: "Loves music.", source_doc_id: "pcsp-1", source_page: 1 },
      { text: "Gets upset by loud rooms.", source_doc_id: "bsp-1", source_page: 1 },
    ]);
  });

  it("drops medical and incident bullets and repeats, and caps the count", () => {
    const raw = [
      { text: "Takes medication at 8.", source_doc_id: "pcsp-1", source_page: 1 },
      { text: "Diagnosed with something.", source_doc_id: "pcsp-1", source_page: 1 },
      { text: "Had an incident last year.", source_doc_id: "bsp-1", source_page: 1 },
      ...Array.from({ length: 14 }, (_, i) => ({
        text: `Fact ${i % 12}`,
        source_doc_id: "pcsp-1",
        source_page: 2,
      })),
    ];
    const out = checkAboutItems(raw, DOCS);
    assert.equal(out.length, ABOUT_MAX_ITEMS);
    assert.ok(out.every((i) => i.text.startsWith("Fact")));
  });
});

describe("parseAboutReply", () => {
  it("reads the items array, even inside a code fence; bad JSON gives none", () => {
    assert.equal(parseAboutReply('{"items":[{"text":"a"}]}').length, 1);
    assert.equal(parseAboutReply('```json\n{"items":[{"text":"a"}]}\n```').length, 1);
    assert.deepEqual(parseAboutReply("not json"), []);
    assert.deepEqual(parseAboutReply('{"items":"x"}'), []);
  });
});

describe("prompt and unreadable documents", () => {
  it("labels every page with its document id and skips scans", () => {
    const p = aboutPrompt("Pat", DOCS);
    assert.match(p, /\[DOCUMENT pcsp-1 · PCSP · page 2\]\nWalks every morning\./);
    assert.doesNotMatch(p, /scan-1/);
    assert.match(docsPrompt("HEADER", DOCS), /^HEADER\n\n\[DOCUMENT pcsp-1 · PCSP · page 1\]/);
    assert.deepEqual(
      unreadableDocs(DOCS).map((d) => d.id),
      ["scan-1"],
    );
  });
});

describe("wording", () => {
  it("names document kinds plainly", () => {
    assert.equal(docKindLabel("pcsp"), "PCSP");
    assert.equal(docKindLabel("behavior_support_plan"), "BSP");
    assert.equal(docKindLabel("face_sheet"), "face sheet");
    assert.equal(docKindLabel("financial_support_budget"), "financial support budget");
  });
  it("bolds a natural lead word", () => {
    assert.deepEqual(boldLead("Loves running."), { lead: "Loves", rest: " running." });
    assert.deepEqual(boldLead("Doesn't like crowds."), { lead: "Doesn't like", rest: " crowds." });
    assert.deepEqual(boldLead("His sister visits."), { lead: "", rest: "His sister visits." });
  });
  it("shows each bullet's source and the footer's documents", () => {
    const items = [
      { text: "a", source_doc_id: "pcsp-1", source_page: 2 },
      { text: "b", source_doc_id: "bsp-1", source_page: null },
      { text: "c", source_doc_id: "pcsp-1", source_page: 1 },
    ];
    assert.equal(sourceLabel(items[0], DOCS), "PCSP p. 2");
    assert.equal(sourceLabel(items[1], DOCS), "BSP");
    assert.equal(summarySources(items, DOCS), "Summary from PCSP, BSP");
  });
});

describe("hasNewKeyDocs", () => {
  const approved = { approvedAt: "2026-10-06T12:00:00+00:00", basedOn: ["pcsp-1"] };
  it("flags a PCSP, BSP or face sheet uploaded after approval", () => {
    assert.equal(
      hasNewKeyDocs(approved, [doc("pcsp-2", "pcsp", [], "2026-10-07T08:00:00.000Z")]),
      true,
    );
    assert.equal(hasNewKeyDocs(approved, [doc("old", "bsp", [], "2026-10-01T08:00:00Z")]), false);
    assert.equal(
      hasNewKeyDocs(approved, [doc("x", "financial_support_budget", [], "2026-10-08T00:00:00Z")]),
      false,
    );
    assert.equal(
      hasNewKeyDocs(approved, [doc("pcsp-1", "pcsp", [], "2026-10-08T00:00:00Z")]),
      false,
    );
  });
});
