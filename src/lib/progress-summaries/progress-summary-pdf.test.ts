import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
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
    evidence: [
      ...Array.from({ length: lines }, (_, i) => ({
        id: `e${i}`,
        kind: "daily_log" as const,
        date: "2026-10-03",
        who: "Sam Lee",
        text: `Cooked pasta with prompts, day ${i}. 🍝`,
        goalIds: ["g1"],
        labels: [],
        code: null,
      })),
      {
        id: "ir7",
        kind: "incident" as const,
        date: "2026-11-02",
        who: "#IR-7",
        text: "Fall: Slipped.",
        goalIds: [],
        labels: [],
        code: null,
      },
    ],
    editor: {
      ...emptyEditorState(),
      goals: { g1: "Cooked twice." },
      incidents: [{ id: "m1", date: "2026-11-02", what: "Fell in kitchen", followUp: "" }],
      incidentNotes: "Pat slipped in the kitchen once; staff helped her up and she was not hurt.",
    },
  });

/** The text drawn on every page (Helvetica, so each Tj string is hex WinAnsi). */
async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray
        ? contents.asArray().map((r) => pdf.context.lookup(r))
        : [contents];
    for (const st of streams) {
      if (!(st instanceof PDFRawStream)) continue;
      const ops = new TextDecoder("latin1").decode(decodePDFRawStream(st).decode());
      for (const m of ops.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
        out.push(Buffer.from(m[1], "hex").toString("latin1"));
      }
    }
  }
  return out.join("\n");
}

describe("renderSummaryPdf", () => {
  it("renders a PDF with the document's title", async () => {
    const bytes = await renderSummaryPdf(doc(2), { clientName: "Pat Example" });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getTitle(), "Progress Summary - Pat Example");
    assert.equal(pdf.getPageCount(), 1);
  });

  it("prints the summary only: no evidence lists, no incident records; a bad logo never blocks it", async () => {
    const bytes = await renderSummaryPdf(doc(120), {
      clientName: "Pat Example",
      logo: { bytes: new Uint8Array([1, 2, 3]), type: "png" },
    });
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
    const text = await pdfText(bytes);
    assert.match(text, /Pat will cook a meal\./);
    assert.match(text, /Support: Coaching/);
    assert.match(text, /Cooked twice\./);
    assert.match(text, /^Incidents$/m);
    assert.match(text, /Pat slipped in the kitchen once/);
    assert.match(text, /General notes/);
    assert.doesNotMatch(text, /Evidence this period/);
    assert.doesNotMatch(text, /Cooked pasta with prompts/);
    assert.doesNotMatch(text, /Fell in kitchen/);
    assert.doesNotMatch(text, /IR-7|Slipped/);
    assert.doesNotMatch(text, /Nov 2, 2026/);
  });
});
