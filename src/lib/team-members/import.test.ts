import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { normalizeImportDate, parseYesNo } from "../spreadsheet-import/cells.ts";
import {
  importPayloadRow,
  parseTeamImportGrid,
  parseTeamImportText,
  validateTeamImportRows,
} from "./import.ts";
import {
  TEAM_IMPORT_HEADERS,
  columnForHeader,
  isHeaderRow,
  resolvePresetCell,
  templatePresetNames,
  type ImportAgency,
} from "./import-columns.ts";
import { buildTeamImportTemplateCsv, buildTeamImportTemplateXlsx } from "./import-template.ts";

const DSP = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const PM = "33333333-3333-4333-8333-333333333333";
const CUSTOM = "44444444-4444-4444-8444-444444444444";
const MAPLE = "55555555-5555-4555-8555-555555555555";
const HARVEY = "66666666-6666-4666-8666-666666666666";

const AGENCY: ImportAgency = {
  presets: [
    { id: DSP, name: "DSP", access_level: "staff", seed_key: "dsp" },
    { id: LEAD, name: "Lead DSP", access_level: "staff", seed_key: "lead_dsp" },
    { id: CUSTOM, name: "Night Shift Float", access_level: "staff", seed_key: null },
    { id: PM, name: "Program Manager", access_level: "admin", seed_key: "program_manager" },
  ],
  homes: [{ id: MAPLE, name: "Maple House" }],
  positions: [
    { key: "dsp", label: "Direct Support Professional" },
    { key: "hhp", label: "Host Home Provider" },
  ],
  supervisors: [{ memberId: HARVEY, name: "Harvey Lead" }],
  viewerIsOwner: false,
};
const OWNER_AGENCY: ImportAgency = { ...AGENCY, viewerIsOwner: true };
const TODAY = "2026-09-28";

describe("import dates", () => {
  it("reads YYYY-MM-DD, M/D/YYYY, M/D/YY (20YY) and Excel serials", () => {
    assert.equal(normalizeImportDate("2026-07-01"), "2026-07-01");
    assert.equal(normalizeImportDate("2026-7-1"), "2026-07-01");
    assert.equal(normalizeImportDate("7/1/2026"), "2026-07-01");
    assert.equal(normalizeImportDate("12/31/2026"), "2026-12-31");
    assert.equal(normalizeImportDate("7/1/26"), "2026-07-01");
    assert.equal(normalizeImportDate(46204), "2026-07-01");
    assert.equal(normalizeImportDate("46204"), "2026-07-01");
    assert.equal(normalizeImportDate(" "), "");
  });

  it("leaves impossible or unknown dates as typed so review flags them", () => {
    assert.equal(normalizeImportDate("2/30/2026"), "2/30/2026");
    assert.equal(normalizeImportDate("next Tuesday"), "next Tuesday");
    assert.equal(normalizeImportDate("12"), "12");
  });
});

describe("template columns match the Add team member form", () => {
  it("has the form's fields in its order and wording", () => {
    assert.deepEqual(TEAM_IMPORT_HEADERS, [
      "First name",
      "Last name",
      "Email",
      "Phone",
      "Hire date",
      "Position",
      "Access",
      "Home",
      "Supervisor",
      "Date of birth",
      "Worker type",
      "Transports clients",
    ]);
    for (const h of TEAM_IMPORT_HEADERS) assert.ok(columnForHeader(h), h);
  });

  it("reads a template file back, skipping a title line above the header", () => {
    const { rows } = parseTeamImportGrid(
      [
        ["Team roster export"],
        [...TEAM_IMPORT_HEADERS],
        [
          "Jane",
          "Doe",
          "jane@x.test",
          "",
          "Sep 1, 2026",
          "",
          "DSP",
          "",
          "harvey lead",
          "",
          "Volunteer",
          "Y",
        ],
      ],
      AGENCY,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hire_date, "2026-09-01");
    assert.equal(rows[0].supervisorId, HARVEY);
    assert.equal(rows[0].workerType, "volunteer");
    assert.equal(rows[0].transports, true);
    assert.equal(validateTeamImportRows(rows, AGENCY, TODAY).size, 0);
  });

  it("flags a supervisor who isn't on the team", () => {
    const { rows } = parseTeamImportText(
      "name,email,hire date,supervisor\nJane Doe,jane@x.test,7/1/2026,Nobody Here",
      AGENCY,
    );
    const issues = validateTeamImportRows(rows, AGENCY, TODAY).get(rows[0].id) ?? [];
    assert.deepEqual(
      issues.map((i) => i.field),
      ["supervisor"],
    );
  });
});

describe("header detector", () => {
  it("matches whole cells, never a substring", () => {
    assert.equal(isHeaderRow(["Name", "Email", "Phone"]), true);
    assert.equal(isHeaderRow(["first name", "last name"]), true);
    assert.equal(isHeaderRow(["E-mail"]), true);
    assert.equal(isHeaderRow(["Jane Doe", "jane.email@x.test", "555-0100"]), false);
    assert.equal(isHeaderRow(["Emailia Smith", "e@x.test"]), false);
    assert.equal(columnForHeader("Date of birth"), "date_of_birth");
    assert.equal(columnForHeader("DOB"), "date_of_birth");
    assert.equal(columnForHeader("Transports"), "transports");
    assert.equal(columnForHeader("Preset"), "preset");
    assert.equal(columnForHeader("Team"), "home");
    assert.equal(columnForHeader("Guardian"), null);
  });

  it("paste and file share the grid parser", () => {
    const text = "Name,Email,Hire date\nJane Doe,jane@x.test,7/1/2026\n";
    const pasted = parseTeamImportText(text, AGENCY);
    const grid = parseTeamImportGrid(
      [
        ["Name", "Email", "Hire date"],
        ["Jane Doe", "jane@x.test", 46204],
      ],
      AGENCY,
    );
    for (const parsed of [pasted, grid]) {
      assert.equal(parsed.rows.length, 1);
      assert.equal(parsed.rows[0].first_name, "Jane");
      assert.equal(parsed.rows[0].last_name, "Doe");
      assert.equal(parsed.rows[0].hire_date, "2026-07-01");
    }
  });

  it("uses the paste column order without a header", () => {
    const { rows } = parseTeamImportText(
      "Sam Rivera\tsam@x.test\t555-0100\t2026-07-01\tHost Home Provider\tLead DSP\tMaple House\tHarvey Lead\t1/2/1990\t1099\tyes",
      AGENCY,
    );
    const [r] = rows;
    assert.equal(r.email, "sam@x.test");
    assert.equal(r.access, LEAD);
    assert.equal(r.homeId, MAPLE);
    assert.equal(r.supervisorId, HARVEY);
    assert.equal(r.workerType, "1099");
    assert.deepEqual(r.positions, ["hhp"]);
    assert.equal(r.date_of_birth, "1990-01-02");
    assert.equal(r.transports, true);
  });

  it("reports ignored columns", () => {
    const { ignoredColumns } = parseTeamImportText(
      "name,email,guardian\nA B,a@x.test,Mom\n",
      AGENCY,
    );
    assert.deepEqual(ignoredColumns, ["guardian"]);
  });
});

describe("presets from the agency", () => {
  it("keeps custom presets and defaults blank to DSP", () => {
    assert.equal(resolvePresetCell("Night Shift Float", AGENCY), CUSTOM);
    assert.equal(resolvePresetCell("night shift float", AGENCY), CUSTOM);
    assert.equal(resolvePresetCell("", AGENCY), DSP);
  });

  it("Admin presets only for an Owner; Owner never from a sheet", () => {
    assert.equal(resolvePresetCell("Program Manager", AGENCY), "");
    assert.equal(resolvePresetCell("Program Manager", OWNER_AGENCY), PM);
    assert.equal(resolvePresetCell("Owner", OWNER_AGENCY), "");
    assert.deepEqual(templatePresetNames(AGENCY), ["DSP", "Lead DSP", "Night Shift Float"]);
    assert.deepEqual(templatePresetNames(OWNER_AGENCY), [
      "DSP",
      "Lead DSP",
      "Night Shift Float",
      "Program Manager",
    ]);
  });
});

describe("review", () => {
  const parse = (lines: string[], agency = AGENCY) =>
    parseTeamImportText(
      ["name,email,hire_date,preset,home,position,date_of_birth,transports", ...lines].join("\n"),
      agency,
    ).rows;

  it("passes a complete row", () => {
    const rows = parse(["Jane Doe,jane@x.test,2026-07-01,DSP,Maple House,,,no"]);
    assert.equal(validateTeamImportRows(rows, AGENCY, TODAY).size, 0);
  });

  it("flags each bad field", () => {
    const rows = parse([
      "Pat,not-an-email,,Program Manager,Oak House,Janitor,5/3/85,maybe",
      "A One,dup@x.test,2026-07-01,Owner,,,,",
      "B Two,DUP@x.test,2026-07-01,,,,,",
    ]);
    const issues = validateTeamImportRows(rows, AGENCY, TODAY);
    const fields = (i: number) => (issues.get(rows[i].id) ?? []).map((x) => x.field).sort();
    assert.deepEqual(fields(0), [
      "date_of_birth",
      "email",
      "hire_date",
      "home",
      "name",
      "position",
      "preset",
      "transports",
    ]);
    assert.ok(fields(1).includes("preset"));
    assert.match((issues.get(rows[1].id) ?? []).map((x) => x.message).join(" "), /Owner/);
    assert.ok(fields(1).includes("email"));
    assert.ok(fields(2).includes("email"));
  });

  it("builds the importTeamMembers row with resolved ids", () => {
    const [row] = parse([
      "Jane Doe,Jane@X.test,7/1/2026,Lead DSP,maple house,Host Home Provider,,yes",
    ]);
    assert.deepEqual(importPayloadRow(row), {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@x.test",
      phone: "",
      hireDate: "2026-07-01",
      dateOfBirth: "",
      access: LEAD,
      positions: ["hhp"],
      homeId: MAPLE,
      supervisorId: null,
      workerType: "w2",
      transportsClients: true,
    });
  });

  it("yes/no", () => {
    assert.equal(parseYesNo("Yes"), true);
    assert.equal(parseYesNo("n"), false);
    assert.equal(parseYesNo(""), false);
    assert.equal(parseYesNo("sometimes"), null);
  });
});

describe("templates from the agency", () => {
  it("CSV uses the agency's presets and homes and no client fields", () => {
    const csv = buildTeamImportTemplateCsv(AGENCY);
    assert.equal(csv.split(/\r?\n/)[0], TEAM_IMPORT_HEADERS.join(","));
    assert.match(csv, /DSP/);
    assert.match(csv, /Maple House/);
    assert.doesNotMatch(csv, /guardian|pcsp|medicaid|billing|Owner|access_level/i);
  });

  it("Excel has list dropdowns pointing at a Lists sheet of agency names", async () => {
    const bytes = await buildTeamImportTemplateXlsx(OWNER_AGENCY);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    assert.match(sheet, /dataValidation type="list"/);
    assert.match(sheet, /Lists!\$A\$2:\$A\$5/);
    assert.match(sheet, /Lists!\$B\$2:\$B\$2/);
    const shared = await zip.file("xl/sharedStrings.xml")?.async("string");
    const all = `${shared ?? ""}${sheet}${await zip.file("xl/worksheets/sheet2.xml")!.async("string")}`;
    for (const name of [
      "Night Shift Float",
      "Program Manager",
      "Maple House",
      "Host Home Provider",
    ]) {
      assert.ok(all.includes(name), name);
    }
    assert.doesNotMatch(all, />Owner</);
  });
});

describe("Import team members dialog source lock", () => {
  it("reviews editable, removable rows, previews emails, invites everyone, then Evidence", () => {
    const src = ["import-members-dialog.tsx", "import-member-row.tsx"]
      .map((f) =>
        readFileSync(new URL(`../../components/team-members/add/${f}`, import.meta.url), "utf8"),
      )
      .join("\n");
    for (const text of [
      "Import team members",
      "Remove row",
      "Email invites to everyone",
      "Invites sent to",
      "Review evidence packs for",
      "SpreadsheetDrop",
      "previewTeamImport",
      "importTeamMembers",
      "includeOwner={false}",
    ]) {
      assert.ok(src.includes(text), text);
    }
    for (const gone of [
      /Needs setup/,
      /applyEmployeeRosterRow/,
      /Finish setup/,
      /add_and_update|update_only/,
      /guardian|pcsp/i,
      /lib\/temp-password/,
    ]) {
      assert.doesNotMatch(src, gone, String(gone));
    }
  });
});
