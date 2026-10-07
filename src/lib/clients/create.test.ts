import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClientFormSchema,
  authorizationRows,
  clientValues,
  contactRows,
  emptyAddClientForm,
  findMedicaidDuplicate,
  formFromDraftValues,
  formProblems,
  normalizeMedicaidId,
  prefillFromPcsp,
  type AddClientForm,
} from "./create.ts";
import type { PcspResult } from "./pcsp/parser-shared.ts";

function filledForm(p: Partial<AddClientForm> = {}): AddClientForm {
  return {
    ...emptyAddClientForm(),
    first_name: "Pat",
    last_name: "Example",
    medicaid_id: "0000000001",
    address: "100 Sample St",
    ...p,
  };
}

describe("Medicaid ID duplicates", () => {
  it("compares on letters and digits only", () => {
    assert.equal(normalizeMedicaidId(" 12-345 678 "), "12345678");
    const clients = [
      { id: "a", medicaid_id: "12345678" },
      { id: "b", medicaid_id: null },
    ];
    assert.equal(findMedicaidDuplicate("12 345 678", clients)?.id, "a");
    assert.equal(findMedicaidDuplicate("12345678", clients, "a"), null);
    assert.equal(findMedicaidDuplicate("", clients), null);
  });
});

describe("formProblems", () => {
  it("needs name, Medicaid ID, address and a guardian when not their own", () => {
    assert.deepEqual(formProblems(filledForm()), []);
    assert.deepEqual(formProblems(emptyAddClientForm()), [
      "first name",
      "last name",
      "Medicaid ID",
      "service address",
    ]);
    assert.deepEqual(formProblems(filledForm({ is_own_guardian: false })), [
      "guardian name and phone",
    ]);
  });
  it("needs dates on authorized codes unless waiting on the 1056", () => {
    const line = { code: "DSI", waiting: false, start: null, end: null, units: 100, rate: null };
    assert.equal(formProblems(filledForm({ codes: [line] })).length, 1);
    assert.deepEqual(formProblems(filledForm({ codes: [{ ...line, waiting: true }] })), []);
    assert.match(
      formProblems(filledForm({ codes: [{ ...line, start: "2026-09-01", end: "2026-08-01" }] }))[0],
      /ends before/,
    );
  });
});

describe("row mapping", () => {
  it("maps clients values and blanks to null", () => {
    const v = clientValues(filledForm({ client_pid: " ", phone: "555-0100" }));
    assert.equal(v.client_pid, null);
    assert.equal(v.phone_number, "555-0100");
    assert.equal(v.physical_address, "100 Sample St");
    assert.equal(v.account_status, "active");
  });
  it("saves waiting codes as pending with no units", () => {
    const rows = authorizationRows(
      filledForm({
        codes: [
          {
            code: "hhs",
            waiting: false,
            start: "2026-09-01",
            end: "2027-08-31",
            units: 365,
            rate: 120,
          },
          { code: "DSI", waiting: true, start: null, end: null, units: 50, rate: null },
        ],
      }),
      "org",
      "cli",
    );
    assert.deepEqual(
      rows.map((r) => [
        r.service_code,
        r.unit_type,
        r.annual_unit_authorization,
        r.authorization_pending,
      ]),
      [
        ["HHS", "day", 365, false],
        ["DSI", "unit", 0, true],
      ],
    );
  });
  it("adds the support coordinator, and the guardian only when not their own", () => {
    const sc = {
      name: "Casey Sample",
      phone: "555-0101",
      email: "",
      relationship: "",
      company: "Sample Co",
    };
    const g = {
      name: "Gale Guardian",
      phone: "555-0102",
      email: "",
      relationship: "Parent",
      company: "",
    };
    assert.deepEqual(
      contactRows(filledForm({ support_coordinator: sc, guardian: g })).map((c) => c.role),
      ["support_coordinator"],
    );
    const rows = contactRows(
      filledForm({ support_coordinator: sc, guardian: g, is_own_guardian: false }),
    );
    assert.deepEqual(
      rows.map((c) => c.role),
      ["support_coordinator", "guardian"],
    );
    assert.equal(rows[1].relationship, "Parent");
  });
});

describe("prefillFromPcsp", () => {
  const pcsp = {
    plan: {
      start: "2026-09-01",
      end: "2027-08-31",
      activatedOn: null,
      status: null,
      meetingDate: null,
    },
    person: {
      name: "Pat Q. Example",
      pid: "0000000",
      residentialAddress: "100 Sample Street",
      mailingAddress: "",
      phone: "555-0100",
      supportCoordinator: {
        name: "Casey Sample",
        email: "casey@example.test",
        phone: "555-0101",
        company: "Sample Co",
      },
    },
    budget: [
      {
        code: "DSI",
        kind: "W",
        provider: "Us",
        ours: true,
        start: "2026-09-01",
        end: "2027-08-31",
        rate: 8.5,
        maxMonthlyUnits: 200,
        annualUnits: 2000,
        total: 17000,
      },
      {
        code: "SEI",
        kind: "W",
        provider: "Them",
        ours: false,
        start: "2026-09-01",
        end: "2027-08-31",
        rate: 9,
        maxMonthlyUnits: 10,
        annualUnits: 100,
        total: 900,
      },
    ],
    goals: [],
    nonGoalSupports: [],
    purchasedServices: [],
    risks: [],
    lastYearGoals: [],
    issues: [],
  } as PcspResult;

  it("fills empty fields and tags them; only our codes", () => {
    const { form, filled } = prefillFromPcsp(emptyAddClientForm(), pcsp);
    assert.equal(form.first_name, "Pat");
    assert.equal(form.last_name, "Example");
    assert.equal(form.client_pid, "0000000");
    assert.equal(form.support_coordinator.company, "Sample Co");
    assert.deepEqual(
      form.codes.map((c) => [c.code, c.units, c.waiting]),
      [["DSI", 2000, false]],
    );
    assert.deepEqual(filled, [
      "name",
      "client_pid",
      "phone",
      "address",
      "support_coordinator",
      "codes",
    ]);
  });
  it("never overwrites what was typed", () => {
    const { form, filled } = prefillFromPcsp(filledForm({ phone: "555-9999" }), pcsp);
    assert.equal(form.first_name, "Pat");
    assert.equal(form.phone, "555-9999");
    assert.equal(form.address, "100 Sample St");
    assert.ok(!filled.includes("name") && !filled.includes("phone") && !filled.includes("address"));
  });
});

describe("formFromDraftValues", () => {
  it("maps imported fields and parses the form schema", () => {
    const f = formFromDraftValues({
      first_name: "Pat",
      last_name: "Example",
      medicaid_id: "0000000001",
      physical_address: "100 Sample St",
      is_own_guardian: "false",
      guardian_name: "Gale",
      guardian_phone: "555-0102",
      authorized_dspd_codes: "dsi, HHS;DSI",
      date_of_birth: "not a date",
    });
    assert.equal(f.is_own_guardian, false);
    assert.equal(f.guardian.name, "Gale");
    assert.equal(f.date_of_birth, null);
    assert.deepEqual(
      f.codes.map((c) => [c.code, c.waiting]),
      [
        ["DSI", true],
        ["HHS", true],
      ],
    );
    assert.equal(addClientFormSchema.safeParse(f).success, true);
  });
});
