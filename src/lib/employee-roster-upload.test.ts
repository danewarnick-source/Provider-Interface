import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildEmployeeRosterTemplateCsv,
  classifyRosterRowAction,
  isClientOnlyRosterHeader,
  mapRawRosterRow,
  normalizeEmployeeRosterHeader,
  normalizeHireDate,
  parseEmployeeRosterCsv,
  parseEmployeeRosterPaste,
  parseEmployeeRosterRole,
  toInviteRole,
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
    assert.match(csv, /Jane Doe/);
    assert.match(csv, /jane\.doe@example\.com/);
    assert.match(csv, /555-123-4567/);
    assert.match(csv, /2026-07-01/);
    assert.match(csv, /Direct Support/);
    assert.doesNotMatch(csv, /first_name/);
    assert.doesNotMatch(csv, /role/);
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
    assert.equal(isClientOnlyRosterHeader("guardian_name"), true);
    assert.equal(isClientOnlyRosterHeader("medicaid_id"), true);
    assert.equal(isClientOnlyRosterHeader("PCSP goals"), true);
    assert.equal(isClientOnlyRosterHeader("billing_code"), true);
    assert.equal(parseEmployeeRosterRole("Supervisor"), "manager");
    assert.equal(parseEmployeeRosterRole(""), "employee");
    assert.equal(parseEmployeeRosterRole("wizard"), null);
    assert.equal(toInviteRole("admin"), "admin");
    assert.equal(toInviteRole("program_manager"), "manager");
    assert.equal(toInviteRole("committee_member"), "employee");
    assert.equal(normalizeHireDate("7/1/2026"), "2026-07-01");
  });

  it("splits a full name and flags missing basics", () => {
    const { rows, ignoredColumns } = parseEmployeeRosterCsv(
      "name,email,phone,hire_date,job_title,guardian_name,role\nJane Doe,jane@agency.org,555-0100,2026-07-01,Direct Support,Mom,employee\n",
    );
    assert.deepEqual(ignoredColumns.sort(), ["guardian_name", "role"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].first_name, "Jane");
    assert.equal(rows[0].last_name, "Doe");
    assert.equal(rows[0].job_title, "Direct Support");
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
    assert.equal(validateEmployeeRosterRows(rows).size, 0);
  });
});
