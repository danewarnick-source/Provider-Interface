import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  addDays,
  daysBetween,
  dischargeProblems,
  endedLines,
  noticeWarning,
  parseEndedItems,
  parseSummaryDraft,
  summaryClock,
  summaryFactsText,
  type DischargeInput,
} from "./discharge.ts";

const base: DischargeInput = {
  dischargeDate: "2026-11-30",
  reason: "Moving out of state",
  initiatedBy: "person",
  noticeDate: "",
  summaryText: "",
  summaryConfirmed: false,
};

describe("dates", () => {
  it("counts days across a month end", () => {
    assert.equal(daysBetween("2026-10-31", "2026-11-30"), 30);
    assert.equal(daysBetween("", "2026-11-30"), null);
  });
  it("adds days as local dates", () => {
    assert.equal(addDays("2026-12-28", 7), "2027-01-04");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
});

describe("dischargeProblems", () => {
  it("passes a complete discharge", () => {
    assert.deepEqual(dischargeProblems(base), []);
  });
  it("needs a date, a reason and who started it", () => {
    const p = dischargeProblems({ ...base, dischargeDate: "", reason: " ", initiatedBy: "" });
    assert.equal(p.length, 3);
  });
  it("refuses a notice date after the discharge date", () => {
    assert.match(dischargeProblems({ ...base, noticeDate: "2026-12-01" }).join(), /can't be after/);
  });
  it("refuses to confirm an empty summary", () => {
    assert.match(dischargeProblems({ ...base, summaryConfirmed: true }).join(), /no summary/);
  });
});

describe("noticeWarning", () => {
  const agency = { initiatedBy: "agency", dischargeDate: "2026-11-30" };
  it("warns when the agency gave under 30 days", () => {
    assert.match(noticeWarning({ ...agency, noticeDate: "2026-11-10" }) ?? "", /20 days/);
  });
  it("is quiet at exactly 30 days", () => {
    assert.equal(noticeWarning({ ...agency, noticeDate: "2026-10-31" }), null);
  });
  it("asks for a notice date when the agency started it", () => {
    assert.match(noticeWarning({ ...agency, noticeDate: "" }) ?? "", /Add the date/);
  });
  it("doesn't apply when the person or DSPD started it", () => {
    assert.equal(noticeWarning({ ...agency, initiatedBy: "dspd", noticeDate: "2026-11-29" }), null);
  });
});

describe("summaryClock", () => {
  const d = { discharge_date: "2026-11-30", summary_sent_on: null };
  it("is due 7 days after the discharge date", () => {
    assert.deepEqual(summaryClock(d, "2026-12-02"), {
      dueOn: "2026-12-07",
      daysLeft: 5,
      state: "due",
    });
  });
  it("is late after the due date", () => {
    assert.equal(summaryClock(d, "2026-12-09").state, "late");
  });
  it("stops once sent", () => {
    assert.equal(summaryClock({ ...d, summary_sent_on: "2026-12-03" }, "2026-12-20").state, "sent");
  });
});

describe("ended items", () => {
  it("defaults missing lists", () => {
    assert.deepEqual(parseEndedItems(null), { authorizations: [], team: [], shifts: [] });
  });
  it("describes what was ended", () => {
    const items = parseEndedItems({
      authorizations: [
        { id: "a", service_code: "SLN", previous_end_date: null },
        { id: "b", service_code: "DSI", previous_end_date: null },
      ],
      team: [{ staff_id: "s", service_codes: ["SLN"] }],
      shifts: [],
    });
    assert.deepEqual(endedLines(items), [
      "2 authorizations ended (DSI, SLN)",
      "1 team member taken off the client",
      "No future shifts",
    ]);
  });
});

describe("Nectar summary", () => {
  it("lists only the facts on file", () => {
    const text = summaryFactsText({
      firstName: "Alex",
      admissionDate: null,
      dischargeDate: "2026-11-30",
      reason: "Moving",
      initiatedBy: "person",
      services: [{ code: "SLN", start: "2025-07-01", end: null }],
      goals: [],
      notesInLast90Days: 4,
    });
    assert.match(text, /Admitted: not on file/);
    assert.match(text, /SLN \(2025-07-01 to open\)/);
    assert.match(text, /Plan goals: none on file/);
  });
  it("reads the draft from JSON, with or without fences", () => {
    assert.equal(parseSummaryDraft('{"summary":" Draft. "}'), "Draft.");
    assert.equal(parseSummaryDraft('```json\n{"summary":"Draft."}\n```'), "Draft.");
    assert.equal(parseSummaryDraft("not json"), "");
  });
});

describe("discharge is one transaction", () => {
  it("discharge_client takes the team off inside the function; the server fn doesn't", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20261007100000_clients_discharge_removes_team_atomically.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("as $$"));
    const snapshot = body.indexOf("into v_team");
    const removal = body.indexOf("delete from public.staff_assignments");
    assert.ok(
      snapshot > 0 && removal > snapshot,
      "team is snapshotted, then removed, in the function",
    );
    assert.ok(removal < body.indexOf("insert into public.client_discharges"));
    const fn = readFileSync(new URL("./discharge.functions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(fn, /from\("staff_assignments"\)/);
    assert.doesNotMatch(fn, /teamLeft/);
  });
});
