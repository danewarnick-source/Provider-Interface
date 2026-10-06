import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListFilters,
  clientListCsv,
  draftMatches,
  listReadiness,
  nextDueItem,
  rowNeedsAttention,
  searchTerms,
  sortRows,
  type ClientListRow,
} from "./list.ts";

const NOW = new Date(2026, 9, 6, 12); // Oct 6 2026, local

function row(p: Partial<ClientListRow> = {}): ClientListRow {
  return {
    id: "c1",
    kind: "client",
    first_name: "Pat",
    last_name: "Example",
    photo_url: null,
    medicaid_id: "0000000001",
    client_pid: null,
    account_status: "active",
    codes: ["DSI"],
    home: { id: "h1", name: "Maple" },
    unitsLeft: null,
    nextDue: null,
    staff: [{ id: "s1", name: "Sam Staff" }],
    readiness: { ready: true, missing: [] },
    needsAttention: false,
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
        { label: "Plan renews", date: "2026-12-01" },
        { label: "Summary due", date: "2026-10-15" },
        { label: "Nothing", date: null },
      ],
      NOW,
    );
    assert.deepEqual(d, { label: "Summary due", date: "2026-10-15", days: 9 });
  });
  it("keeps overdue items (negative days)", () => {
    assert.equal(nextDueItem([{ label: "Summary due", date: "2026-10-01" }], NOW)?.days, -5);
    assert.equal(nextDueItem([], NOW), null);
  });
});

describe("listReadiness", () => {
  it("lists what's missing in plain words", () => {
    assert.deepEqual(
      listReadiness({ codes: ["DSI"], staffCount: 1, hasPin: true, guardianOk: true }),
      { ready: true, missing: [] },
    );
    const r = listReadiness({ codes: [], staffCount: 0, hasPin: false, guardianOk: false });
    assert.equal(r.ready, false);
    assert.equal(r.missing.length, 4);
  });
});

describe("rowNeedsAttention", () => {
  it("flags drafts, not-ready rows, low units and things due soon", () => {
    assert.equal(rowNeedsAttention(row()), false);
    assert.equal(rowNeedsAttention(row({ kind: "draft" })), true);
    assert.equal(rowNeedsAttention(row({ readiness: { ready: false, missing: ["x"] } })), true);
    assert.equal(
      rowNeedsAttention(row({ unitsLeft: { code: "DSI", left: 5, annual: 100, pct: 5 } })),
      true,
    );
    assert.equal(
      rowNeedsAttention(row({ unitsLeft: { code: "DSI", left: 50, annual: 100, pct: 50 } })),
      false,
    );
    assert.equal(
      rowNeedsAttention(row({ nextDue: { label: "Summary due", date: "2026-10-10", days: 4 } })),
      true,
    );
    assert.equal(
      rowNeedsAttention(row({ nextDue: { label: "Plan renews", date: "2027-01-10", days: 96 } })),
      false,
    );
  });
});

describe("applyListFilters", () => {
  const rows = [
    row({ id: "a", codes: ["DSI", "HHS"] }),
    row({ id: "b", codes: ["SEI"], home: null, staff: [], needsAttention: true }),
    row({ id: "d", kind: "draft", codes: [], home: null, staff: [] }),
  ];
  const none = { code: null, homeId: null, staffId: null, needsAttention: false };
  it("filters by code, home, staff and needs attention", () => {
    assert.deepEqual(
      applyListFilters(rows, none).map((r) => r.id),
      ["a", "b", "d"],
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
    assert.deepEqual(
      applyListFilters(rows, { ...none, needsAttention: true }).map((r) => r.id),
      ["b", "d"],
    );
  });
});

describe("drafts and sorting", () => {
  it("matches drafts by every term and sorts drafts first, then by last name", () => {
    assert.equal(draftMatches("Pat Example", ["pat", "exa"]), true);
    assert.equal(draftMatches("Pat Example", ["zed"]), false);
    const sorted = sortRows([
      row({ id: "z", last_name: "Zed" }),
      row({ id: "a", last_name: "Able" }),
      row({ id: "d", kind: "draft", last_name: "Zz" }),
    ]);
    assert.deepEqual(
      sorted.map((r) => r.id),
      ["d", "a", "z"],
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
