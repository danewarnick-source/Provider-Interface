import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildStrategiesDoc, planYearText, strategiesFileName } from "./strategies-doc.ts";
import { renderStrategiesPdf } from "./strategies-pdf.ts";
import { pdfSafe } from "./strategies-pdf-layout.ts";
import { agencySupports, buildStrategySections } from "./support-strategies.ts";
import type { GoalView } from "./plans.ts";

const goals: GoalView[] = [
  {
    id: "g1",
    kind: "goal",
    goal: "Lee will shop for groceries.",
    domain: null,
    supports: [
      {
        id: "s1",
        support_text: "Coach Lee at the store.",
        details: "Use a list.",
        our_codes: ["SLH"],
      },
      { id: "s2", support_text: "Rides to the store.", details: null, our_codes: ["MTP"] },
    ],
  },
  {
    id: "g2",
    kind: "goal",
    goal: "Lee will find a job.",
    domain: null,
    supports: [{ id: "s3", support_text: "Job development.", details: null, our_codes: ["SJD"] }],
  },
];
const sections = buildStrategySections(
  agencySupports(goals),
  [],
  new Map([["s1", "- Staff review the list with Lee.\n- Staff let Lee pick items."]]),
);
const input = {
  providerName: "Example Supports LLC",
  clientName: "Lee Sample",
  plan: { start_date: "2026-08-01", end_date: "2027-07-31" },
  coordinatorName: "Casey Coordinator",
  approverName: "Robin Admin",
  approvedAt: "2026-09-25T15:00:00Z",
  preparedOn: "2026-10-08",
  content: { sections },
};

describe("buildStrategiesDoc", () => {
  it("holds the header facts, goals with supports, codes and bullets", () => {
    const doc = buildStrategiesDoc(input)!;
    assert.equal(doc.client, "Lee Sample");
    assert.equal(doc.coordinator, "Casey Coordinator");
    assert.equal(doc.planYear, "Aug 1, 2026 – Jul 31, 2027");
    assert.equal(doc.prepared, "Oct 8, 2026");
    assert.equal(doc.approved, "Sep 25, 2026 by Robin Admin");
    assert.deepEqual(
      doc.goals.map((g) => g.goal),
      ["Lee will shop for groceries.", "Lee will find a job."],
    );
    assert.deepEqual(doc.goals[0].supports[0], {
      support: "Coach Lee at the store.",
      details: "Use a list.",
      codes: ["SLH"],
      bullets: ["Staff review the list with Lee.", "Staff let Lee pick items."],
    });
    assert.deepEqual(doc.goals[1].supports[0].bullets, []);
  });

  it("lists services needing no strategy with the reason, and the footer", () => {
    const doc = buildStrategiesDoc(input)!;
    assert.deepEqual(doc.notNeeded, [
      {
        goal: "Lee will shop for groceries.",
        support: "Rides to the store.",
        codes: ["MTP"],
        reason: "Not needed (§1.24(5))",
      },
    ]);
    assert.match(doc.footer[0], /within 30 days of PCSP activation/);
    assert.match(doc.footer[2], /UPI within 2 weeks/);
  });

  it("says Not on file for missing facts, and is null with nothing per support", () => {
    const doc = buildStrategiesDoc({ ...input, coordinatorName: null, plan: null })!;
    assert.deepEqual([doc.coordinator, doc.planYear], ["Not on file", "Not on file"]);
    assert.equal(buildStrategiesDoc({ ...input, content: { sections: [] } }), null);
    assert.equal(planYearText({ start_date: "2026-08-01", end_date: null }), "Aug 1, 2026 – open");
    assert.equal(strategiesFileName("Lee Sample"), "support-strategies-lee-sample.pdf");
  });
});

describe("renderStrategiesPdf", () => {
  it("renders a PDF with a page count", async () => {
    const bytes = await renderStrategiesPdf(buildStrategiesDoc(input)!);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= 1);
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  });

  it("keeps text the standard fonts can draw", () => {
    assert.equal(pdfSafe("A → B ✓ §–"), "A - B ? §–");
  });
});

describe("who can get the document", () => {
  it("is editors only, never staff", () => {
    const src = readFileSync(new URL("./strategies-doc.functions.ts", import.meta.url), "utf8");
    assert.match(src, /action: "edit"/);
    assert.doesNotMatch(src, /action: "view"/);
  });
});
