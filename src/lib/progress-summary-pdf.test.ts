import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildSummaryDoc, emptyEditorState } from "./progress-summary-doc.ts";
import { renderSummaryPdf } from "./progress-summary-pdf.ts";

const doc = (lines: number) =>
  buildSummaryDoc({
    provider: "Example Supports",
    clientName: "Pat Example",
    coordinator: "Casey Sample",
    summary: {
      period_kind: "quarterly",
      period_label: "2026-Q4",
      period_start: "2026-10-01",
      period_end: "2026-12-31",
      due_date: "2027-01-15",
      service_codes: ["SLN"],
      include_goal_progress: true,
      drafted_at: "2026-10-08",
      status: "draft",
      finalized_at: null,
      finalized_by_name: null,
    },
    teamMembers: ["Sam Lee"],
    goals: [
      {
        id: "g1",
        goal: "Pat will cook a meal.",
        job_codes: ["SLN"],
        supports: [{ support: "Coaching → prompts", details: "Twice a week", codes: ["SLN"] }],
      },
    ],
    evidence: Array.from({ length: lines }, (_, i) => ({
      id: `e${i}`,
      kind: "daily_log" as const,
      date: "2026-10-03",
      who: "Sam Lee",
      text: `Cooked pasta with prompts, day ${i}. 🍝`,
      goalIds: ["g1"],
      labels: [],
      code: null,
    })),
    editor: {
      ...emptyEditorState(),
      goals: { g1: "Cooked twice." },
      incidentNotes: "None of note.",
    },
  });

describe("renderSummaryPdf", () => {
  it("renders a PDF with the document's title", async () => {
    const bytes = await renderSummaryPdf(doc(2), { clientName: "Pat Example" });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getTitle(), "Progress Summary - Pat Example");
    assert.equal(pdf.getPageCount(), 1);
  });

  it("runs onto more pages for long evidence lists; a bad logo never blocks it", async () => {
    const bytes = await renderSummaryPdf(doc(120), {
      clientName: "Pat Example",
      logo: { bytes: new Uint8Array([1, 2, 3]), type: "png" },
    });
    assert.ok((await PDFDocument.load(bytes)).getPageCount() > 1);
  });
});
