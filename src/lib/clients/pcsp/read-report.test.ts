import { test } from "node:test";
import assert from "node:assert/strict";
import { readPcspPages } from "./parser.ts";
import { initialReview } from "./review.ts";
import { proposeCarryOver } from "./carry-over.ts";
import {
  filedReport,
  inFolder,
  newClientPcspFolder,
  pcspFolder,
  readErrorKind,
  readFailure,
  readLogRow,
  readReport,
  savedReport,
} from "./read-report.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

const read = () => readPcspPages(structuredClone(SAMPLE_PCSP_PAGES), SAMPLE_AGENCY).result;

test("reading the fixture twice gives identical results (parse, review, summary)", () => {
  const a = read();
  const b = read();
  assert.deepStrictEqual(a, b);
  const review = (p: typeof a) => initialReview(p, proposeCarryOver(p.goals.map((g) => g.goal), [], p.lastYearGoals));
  assert.deepStrictEqual(review(a), review(b));
  assert.deepStrictEqual(readReport(a, SAMPLE_AGENCY.agencyName), readReport(b, SAMPLE_AGENCY.agencyName));
});

test("the read summary names what was filled, the plan year and our codes with units", () => {
  const r = readReport(read(), SAMPLE_AGENCY.agencyName);
  assert.equal(
    r.line,
    "Filled from the PCSP: name, PID, date of birth, phone, address, support coordinator, " +
      "plan year Sep 1, 2026 – Aug 31, 2027, 2 goals, 3 codes with units (DSI, HHS, SEI).",
  );
  assert.equal(r.noCodes, null);
});

test("no codes for us: says why and what to check", () => {
  const p = read();
  p.budget = p.budget.map((b) => ({ ...b, ours: false }));
  const r = readReport(p, "Example Supports, LLC");
  assert.ok(!/codes/.test(r.line));
  assert.equal(
    r.noCodes,
    "No purchased services for Example Supports, LLC were found. Check the agency's legal name in Settings matches the PCSP.",
  );
  assert.match(readReport(p, "").noCodes ?? "", /for your agency/);
});

test("an empty read says so", () => {
  const p = readPcspPages([], SAMPLE_AGENCY).result;
  assert.equal(readReport(p, "X").line, "Nothing could be read from this PCSP. Enter the details by hand.");
});

test("failures say the exact reason in plain words", () => {
  assert.equal(readFailure("Task timed out after 30.00 seconds"), "Couldn't read the PCSP: the server took too long.");
  assert.equal(readFailure("FUNCTION_INVOCATION_TIMEOUT"), "Couldn't read the PCSP: the server took too long.");
  assert.equal(readFailure("Request Entity Too Large (413)"), "Couldn't read the PCSP: the file is too big. Upload a copy under 15 MB.");
  assert.equal(readFailure("Failed to fetch"), "Couldn't read the PCSP: the connection dropped.");
  assert.equal(readFailure("Internal Server Error"), "Couldn't read the PCSP: the server hit an error.");
  assert.equal(
    readFailure("No text was found in this PDF (is it a scan?). Enter the plan by hand."),
    "Couldn't read the PCSP: no text was found in this PDF (is it a scan?). Enter the plan by hand.",
  );
  assert.equal(readErrorKind("Upload the PCSP as a PDF printed from USTEPS."), "not_pdf");
  assert.equal(readErrorKind("Upload failed: new row violates row-level security"), "storage");
  assert.equal(readErrorKind("something odd"), "server");
});

test("the read log row holds counts and codes only, never names, PIDs or text", () => {
  const p = read();
  const row = readLogRow({
    organizationId: "org", userId: "u1", source: "plans", pageCount: 6, parse: p,
    nectarSections: [], durationMs: 1234.6, error: null,
  });
  assert.deepEqual(row, {
    organization_id: "org", read_by: "u1", source: "plans", page_count: 6, goals_found: 2,
    codes_found: ["DSI", "HHS", "SEI"], nectar_sections: [], duration_ms: 1235, error_kind: null,
  });
  const text = JSON.stringify(row);
  for (const phi of [p.person.name, p.person.pid, p.person.residentialAddress, p.goals[0].goal]) {
    assert.ok(!text.includes(phi), phi);
  }
  const failed = readLogRow({
    organizationId: "org", userId: "u1", source: "new_client", pageCount: null, parse: null,
    nectarSections: [], durationMs: -5, error: "Couldn't read the PCSP: the server took too long.",
  });
  assert.deepEqual([failed.goals_found, failed.codes_found, failed.duration_ms, failed.error_kind], [null, [], 0, "timeout"]);
});

test("saved and filed results", () => {
  assert.equal(
    savedReport(
      { goals: 2, supports: 5, codes: ["DSI", "HHS"], contacts: 1, profile: ["PID", "phone"] },
      { start: "2026-09-01", end: "2027-08-31" },
    ),
    "Saved from the PCSP: PID, phone, plan year Sep 1, 2026 – Aug 31, 2027, 2 goals, 5 supports, 2 codes (DSI, HHS), 1 new contact.",
  );
  assert.equal(filedReport("filed"), "Filed in the Client file as the current PCSP.");
  assert.match(filedReport({ error: "no access" }), /couldn't be marked .*: no access/);
});

test("uploads are read only from the right folder", () => {
  assert.equal(pcspFolder("o", "c"), "o/c/pcsp/");
  assert.equal(newClientPcspFolder("o"), "o/new-clients/");
  assert.ok(inFolder("o/c/pcsp/1_plan.pdf", pcspFolder("o", "c")));
  assert.equal(inFolder("o/other/pcsp/1_plan.pdf", pcspFolder("o", "c")), false);
  assert.equal(inFolder("o/c/pcsp/../../x.pdf", pcspFolder("o", "c")), false);
  assert.equal(inFolder("o/new-clients/", newClientPcspFolder("o")), false);
});
