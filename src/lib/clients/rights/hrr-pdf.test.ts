import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { hrrPdfFilename, hrrSignatureBlocks, renderHrrPdf } from "./hrr-pdf.ts";
import type { RestrictionRecord } from "./hrc.ts";

const base = {
  id: "r1",
  organization_id: "o1",
  client_id: "c1",
  restriction_title: "Locked pantry at night",
  active: true,
  assessed_need_text: "Night eating risk",
  positive_interventions_text: "Evening snack plan",
  less_intrusive_methods_text: "Door chime",
  condition_description_text: "Pantry locked 10pm to 6am",
  data_review_text: "Weekly log",
  last_review_date: "2026-09-01",
  time_limits_text: "Every 90 days",
  next_review_date: "2026-12-01",
  restore_plan_text: null,
  no_harm_text: "Food available on request",
  document_id: null,
  nectar_fields: [],
  consent_signer_name: "Pat Example",
  consent_signer_role: "guardian",
  consent_client_name: "Jo Client",
  consent_by: "u1",
  consent_at: "2026-10-02T10:30:00Z",
  admin_signer_name: "Alex Admin",
  admin_signed_by: "u1",
  admin_signed_at: "2026-10-02T11:00:00Z",
  sc_name: "Sam Coordinator",
  sc_signed_on: "2026-10-03",
  sc_method: "in_person",
  sc_recorded_by: "u2",
  sc_recorded_at: "2026-10-03T09:00:00Z",
  hrc_decision: "approved",
  hrc_decision_on: "2026-10-04",
  hrc_recorded_by: "u1",
  hrc_recorded_at: "2026-10-04T09:00:00Z",
  created_by: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-04T00:00:00Z",
} satisfies RestrictionRecord;

const ctx = {
  provider: "True North Supports",
  client: "Jo Client",
  people: new Map([
    ["u1", "Alex Admin"],
    ["u2", "Riley Staff"],
  ]),
};

describe("HRR PDF", () => {
  it("signature blocks carry consent, admin, SC and HRC with who and when", () => {
    const blocks = hrrSignatureBlocks(base, ctx);
    assert.deepEqual(
      blocks.map((b) => b.heading),
      ["Informed consent", "Provider admin", "Support coordinator", "Human Rights Committee"],
    );
    const consent = blocks[0].lines.join("\n");
    assert.match(consent, /Guardian: Pat Example/);
    assert.match(consent, /Client: Jo Client/);
    assert.match(consent, /Entered by Alex Admin on 2026-10-02 10:30 UTC/);
    assert.match(blocks[2].lines.join("\n"), /Date signed: 2026-10-03 \(In person\)/);
    assert.match(blocks[2].lines.join("\n"), /Recorded by Riley Staff/);
    assert.match(blocks[3].lines[0], /Approved on 2026-10-04/);
  });
  it("unsigned blocks say so", () => {
    const blocks = hrrSignatureBlocks(
      {
        ...base,
        consent_signer_name: null,
        admin_signer_name: null,
        sc_name: null,
        hrc_decision: null,
      },
      ctx,
    );
    assert.deepEqual(
      blocks.map((b) => b.lines[0]),
      ["Not signed yet.", "Not signed yet.", "Not signed yet.", "No decision recorded yet."],
    );
  });
  it("renders a PDF with a title", async () => {
    const bytes = await renderHrrPdf(base, ctx);
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 1);
    assert.equal(doc.getTitle(), "Rights restriction - Locked pantry at night - Jo Client");
  });
  it("file name is safe", () => {
    assert.equal(
      hrrPdfFilename(base, "Jo Client"),
      "Jo-Client-rights-restriction-Locked-pantry-at-night.pdf",
    );
  });
});
