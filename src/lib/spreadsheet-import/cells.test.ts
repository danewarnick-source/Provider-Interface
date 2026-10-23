import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEADER_SCAN_ROWS,
  normalizeImportDate,
  parseYesNo,
  readGrid,
  slugCell,
  splitCodeList,
} from "./cells.ts";

const cols = {
  columnFor: (raw: unknown) => (["name", "email"].includes(slugCell(raw)) ? slugCell(raw) : null),
  isHeader: (cells: readonly unknown[]) => cells.some((c) => slugCell(c) === "email"),
};

describe("readGrid", () => {
  it("finds the header under title lines and joins repeated columns", () => {
    const out = readGrid(
      [["Roster"], ["Name", "Name", "Email", "Notes"], ["Jane", "Doe", "j@x.test", "hi"]],
      { ...cols, pasteOrder: null },
    );
    assert.equal(out.headerFound, true);
    assert.deepEqual(out.records, [{ name: "Jane Doe", email: "j@x.test" }]);
    assert.deepEqual(out.ignoredColumns, ["Notes"]);
  });

  it("uses the paste order without a header, or returns nothing when one is required", () => {
    const grid = [["Jane", "j@x.test"]];
    assert.deepEqual(readGrid(grid, { ...cols, pasteOrder: ["name", "email"] }).records, [
      { name: "Jane", email: "j@x.test" },
    ]);
    assert.deepEqual(readGrid(grid, { ...cols, pasteOrder: null }).records, []);
  });

  it(`only looks for the header in the first ${HEADER_SCAN_ROWS} rows`, () => {
    const grid = [...Array.from({ length: HEADER_SCAN_ROWS }, (_, i) => [`line ${i}`]), ["Email"]];
    assert.equal(readGrid(grid, { ...cols, pasteOrder: null }).headerFound, false);
  });
});

describe("cells", () => {
  it("dates, yes/no and code lists", () => {
    assert.equal(normalizeImportDate("Dec 31, 2026"), "2026-12-31");
    assert.equal(normalizeImportDate("2/30/2026"), "2/30/2026");
    assert.equal(parseYesNo("Y"), true);
    assert.equal(parseYesNo(""), false);
    assert.equal(parseYesNo("perhaps"), null);
    assert.deepEqual(splitCodeList("sln; SLN ; ;rp2"), ["SLN", "RP2"]);
  });
});
