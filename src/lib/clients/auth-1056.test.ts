import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initial1056Review,
  parseAmount,
  parseFormDate,
  read1056Checks,
  read1056FromReply,
  read1056Messages,
  review1056Problems,
  rowsFrom1056,
} from "./auth-1056.ts";

// Made-up 1056 text (no real person).
const TEXT = [
  "[page 1] Service Authorization 1056   Authorization #: 900111",
  "[page 1] Approved: 06/20/2026",
  "[page 2] DSI  Rate $5.25  Units 1,200  07/01/2026 - 06/30/2027",
  "[page 2] COM  Rate $6.00  Units 80.5  07/01/2026 - 06/30/2027",
].join("\n");

const f = (value: string, page: number | null, quote: string) => ({ value, page, quote });

const REPLY = {
  authorizationNumber: f("900111", 1, "Authorization #: 900111"),
  approvedOn: f("06/20/2026", 1, "Approved: 06/20/2026"),
  lines: [
    {
      code: f("DSI", 2, "DSI Rate $5.25"),
      rate: f("$5.25", 2, "Rate $5.25"),
      annualUnits: f("1,200", 2, "Units 1,200"),
      start: f("07/01/2026", 2, "07/01/2026 - 06/30/2027"),
      end: f("06/30/2027", 2, "07/01/2026 - 06/30/2027"),
    },
    {
      code: f("COM", 2, "COM Rate $6.00"),
      rate: f("6.00", 2, "Rate $6.00"),
      annualUnits: f("80.5", 2, "Units 80.5"),
      start: f("07/01/2026", 2, "07/01/2026"),
      end: f("06/30/2027", 2, "I made this up"),
    },
  ],
};

describe("read1056FromReply", () => {
  it("keeps values whose quote is in the document, with page numbers", () => {
    const r = read1056FromReply(REPLY, TEXT);
    assert.equal(r.authorizationNumber.value, "900111");
    assert.equal(r.approvedOn.value, "2026-06-20");
    assert.equal(r.lines[0].rate.value, 5.25);
    assert.equal(r.lines[0].annualUnits.value, 1200);
    assert.equal(r.lines[0].start.page, 2);
  });
  it("drops a value whose quote isn't in the document", () => {
    const r = read1056FromReply(REPLY, TEXT);
    assert.equal(r.lines[1].end.value, null);
    assert.ok(read1056Checks(r).some((c) => /COM: couldn't read end/.test(c)));
  });
  it("survives junk replies", () => {
    assert.deepEqual(read1056FromReply(null, TEXT).lines, []);
    assert.ok(read1056Checks(read1056FromReply("x", TEXT)).length >= 3);
  });
  it("sends only the document text in a fixed prompt", () => {
    const m = read1056Messages(TEXT);
    assert.equal(m.length, 2);
    assert.match(m[0].content, /Never guess/);
  });
});

describe("parse helpers", () => {
  it("reads amounts and form dates", () => {
    assert.equal(parseAmount("$1,234.50"), 1234.5);
    assert.equal(parseAmount("abc"), null);
    assert.equal(parseFormDate("7/1/2026"), "2026-07-01");
    assert.equal(parseFormDate("2026-02-30"), null);
  });
});

describe("1056 review", () => {
  const read = read1056FromReply(REPLY, TEXT);
  it("unticks lines for codes the agency isn't approved for", () => {
    const review = initial1056Review(read, ["DSI", "SEI"]);
    assert.deepEqual(review.lines.map((l) => l.include), [true, false]);
    assert.deepEqual(review1056Problems(review, ["DSI", "SEI"]), []);
  });
  it("blocks confirm for unapproved codes, missing dates and part units", () => {
    const review = initial1056Review(read, ["DSI"]);
    review.lines[1].include = true;
    const problems = review1056Problems(review, ["DSI"]);
    assert.ok(problems.some((p) => /approved codes/.test(p)));
    assert.ok(problems.some((p) => /whole number/.test(p)));
    assert.ok(problems.some((p) => /end date/.test(p)));
  });
  it("blocks a code listed twice and an empty review", () => {
    const review = initial1056Review(read, []);
    review.lines[1] = { ...review.lines[0] };
    assert.ok(review1056Problems(review, []).some((p) => /twice/.test(p)));
    review.lines.forEach((l) => (l.include = false));
    assert.deepEqual(review1056Problems(review, []), ["Keep at least one line, or cancel."]);
  });
  it("builds authorization rows with the 1056 number and source", () => {
    const review = initial1056Review(read, ["DSI"]);
    const rows = rowsFrom1056(review, { organizationId: "o", clientId: "c", documentId: "d", now: "2026-06-21T00:00:00Z" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].service_code, "DSI");
    assert.equal(rows[0].authorization_number, "900111");
    assert.equal(rows[0].authorization_approved_on, "2026-06-20");
    assert.equal(rows[0].rate_source_document_id, "d");
    assert.equal(rows[0].client_id, "c");
  });
});
