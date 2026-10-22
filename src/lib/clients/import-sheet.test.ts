import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addClientFormSchema, authorizationRows, formProblems } from "./create.ts";
import {
  CLIENT_IMPORT_HEADERS,
  clientImportForm,
  emptyClientImportDraft,
  ownGuardianValue,
  parseClientImportGrid,
  validateClientImportRows,
  type ClientImportDraft,
} from "./import-sheet.ts";
import { buildClientTemplateCsv, buildClientTemplateXlsx } from "./import-sheet-template.ts";
import { gridFromText, gridFromWorkbook } from "../spreadsheet-import/files.ts";
import { normalizeImportDate, splitCodeList } from "../spreadsheet-import/cells.ts";

const MAPLE = "55555555-5555-4555-8555-555555555555";
const AGENCY = { homes: [{ id: MAPLE, name: "Maple House" }] };
const TODAY = "2026-10-07";

function draft(p: Partial<ClientImportDraft> = {}): ClientImportDraft {
  return {
    ...emptyClientImportDraft(),
    first_name: "Pat",
    last_name: "Example",
    medicaid_id: "0000000001",
    address: "100 Sample St",
    ...p,
  };
}

const issueFields = (
  rows: ClientImportDraft[],
  existing = [] as { medicaidId: string; name: string }[],
) => {
  const issues = validateClientImportRows(rows, AGENCY, existing, TODAY);
  return rows.map((r) => (issues.get(r.id) ?? []).map((i) => i.field));
};

describe("client template round trip", () => {
  it("CSV: note line, header, example row → a valid Add client form", () => {
    const csv = buildClientTemplateCsv(AGENCY);
    const lines = csv.split(/\r?\n/);
    assert.match(lines[0], /How to fill this in/);
    assert.equal(lines[1], CLIENT_IMPORT_HEADERS.join(","));
    const { rows, headerFound, ignoredColumns } = parseClientImportGrid(gridFromText(csv));
    assert.equal(headerFound, true);
    assert.deepEqual(ignoredColumns, []);
    assert.equal(rows.length, 1);
    assert.equal(validateClientImportRows(rows, AGENCY, [], TODAY).size, 0);
    const form = clientImportForm(rows[0], AGENCY);
    assert.equal(addClientFormSchema.safeParse(form).success, true);
    assert.deepEqual(formProblems(form), []);
    assert.equal(form.home_id, MAPLE);
    assert.equal(form.start_date, "2026-09-01");
    assert.equal(form.date_of_birth, "1995-04-12");
    assert.equal(form.is_own_guardian, false);
    assert.equal(form.guardian.relationship, "Parent");
    assert.equal(form.support_coordinator.company, "Sample Support Coordination");
    assert.deepEqual(
      authorizationRows(form, "org", "cli").map((a) => [a.service_code, a.authorization_pending]),
      [
        ["SLH", true],
        ["DSI", true],
      ],
    );
  });

  it("Excel: the Clients sheet reads back the same way", async () => {
    const bytes = await buildClientTemplateXlsx(AGENCY);
    const { rows } = parseClientImportGrid(gridFromWorkbook(bytes.buffer as ArrayBuffer));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].first_name, "Pat");
    assert.equal(rows[0].codes, "SLH; DSI");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    assert.match(sheet, /dataValidation type="list"/);
    const names = Object.keys(zip.files).join(" ");
    assert.match(names, /sheet3\.xml/);
  });
});

describe("parsing", () => {
  it("skips a title line and finds the header below it", () => {
    const { rows, headerFound } = parseClientImportGrid([
      ["Client export — made up"],
      [],
      ["First Name", "Last Name", "Medicaid ID", "Address", "Service codes"],
      ["Ana", "Sample", "123", "1 Main St", "dsi;hhs"],
      ["", "", "", "", ""],
    ]);
    assert.equal(headerFound, true);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].first_name, "Ana");
    assert.equal(rows[0].codes, "DSI; HHS");
  });

  it("needs a header row (never turns a title into a client)", () => {
    const parsed = parseClientImportGrid([["My clients"], ["Ana", "Sample", "123"]]);
    assert.equal(parsed.headerFound, false);
    assert.equal(parsed.rows.length, 0);
  });

  it("pads a Medicaid ID Excel stored as a number", () => {
    const { rows } = parseClientImportGrid([
      ["First name", "Last name", "Medicaid ID"],
      ["Ana", "Sample", 1234],
    ]);
    assert.equal(rows[0].medicaid_id, "0000001234");
  });

  it("reports columns it doesn't use", () => {
    const { ignoredColumns } = parseClientImportGrid([
      ["First name", "Last name", "Medicaid ID", "Favorite color"],
    ]);
    assert.deepEqual(ignoredColumns, ["Favorite color"]);
  });
});

describe("Y/N, dates and codes", () => {
  it("own guardian: Y/N, blank means yes unless a guardian is named", () => {
    assert.equal(ownGuardianValue({ own_guardian: "Y", guardian_name: "" }), true);
    assert.equal(ownGuardianValue({ own_guardian: "no", guardian_name: "" }), false);
    assert.equal(ownGuardianValue({ own_guardian: "", guardian_name: "" }), true);
    assert.equal(ownGuardianValue({ own_guardian: "", guardian_name: "Gale" }), false);
    assert.equal(ownGuardianValue({ own_guardian: "maybe", guardian_name: "" }), null);
    assert.deepEqual(issueFields([draft({ own_guardian: "maybe" })]), [["own_guardian"]]);
    assert.deepEqual(issueFields([draft({ own_guardian: "N" })]), [
      ["guardian_name", "guardian_phone"],
    ]);
  });

  it("reads common date formats", () => {
    for (const t of [
      "2026-09-01",
      "2026/9/1",
      "9/1/2026",
      "9/1/26",
      "9-1-2026",
      "Sep 1, 2026",
      "September 1 2026",
      "1 Sep 2026",
      46266,
    ]) {
      assert.equal(normalizeImportDate(t), "2026-09-01", String(t));
    }
    assert.equal(normalizeImportDate("13/45/2026"), "13/45/2026");
    assert.deepEqual(issueFields([draft({ start_date: "soon" })]), [["start_date"]]);
    assert.deepEqual(issueFields([draft({ date_of_birth: "2030-01-01" })]), [["date_of_birth"]]);
  });

  it('splits codes on ";" and flags unknown ones', () => {
    assert.deepEqual(splitCodeList(" dsi ;HHS;; DSI "), ["DSI", "HHS"]);
    assert.deepEqual(issueFields([draft({ codes: "SLH; XYZ" })]), [["codes"]]);
    assert.deepEqual(issueFields([draft({ codes: "SLH, DSI" })]), [["codes"]]);
  });

  it("flags an unknown home and missing required cells", () => {
    assert.deepEqual(issueFields([draft({ home: "Oak House" })]), [["home"]]);
    assert.deepEqual(issueFields([draft({ first_name: "", medicaid_id: " ", address: "" })]), [
      ["first_name", "medicaid_id", "address"],
    ]);
  });
});

describe("duplicate Medicaid IDs", () => {
  it("flags the same ID twice in the file", () => {
    assert.deepEqual(
      issueFields([
        draft({ medicaid_id: "12-345" }),
        draft({ medicaid_id: "12345" }),
        draft({ medicaid_id: "999" }),
      ]),
      [["medicaid_id"], ["medicaid_id"], []],
    );
  });

  it("flags an ID an existing client already has, naming them", () => {
    const rows = [draft({ medicaid_id: "0000000001" })];
    const issues = validateClientImportRows(
      rows,
      AGENCY,
      [{ medicaidId: "0000-000-001", name: "Sam Sample" }],
      TODAY,
    );
    assert.match(issues.get(rows[0].id)?.[0].message ?? "", /Already used by Sam Sample/);
  });
});
