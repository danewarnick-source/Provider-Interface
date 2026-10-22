import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  medListFilename,
  medListLines,
  printableMeds,
  prnRule,
  renderMedListPdf,
  type MedListMed,
} from "./med-list-pdf.ts";

const sched: MedListMed = {
  medication_name: "Sertraline",
  strength: "50 mg",
  dosage: "1 tablet",
  route: "By mouth",
  scheduled_times: ["08:00"],
  purpose: "Depression",
  side_effects: "Upset stomach",
  how_taken: "assist",
  prescriber: "Dr. Lee",
  start_date: "2026-10-01",
  is_active: true,
};
const prn: MedListMed = {
  medication_name: "Acetaminophen",
  is_prn: true,
  prn_instructions: "Pain over 4",
  prn_min_hours: 4,
  prn_max_per_day: 3,
  is_active: true,
};

describe("med-list-pdf", () => {
  it("builds the lines for a scheduled med", () => {
    const lines = Object.fromEntries(medListLines(sched));
    assert.equal(lines.When, "8:00 AM");
    assert.equal(lines["How they take it"], "Staff help (prompt, open, hand it over)");
    assert.equal(lines.PRN, undefined);
    assert.equal(lines.Started, "2026-10-01");
  });

  it("writes the PRN rules", () => {
    assert.equal(prnRule(prn), "Pain over 4; at least 4 hours apart; no more than 3 in 24 hours");
    assert.equal(prnRule(sched), null);
  });

  it("prints active meds only, PRNs last", () => {
    const list = printableMeds([
      prn,
      sched,
      { medication_name: "Old", is_active: false, discontinued_at: "2026-01-01T00:00:00Z" },
      { medication_name: "Held", is_active: true, paused_at: "2026-01-01T00:00:00Z" },
    ]);
    assert.deepEqual(
      list.map((m) => m.medication_name),
      ["Sertraline", "Acetaminophen"],
    );
  });

  it("names the file safely", () => {
    assert.equal(medListFilename("Ann O'Neil"), "Ann-ONeil-medication-list.pdf");
  });

  it("renders a PDF", async () => {
    const bytes = await renderMedListPdf([sched, prn], {
      provider: "True North Supports",
      client: "Ann Lee",
      dob: "2000-01-01",
      allergies: ["Penicillin"],
      swallowingRisk: "Yes",
      printedBy: "Jeff",
      printedAt: "Oct 14, 2026 3:05 PM",
    });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  });
});
