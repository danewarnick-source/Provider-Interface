import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AboutDoc } from "./about-me.ts";
import {
  MUST_KNOWS_MAX_ITEMS,
  approvalLine,
  checkMustKnowItems,
  formatMustKnows,
  isMustKnowSection,
  mustKnowSource,
  mustKnowsPrompt,
  parseMustKnows,
  splitBullet,
} from "./must-knows.ts";

const doc = (id: string, type: string, pages: string[]): AboutDoc => ({
  id,
  type,
  name: `${id}.pdf`,
  uploadedAt: "2026-09-01T00:00:00Z",
  pages,
});
const DOCS = [
  doc("pcsp-1", "pcsp", ["Choking risk.", "Fears dogs."]),
  doc("bsp-1", "bsp", ["Hits when rushed."]),
];

describe("checkMustKnowItems", () => {
  it("keeps sourced bullets with a known heading, in heading order, and drops the rest", () => {
    const out = checkMustKnowItems(
      [
        {
          section: "behaviors",
          text: "Give extra time; rushing leads to hitting.",
          source_doc_id: "bsp-1",
          source_page: 1,
        },
        { section: "Health", text: " Cut food   small. ", source_doc_id: "pcsp-1", source_page: 1 },
        { section: "health", text: "Made up.", source_doc_id: "not-a-doc", source_page: 1 },
        { section: "hobbies", text: "Likes music.", source_doc_id: "pcsp-1", source_page: 1 },
        { section: "trauma", text: "Fears dogs.", source_doc_id: "pcsp-1", source_page: 7 },
        { section: "other", text: "", source_doc_id: "pcsp-1", source_page: 1 },
        {
          section: "support",
          text: "From the old text.",
          source_doc_id: "existing",
          source_page: 4,
        },
        "junk",
      ],
      DOCS,
      true,
    );
    assert.deepEqual(out, [
      { section: "health", text: "Cut food small.", source_doc_id: "pcsp-1", source_page: 1 },
      {
        section: "behaviors",
        text: "Give extra time; rushing leads to hitting.",
        source_doc_id: "bsp-1",
        source_page: 1,
      },
      { section: "support", text: "From the old text.", source_doc_id: null, source_page: null },
    ]);
  });

  it("drops 'existing must-knows' bullets when nothing was written before, and caps the count", () => {
    const raw = [
      { section: "health", text: "Old note.", source_doc_id: "existing", source_page: null },
      ...Array.from({ length: 40 }, (_, i) => ({
        section: "health",
        text: `Point ${i}`,
        source_doc_id: "pcsp-1",
        source_page: 1,
      })),
    ];
    const out = checkMustKnowItems(raw, DOCS, false);
    assert.equal(out.length, MUST_KNOWS_MAX_ITEMS);
    assert.ok(out.every((i) => i.source_doc_id === "pcsp-1"));
  });

  it("knows its headings", () => {
    assert.ok(isMustKnowSection("trauma"));
    assert.ok(!isMustKnowSection("likes"));
  });
});

describe("prompt", () => {
  it("puts the existing must-knows before the labeled document pages", () => {
    const p = mustKnowsPrompt("Pat", "Allergic to cats.", DOCS);
    assert.match(p, /^PERSON: Pat\n\n\[EXISTING MUST-KNOWS\]\nAllergic to cats\./);
    assert.match(p, /\[DOCUMENT bsp-1 · BSP · page 1\]\nHits when rushed\./);
    assert.doesNotMatch(mustKnowsPrompt("Pat", "  ", DOCS), /EXISTING/);
  });
});

describe("special_directions text", () => {
  const items = [
    { section: "support" as const, text: "Stay within arm's reach at meals." },
    { section: "health" as const, text: "Choking risk:  cut food small." },
    { section: "health" as const, text: "  " },
  ];
  it("writes headings and '- ' bullets in heading order", () => {
    assert.equal(
      formatMustKnows(items),
      "Health:\n- Choking risk: cut food small.\n\nHow to support:\n- Stay within arm's reach at meals.",
    );
  });

  it("reads approved text back into the same headings and bullets", () => {
    const blocks = parseMustKnows(formatMustKnows(items));
    assert.deepEqual(
      blocks.map((b) => [b.heading, b.bullets.map((x) => x.text)]),
      [
        ["Health", ["Choking risk: cut food small."]],
        ["How to support", ["Stay within arm's reach at meals."]],
      ],
    );
  });

  it("reads PCSP risk blocks and plain text readably", () => {
    const blocks = parseMustKnows(
      "Allergic to cats.\nUses a walker.\n\nFrom PCSP 2026-10-01 – 2027-09-30:\n- Sam has GI problems. Response: Help with meals. Response time: Immediate.",
    );
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], {
      heading: null,
      bullets: [],
      text: ["Allergic to cats.", "Uses a walker."],
    });
    assert.equal(blocks[1].heading, "From PCSP Oct 1, 2026 – Sep 30, 2027");
    assert.deepEqual(blocks[1].bullets, [
      {
        text: "Sam has GI problems.",
        details: [
          { label: "Response", value: "Help with meals." },
          { label: "Response time", value: "Immediate." },
        ],
      },
    ]);
    assert.deepEqual(parseMustKnows(null), []);
  });

  it("leaves a bullet without response parts whole", () => {
    assert.deepEqual(splitBullet("Needs a ramp."), { text: "Needs a ramp.", details: [] });
  });
});

describe("wording", () => {
  it("names each bullet's source", () => {
    assert.equal(mustKnowSource({ source_doc_id: "pcsp-1", source_page: 2 }, DOCS), "PCSP p. 2");
    assert.equal(
      mustKnowSource({ source_doc_id: null, source_page: null }, DOCS),
      "Existing must-knows",
    );
    assert.equal(mustKnowSource({ source_doc_id: "gone", source_page: null }, DOCS), "Document");
  });

  it("says who approved, and when the text changed since", () => {
    const a = {
      approvedAt: "2026-10-08T15:00:00Z",
      approverName: "Pat Lee",
      approvedText: "Health:\n- A",
    };
    const when = () => "Oct 8, 2026";
    assert.equal(approvalLine(a, "Health:\n- A\n", when), "Approved Oct 8, 2026 by Pat Lee");
    assert.equal(
      approvalLine(a, "Health:\n- B", when),
      "Approved Oct 8, 2026 by Pat Lee, edited since",
    );
    assert.equal(approvalLine(null, "x", when), null);
  });
});
