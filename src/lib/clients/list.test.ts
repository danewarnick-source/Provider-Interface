import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListFilters,
  clientListCsv,
  endedCodesFor,
  listReadiness,
  nextDueItem,
  planHasExpired,
  searchTerms,
  sortRows,
  type ClientListRow,
} from "./list.ts";

const NOW = new Date(2026, 9, 6, 12); // Oct 6 2026, local

function row(p: Partial<ClientListRow> = {}): ClientListRow {
  return {
    id: "c1",
    first_name: "Pat",
    last_name: "Example",
    preferred_name: null,
    photo_url: null,
    medicaid_id: "0000000001",
    client_pid: null,
    account_status: "active",
    codes: ["DSI"],
    endedCodes: null,
    planExpired: false,
    home: { id: "h1", name: "Maple" },
    unitsLeft: null,
    needsUnits: false,
    nextDue: null,
    staff: [{ id: "s1", name: "Sam Staff" }],
    readiness: { ready: true, missing: [] },
    ...p,
  };
}

describe("searchTerms", () => {
  it("splits words, lowercases and strips filter syntax", () => {
    assert.deepEqual(searchTerms("  Pat  EXAMPLE "), ["pat", "example"]);
    assert.deepEqual(searchTerms("a,b(c)%_*"), ["a", "b", "c"]);
    assert.deepEqual(searchTerms(""), []);
  });
});

describe("nextDueItem", () => {
  it("returns the earliest date with days from today", () => {
    const d = nextDueItem(
      [
        { kind: "plan", label: "Plan renews", date: "2026-12-01" },
        { kind: "summary", label: "Summary due", date: "2026-10-15" },
        { kind: "summary", label: "Nothing", date: null },
      ],
      NOW,
    );
    assert.deepEqual(d, { kind: "summary", label: "Summary due", date: "2026-10-15", days: 9 });
  });
  it("keeps overdue items (negative days)", () => {
    assert.equal(
      nextDueItem([{ kind: "summary", label: "Summary due", date: "2026-10-01" }], NOW)?.days,
      -5,
    );
    assert.equal(nextDueItem([], NOW), null);
  });
});

describe("listReadiness", () => {
  it("lists what's missing in plain words", () => {
    assert.deepEqual(
      listReadiness({ codes: ["DSI"], staffCount: 1, hasPin: true, guardianGap: null }),
      { ready: true, missing: [] },
    );
    const r = listReadiness({
      codes: [],
      staffCount: 0,
      hasPin: false,
      guardianGap: "Guardian not on file",
    });
    assert.equal(r.ready, false);
    assert.equal(r.missing.length, 3);
    assert.equal(r.missing[0], "No authorized service code");
    assert.equal(r.missing[2], "Guardian not on file");
    assert.deepEqual(
      listReadiness({
        codes: ["DSI"],
        staffCount: 1,
        hasPin: true,
        guardianGap: "Guardian has no phone",
      }).missing,
      ["Guardian has no phone"],
    );
  });
  it("needs a home pin only for a client with an EVV code", () => {
    const base = { staffCount: 1, hasPin: false, guardianGap: null };
    assert.deepEqual(listReadiness({ ...base, codes: ["SLH"] }), {
      ready: false,
      missing: ["No home pin (address not found)"],
    });
    assert.deepEqual(listReadiness({ ...base, codes: ["DSI", "HHS"] }), {
      ready: true,
      missing: [],
    });
  });
  it("says authorizations ended (with the date) when codes ended rather than never existed", () => {
    const r = listReadiness({
      codes: [],
      staffCount: 1,
      hasPin: true,
      guardianGap: null,
      endedOn: "2026-08-31",
    });
    assert.deepEqual(r.missing, ["Authorizations ended Aug 31, 2026"]);
  });
});

describe("endedCodesFor and planHasExpired", () => {
  const ended = [
    { service_code: "dsi", service_end_date: "2026-08-31" },
    { service_code: "SEI", service_end_date: "2026-07-31" },
    { service_code: "DSI", service_end_date: "2026-06-30" },
  ];
  it("lists ended codes with the latest end date only when no code is active", () => {
    assert.deepEqual(endedCodesFor([], ended), { codes: ["DSI", "SEI"], endedOn: "2026-08-31" });
    assert.equal(endedCodesFor(["HHS"], ended), null);
    assert.equal(endedCodesFor([], []), null);
  });
  it("treats no current plan or a past end date as expired", () => {
    assert.equal(planHasExpired([], "2026-10-06"), true);
    assert.equal(planHasExpired([{ end_date: "2026-08-31" }], "2026-10-06"), true);
    assert.equal(planHasExpired([{ end_date: "2026-10-06" }], "2026-10-06"), false);
    assert.equal(planHasExpired([{ end_date: null }], "2026-10-06"), false);
  });
});

describe("applyListFilters", () => {
  const rows = [
    row({ id: "a", codes: ["DSI", "HHS"] }),
    row({ id: "b", codes: ["SEI"], home: null, staff: [] }),
  ];
  const none = { code: null, homeId: null, staffId: null };
  it("filters by code, home and staff", () => {
    assert.deepEqual(
      applyListFilters(rows, none).map((r) => r.id),
      ["a", "b"],
    );
    assert.deepEqual(
      applyListFilters(rows, { ...none, code: "hhs" }).map((r) => r.id),
      ["a"],
    );
    assert.deepEqual(
      applyListFilters(rows, { ...none, homeId: "h1" }).map((r) => r.id),
      ["a"],
    );
    assert.deepEqual(
      applyListFilters(rows, { ...none, staffId: "s1" }).map((r) => r.id),
      ["a"],
    );
  });
});

describe("sorting", () => {
  it("sorts by last name", () => {
    const sorted = sortRows([
      row({ id: "z", last_name: "Zed" }),
      row({ id: "a", last_name: "Able" }),
    ]);
    assert.deepEqual(
      sorted.map((r) => r.id),
      ["a", "z"],
    );
  });
});

describe("clientListCsv", () => {
  it("writes a header and one quoted-safe line per row", () => {
    const csv = clientListCsv([
      row({ first_name: "=Pat", unitsLeft: { code: "DSI", left: 5, annual: 100, pct: 5 } }),
    ]);
    const [head, line] = csv.split("\n");
    assert.match(head, /^Name,Medicaid ID,DSPD PID,Codes,Home/);
    assert.ok(line.startsWith("'=Pat Example,"));
    assert.match(line, /DSI 5 of 100/);
    assert.match(line, /,Yes$/);
  });
});
