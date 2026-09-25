import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildEmployeeRosterTemplateCsv,
  buildEmployeeRosterTemplateXlsx,
  classifyRosterRowAction,
  isClientOnlyRosterHeader,
  mapRawRosterRow,
  normalizeEmployeeRosterHeader,
  normalizeHireDate,
  bulkAccessExcelList,
  parseBulkAccessLevel,
  parseEmployeeRosterCsv,
  parseEmployeeRosterPaste,
  validateEmployeeRosterRows,
} from "./employee-roster-upload.ts";

describe("employee roster template", () => {
  it("uses basics only, with one filled sample row, and never client-record fields", () => {
    const csv = buildEmployeeRosterTemplateCsv();
    assert.match(csv, /name/);
    assert.match(csv, /email/);
    assert.match(csv, /phone/);
    assert.match(csv, /hire_date/);
    assert.match(csv, /job_title/);
    assert.match(csv, /access_level/);
    assert.match(csv, /Jane Doe/);
    assert.match(csv, /jane\.doe@example\.com/);
    assert.match(csv, /555-123-4567/);
    assert.match(csv, /2026-07-01/);
    assert.match(csv, /Direct Support/);
    assert.match(csv, /Team member/);
    assert.doesNotMatch(csv, /first_name/);
    assert.doesNotMatch(csv, /Owner/);
    assert.doesNotMatch(csv, /username/);
    assert.doesNotMatch(csv, /guardian/i);
    assert.doesNotMatch(csv, /pcsp/i);
    assert.doesNotMatch(csv, /medicaid/i);
    assert.doesNotMatch(csv, /medication/i);
    assert.doesNotMatch(csv, /billing/i);
    assert.doesNotMatch(csv, /staff_type/);
  });

  it("maps human headers and ignores client-only columns", () => {
    assert.equal(normalizeEmployeeRosterHeader("Full name"), "name");
    assert.equal(normalizeEmployeeRosterHeader("Hire date"), "hire_date");
    assert.equal(normalizeEmployeeRosterHeader("Job Title"), "job_title");
    assert.equal(normalizeEmployeeRosterHeader("Access level"), "access_level");
    assert.equal(isClientOnlyRosterHeader("guardian_name"), true);
    assert.equal(isClientOnlyRosterHeader("medicaid_id"), true);
    assert.equal(isClientOnlyRosterHeader("PCSP goals"), true);
    assert.equal(isClientOnlyRosterHeader("billing_code"), true);
    const blank = parseBulkAccessLevel("");
    assert.equal(blank.invalid, false);
    assert.equal(blank.level, "staff");
    assert.equal(blank.presetName, "DSP");
    const staff = parseBulkAccessLevel("staff");
    assert.equal(staff.level, "staff");
    assert.equal(staff.presetName, "DSP");
    assert.equal(parseBulkAccessLevel("STAFF").invalid, false);
    assert.equal(parseBulkAccessLevel("employee").presetName, "DSP");
    assert.equal(parseBulkAccessLevel("Team member").level, "staff");
    const admin = parseBulkAccessLevel("Admin");
    assert.equal(admin.invalid, false);
    assert.equal(admin.level, "admin");
    assert.equal(admin.presetName, "Program Manager");
    const program = parseBulkAccessLevel("Program Manager");
    assert.equal(program.invalid, false);
    assert.equal(program.level, "admin");
    assert.equal(program.presetName, "Program Manager");
    const dsp = parseBulkAccessLevel("DSP");
    assert.equal(dsp.level, "staff");
    assert.equal(dsp.presetName, "DSP");
    assert.equal(parseBulkAccessLevel("Owner").invalid, true);
    assert.equal(parseBulkAccessLevel("Supervisor").invalid, true);
    assert.equal(parseBulkAccessLevel("Committee Member").invalid, true);
    assert.equal(parseBulkAccessLevel("wizard").invalid, true);
    assert.equal(normalizeHireDate("7/1/2026"), "2026-07-01");
  });

  it("splits a full name and flags missing basics", () => {
    const { rows, ignoredColumns } = parseEmployeeRosterCsv(
      "name,email,phone,hire_date,job_title,guardian_name,access_level\nJane Doe,jane@agency.org,555-0100,2026-07-01,Direct Support,Mom,staff\n",
    );
    assert.deepEqual(ignoredColumns.sort(), ["guardian_name"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].first_name, "Jane");
    assert.equal(rows[0].last_name, "Doe");
    assert.equal(rows[0].job_title, "Direct Support");
    assert.equal(rows[0].level, "staff");
    assert.equal(rows[0].presetName, "DSP");
    assert.equal(validateEmployeeRosterRows(rows).size, 0);

    const pasted = parseEmployeeRosterPaste(
      "Sam Rivera, sam@agency.org, 555-0101, 7/1/2026, DSP\n",
    );
    assert.equal(pasted.rows[0].first_name, "Sam");
    assert.equal(pasted.rows[0].last_name, "Rivera");
    assert.equal(pasted.rows[0].hire_date, "2026-07-01");

    const mapped = mapRawRosterRow({ name: "Pat", email: "bad", phone: "", hire_date: "" }, [
      "name",
      "email",
      "phone",
      "hire_date",
    ]);
    const fields = (validateEmployeeRosterRows([mapped]).get(mapped.id) ?? []).map((i) => i.field);
    assert.ok(fields.includes("name"));
    assert.ok(fields.includes("email"));
    assert.ok(fields.includes("phone"));
    assert.ok(fields.includes("hire_date"));
  });

  it("keeps Add several at once off update modes and off automatic invites", () => {
    const src = readFileSync(
      new URL("../components/employees/employee-roster-upload-wizard.tsx", import.meta.url),
      "utf8",
    );
    assert.match(src, /Add several at once/);
    assert.match(src, /Needs setup/);
    assert.match(src, /Already on the roster/);
    assert.match(src, /No invites/);
    assert.doesNotMatch(src, /add_new/);
    assert.doesNotMatch(src, /add_and_update/);
    assert.doesNotMatch(src, /update_only/);
    assert.doesNotMatch(src, /createInvitation/);
    assert.doesNotMatch(src, /invite yet/);
    assert.doesNotMatch(src, /inviteStaffMembers\(/);
    assert.doesNotMatch(src, /smart-import/);
    assert.doesNotMatch(src, /guardian/i);
    assert.doesNotMatch(src, /pcsp/i);
    assert.doesNotMatch(src, /Hive Platform/);
  });

  it("skips emails already on the roster and never updates", () => {
    const existing = ["jake@agency.org"];
    assert.equal(classifyRosterRowAction("new@agency.org", existing), "create");
    assert.equal(classifyRosterRowAction("Jake@agency.org", existing), "skip");
  });

  it("flags duplicate emails in the file", () => {
    const { rows } = parseEmployeeRosterCsv(
      "name,email,phone,hire_date\nA One,a@agency.org,555-1,2026-07-01\nB Two,A@agency.org,555-2,2026-07-01\n",
    );
    const issues = validateEmployeeRosterRows(rows);
    assert.equal(issues.size, 2);
    const messages = [...issues.values()].flat().map((i) => i.message);
    assert.ok(messages.some((m) => /more than once/i.test(m)));
  });

  it("accepts separate first and last name columns", () => {
    const { rows } = parseEmployeeRosterCsv(
      "first_name,last_name,email,phone,hire_date,job_title\nJane,Doe,jane@agency.org,555-0100,2026-07-01,DSP\n",
    );
    assert.equal(rows[0].first_name, "Jane");
    assert.equal(rows[0].last_name, "Doe");
    assert.equal(rows[0].level, "staff");
    assert.equal(rows[0].presetName, "DSP");
    assert.equal(validateEmployeeRosterRows(rows).size, 0);
  });

  it("flags an access level outside the bulk list and defaults a blank to Team member", () => {
    const { rows } = parseEmployeeRosterCsv(
      [
        "name,email,phone,hire_date,job_title,access_level",
        "A One,a@agency.org,555-0100,2026-07-01,DSP,",
        "B Two,b@agency.org,555-0101,2026-07-01,DSP,Owner",
        "C Three,c@agency.org,555-0102,2026-07-01,,Supervisor",
      ].join("\n"),
    );
    assert.equal(rows[0].level, "staff");
    assert.equal(rows[0].presetName, "DSP");
    assert.equal(rows[0].job_title, "DSP");
    assert.equal(validateEmployeeRosterRows([rows[0]]).size, 0);
    assert.equal(rows[2].level, "staff");
    assert.equal(rows[2].presetName, "");
    assert.equal(rows[2].job_title, "");
    const issues = validateEmployeeRosterRows(rows);
    const owner = issues.get(rows[1].id) ?? [];
    assert.equal(owner.length, 1);
    assert.equal(owner[0].field, "access_level");
    assert.match(owner[0].message, /Owner/);
    assert.match(owner[0].message, /Team member/);
    const supervisor = issues.get(rows[2].id) ?? [];
    assert.ok(supervisor.some((i) => i.field === "access_level"));
    assert.match(supervisor.map((i) => i.message).join(" "), /Supervisor/);
  });

  it("puts a list dropdown on the Excel access level column", async () => {
    const bytes = await buildEmployeeRosterTemplateXlsx();
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    const sheetPath = Object.keys(zip.files).find((name) =>
      /xl\/worksheets\/sheet\d+\.xml$/.test(name),
    );
    assert.ok(sheetPath);
    const xml = await zip.file(sheetPath)!.async("string");
    assert.match(xml, /dataValidation type="list"/);
    assert.match(xml, new RegExp(bulkAccessExcelList().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(xml, /Admin,Team member,Billing,DSP,Group Home Manager/);
    assert.match(xml, /HR \/ Office/);
    assert.match(xml, /Program Manager/);
    assert.doesNotMatch(xml, /Supervisor/);
    assert.doesNotMatch(xml, /Committee Member/);
    assert.doesNotMatch(xml, />Owner</);
    assert.match(xml, /Jane Doe/);
  });
});
