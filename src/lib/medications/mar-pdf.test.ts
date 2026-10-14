import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { denverWallToIso } from "../denver-date.ts";
import { buildMarGrid } from "./mar-grid.ts";
import type { MarMonthData } from "./mar-data.ts";
import { MAR_PDF_SECTIONS, renderMarPdf } from "./mar-pdf.ts";
import {
  changeRows,
  countRows,
  dayLabel,
  doseCountCells,
  exceptionRows,
  medicationListRows,
  prnRows,
  signatureRows,
} from "./mar-pdf-rows.ts";

const at = (day: string, h: number, m = 0) => denverWallToIso(day, h, m);

export function fixture(): MarMonthData {
  const meds = [
    {
      id: "m1",
      medication_name: "Sertraline",
      strength: "50 mg",
      dosage: "1 tablet",
      route: "By mouth",
      scheduled_times: ["08:00"],
      purpose: "Depression",
      prescriber: "Dr. Lee",
      start_date: "2026-08-01",
      is_active: true,
      is_psychotropic: true,
      psychotropic_type: "antidepressant",
    },
    {
      id: "m2",
      medication_name: "Lorazepam",
      strength: "1 mg",
      dosage: "1 tablet",
      route: "By mouth",
      is_prn: true,
      prn_instructions: "Severe anxiety",
      prn_min_hours: 6,
      prn_max_per_day: 2,
      is_controlled: true,
      controlled_schedule: "IV",
      start_date: "2026-08-01",
      is_active: true,
    },
  ];
  const doses = [
    {
      id: "d1",
      medication_id: "m1",
      scheduled_for: at("2026-09-01", 8),
      status: "administered",
      actual_taken_at: at("2026-09-01", 8, 4),
      documented_at: at("2026-09-01", 8, 5),
      staff_id: "s1",
      staff_name: "Tara Jones",
      route: "By mouth",
    },
    {
      id: "d2",
      medication_id: "m1",
      scheduled_for: at("2026-09-02", 8),
      status: "refused",
      exception_reason: "Said no twice",
      staff_id: "s1",
    },
    {
      id: "d3",
      medication_id: "m1",
      scheduled_for: at("2026-09-03", 8),
      status: "administered",
      actual_taken_at: at("2026-09-03", 8),
      documented_at: at("2026-09-03", 10),
      staff_id: "s2",
      is_medication_error: true,
      error_description: "Given twice",
    },
    {
      id: "p1",
      medication_id: "m2",
      scheduled_for: at("2026-09-04", 15),
      status: "administered",
      actual_taken_at: at("2026-09-04", 15),
      documented_at: at("2026-09-04", 15, 1),
      staff_id: "s2",
      is_prn: true,
      prn_reason: "Pacing and yelling",
      prn_tried_first: "Quiet room",
      prn_effect: "helped",
      prn_followup_due_at: at("2026-09-04", 16),
      prn_followup_at: at("2026-09-04", 16, 2),
    },
  ];
  const initials = new Map([
    ["s1", "TJ"],
    ["s2", "BK"],
  ]);
  return {
    month: "2026-09",
    meds,
    changes: [
      {
        id: "c1",
        medication_id: "m1",
        action: "edit",
        changed_at: at("2026-09-10", 9),
        changed_by: "s3",
        changes: { dosage: { from: "half", to: "1 tablet" } },
        reason: "New order",
      },
    ],
    doses,
    addenda: [
      {
        id: "a1",
        emar_log_id: "d3",
        note: "Second dose was a sticker mix-up",
        reason: "Wrong box ticked",
        staff_id: "s3",
        staff_name: "Ann Admin",
        created_at: at("2026-09-03", 12),
      },
    ],
    counts: [
      {
        id: "k1",
        medication_id: "m2",
        emar_log_id: "p1",
        context: "pass",
        expected_count: 20,
        counted_value: 19,
        count_after: 18,
        expected_after: 19,
        variance: -1,
        flagged: true,
        staff_id: "s2",
        staff_name: "Bo King",
        created_at: at("2026-09-04", 15),
      },
    ],
    incidents: { d3: "IR-2026-014" },
    staff: [
      { id: "s2", full_name: "Bo King", title: "DSP", initials: "BK" },
      { id: "s1", full_name: "Tara Jones", title: "House Manager", initials: "TJ" },
    ],
    names: { s3: "Ann Admin" },
    review: null,
    grid: buildMarGrid({
      month: "2026-09",
      meds,
      changes: [],
      logs: doses,
      initials,
      now: new Date(at("2026-10-02", 9)),
    }),
  };
}

/** Text drawn in the PDF (content streams inflated, hex strings decoded). */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  let out = "";
  let i = 0;
  while ((i = raw.indexOf("stream", i)) >= 0) {
    let s = i + 6;
    if (raw[s] === 0x0d) s++;
    if (raw[s] === 0x0a) s++;
    const e = raw.indexOf("endstream", s);
    if (e < 0) break;
    try {
      out += inflateSync(raw.subarray(s, e)).toString("latin1");
    } catch {
      out += raw.subarray(s, e).toString("latin1");
    }
    i = e + 9;
  }
  return out.replace(/<([0-9A-Fa-f]+)>/g, (_, h: string) =>
    Buffer.from(h, "hex").toString("latin1"),
  );
}

describe("mar-pdf rows", () => {
  const data = fixture();

  it("lists each medication with its rules and flags", () => {
    const [sert, lor] = medicationListRows(data);
    assert.equal(sert[0], "Sertraline 50 mg");
    assert.equal(sert[3], "8:00 AM");
    assert.equal(sert[9], "Psychotropic (antidepressant)");
    assert.match(lor[8], /Severe anxiety; at least 6 hours apart; no more than 2 in 24 hours/);
    assert.equal(lor[9], "Controlled C-IV");
  });

  it("lists changes with who made them", () => {
    assert.deepEqual(changeRows(data)[0], [
      "Sep 10",
      "Sertraline 50 mg",
      "Changed",
      "dosage - New order",
      "Ann Admin",
    ]);
  });

  it("builds the signature key, PRN log and counts", () => {
    assert.deepEqual(signatureRows(data)[0], ["BK", "Bo King", "DSP"]);
    const prn = prnRows(data)[0];
    assert.deepEqual(prn.slice(0, 3), ["Sep 4", "3:00p", "Lorazepam 1 mg"]);
    assert.equal(prn[4], "Pacing and yelling");
    assert.equal(prn[6], "Helped");
    assert.equal(prn[7], "4:02p");
    assert.deepEqual(prn.slice(8), ["19", "18", "Bo King"]);
    assert.deepEqual(countRows(data)[0], [
      "Sep 4",
      "3:00p",
      "Lorazepam 1 mg",
      "19",
      "18",
      "20",
      "19",
      "Flagged",
      "Bo King",
    ]);
  });

  it("count cells: stored counts for controlled doses, Not recorded when missing, blank otherwise", () => {
    assert.deepEqual(doseCountCells({ controlled: true, before: 12, after: 11 }), ["12", "11"]);
    assert.deepEqual(doseCountCells({ controlled: true, before: 0, after: 0 }), ["0", "0"]);
    assert.deepEqual(doseCountCells({ controlled: true, before: 12, after: null }), [
      "12",
      "Not recorded",
    ]);
    assert.deepEqual(doseCountCells({ controlled: true, before: undefined, after: 4 }), [
      "Not recorded",
      "4",
    ]);
    assert.deepEqual(doseCountCells({ controlled: false, before: 12, after: 11 }), ["", ""]);
  });

  it("every controlled dose gets a count row; an older dose without counts says Not recorded", () => {
    const older = {
      ...data,
      doses: [
        ...data.doses,
        {
          id: "p0",
          medication_id: "m2",
          scheduled_for: at("2026-09-02", 15),
          status: "administered",
          actual_taken_at: at("2026-09-02", 15),
          documented_at: at("2026-09-02", 15),
          staff_id: "s1",
          is_prn: true,
          is_controlled: true,
          pill_count_value: 21,
        },
      ],
    };
    const rows = countRows(older);
    assert.equal(rows.length, 2);
    const old = rows.find((r) => r[0] === "Sep 2");
    assert.deepEqual(old?.slice(3, 8), ["21", "Not recorded", "", "", ""]);
    // Non-controlled doses never get a count row; their PRN cells stay blank.
    assert.ok(!rows.some((r) => r[2].startsWith("Sertraline")));
    const nonControlled = prnRows({
      ...data,
      doses: [{ ...data.doses[3], id: "p5", medication_id: "m1", is_controlled: false }],
    })[0];
    assert.deepEqual(nonControlled.slice(8, 10), ["", ""]);
  });

  it("lists refusals, misses, errors with incident numbers, late entries and corrections", () => {
    const rows = exceptionRows(data);
    const what = rows.map((r) => r[3]);
    assert.ok(what.includes("Refused"));
    assert.ok(what.includes("Missed"));
    const err = rows.find((r) => r[3] === "Medication error");
    assert.match(err?.[4] ?? "", /Incident IR-2026-014/);
    assert.ok(rows.find((r) => r[3] === "Late entry"));
    const fix = rows.find((r) => r[3] === "Correction");
    assert.match(fix?.[4] ?? "", /Original: Given .* by Bo King\. Correction: Second dose/);
    assert.match(fix?.[4] ?? "", /Reason: Wrong box ticked/);
  });

  it("lists late doses and PRNs given past their limits (Give meds)", () => {
    const late = {
      ...data,
      doses: [
        ...data.doses,
        {
          id: "d9",
          medication_id: "m1",
          scheduled_for: at("2026-09-06", 8),
          status: "administered",
          actual_taken_at: at("2026-09-06", 9, 30),
          documented_at: at("2026-09-06", 9, 31),
          staff_id: "s1",
        },
        {
          id: "p9",
          medication_id: "m2",
          scheduled_for: at("2026-09-07", 15),
          status: "administered",
          actual_taken_at: at("2026-09-07", 15),
          documented_at: at("2026-09-07", 15),
          staff_id: "s2",
          is_prn: true,
          exception_reason: "PRN limit override: nurse said yes",
        },
      ],
    };
    const rows = exceptionRows(late);
    assert.match(rows.find((r) => r[3] === "Late dose")?.[4] ?? "", /^Due .*, taken /);
    assert.equal(rows.find((r) => r[3] === "PRN past its limit")?.[4], "Reason: nurse said yes");
  });

  it("labels days", () => {
    assert.equal(dayLabel("2026-09-05"), "Sep 5");
  });
});

describe("renderMarPdf", () => {
  it("prints every page with the client header", async () => {
    const bytes = await renderMarPdf({
      header: {
        provider: "True North Supports",
        client: "Ann Lee",
        dob: "2000-01-01",
        medicaidId: "123456",
        month: "September 2026",
        allergies: "Penicillin",
      },
      data: fixture(),
      review: { by: "Jeff Admin", at: "Oct 2, 2026 9:00 AM", notes: null },
      printed: "Printed Oct 2, 2026",
    });
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
    const text = pdfText(bytes);
    for (const section of MAR_PDF_SECTIONS) assert.ok(text.includes(section), section);
    assert.ok(text.includes("Medicaid ID: 123456"));
    assert.ok(text.includes("Allergies: Penicillin"));
    assert.ok(text.includes("TJ 8:04a"));
    assert.ok(text.includes("Jeff Admin"));
    assert.ok(text.includes("IR-2026-014"));
    assert.ok(text.includes("Count before"));
    assert.ok(text.includes("Count after"));
  });
});
