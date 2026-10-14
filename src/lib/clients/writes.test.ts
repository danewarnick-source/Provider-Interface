import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NO_PERMISSION_MESSAGE } from "./guards.ts";
import {
  CLIENT_RECORD_TABLES,
  actionsForClientPatch,
  assertRowsChanged,
  changedClientFields,
  stampRows,
  stripScopeColumns,
  tableConfig,
} from "./writes.ts";

const ORG = "33333333-3333-4333-8333-333333333333";
const CLIENT = "22222222-2222-4222-8222-222222222222";

describe("actionsForClientPatch", () => {
  it("plain fields need Clients: Edit only", () => {
    assert.deepEqual(
      actionsForClientPatch({ special_directions: "a" }, { special_directions: "b" }),
      ["edit"],
    );
  });
  it("changed medical fields also need Client medical: Edit", () => {
    assert.deepEqual(actionsForClientPatch({ allergies: null }, { allergies: "Peanuts" }), [
      "edit",
      "edit_medical",
    ]);
  });
  it("unchanged medical fields don't", () => {
    assert.deepEqual(
      actionsForClientPatch(
        { allergies: "Peanuts", phone_number: "1" },
        { allergies: "Peanuts", phone_number: "2" },
      ),
      ["edit"],
    );
  });
  it("insurance is medical info", () => {
    assert.deepEqual(actionsForClientPatch({ insurance: null }, { insurance: "Plan A" }), [
      "edit",
      "edit_medical",
    ]);
  });
  it("diet, mobility and the emergency plan are medical info", () => {
    for (const [k, v] of [
      ["diets", ["Pureed"]],
      ["mobility", ["Walker"]],
      ["emergency_plan", "Call 911."],
    ] as const) {
      assert.deepEqual(actionsForClientPatch({ [k]: null }, { [k]: v }), ["edit", "edit_medical"]);
    }
  });
  it("status and discharge date change only through the discharge flow", () => {
    assert.throws(
      () => actionsForClientPatch({ account_status: "active" }, { account_status: "archived" }),
      /can't be changed: account_status/,
    );
    assert.throws(
      () => actionsForClientPatch({}, { discharge_date: "2026-01-02" }),
      /can't be changed: discharge_date/,
    );
  });
  it("the old client-level self-admin flags are no longer editable", () => {
    for (const k of ["self_admin_med_support", "self_admin_med_support_locked"])
      assert.throws(() => actionsForClientPatch({}, { [k]: true }), /can't be changed/);
  });
  it("refuses to move a client to another organization", () => {
    assert.throws(() => actionsForClientPatch({}, { organization_id: ORG }), /can't be changed/);
  });
  it("compares arrays by value", () => {
    assert.deepEqual(changedClientFields({ diagnoses: ["A"] }, { diagnoses: ["A"] }), []);
  });
});

describe("tableConfig", () => {
  it("rejects unknown tables", () => {
    assert.throws(() => tableConfig("clients", "insert"), /Unknown client table/);
  });
  it("rejects ops not allowed on a table", () => {
    assert.throws(() => tableConfig("client_progress_summaries", "update"), /not allowed/);
  });
  it("allows no deletes on any client table (records are ended or archived)", () => {
    for (const cfg of Object.values(CLIENT_RECORD_TABLES)) {
      assert.equal((cfg.ops as readonly string[]).includes("delete"), false);
    }
  });
  it("maps tables to the right action", () => {
    assert.equal(CLIENT_RECORD_TABLES.client_billing_codes.action, "edit_billing");
    assert.equal(CLIENT_RECORD_TABLES.hrc_restriction_records.action, "edit_hrc");
    assert.equal(CLIENT_RECORD_TABLES.pba_transactions.action, "edit_funds");
    assert.equal(CLIENT_RECORD_TABLES.client_documents.action, "edit");
  });
  it("rights restrictions are only inserted here; saves go through saveHrr", () => {
    assert.throws(() => tableConfig("hrc_restriction_records", "update"), /not allowed/);
    assert.equal(tableConfig("hrc_restriction_records", "insert").action, "edit_hrc");
  });
});

describe("stampRows", () => {
  it("forces organization and client from the request", () => {
    const [row] = stampRows(
      tableConfig("client_billing_codes", "upsert"),
      [{ organization_id: "x", client_id: "y", service_code: "SLH" }],
      ORG,
      CLIENT,
    );
    assert.equal(row.organization_id, ORG);
    assert.equal(row.client_id, CLIENT);
    assert.equal(row.service_code, "SLH");
  });
  it("stamps the organization on parent-keyed rows but adds no client column", () => {
    const [row] = stampRows(
      tableConfig("pba_transactions", "insert"),
      [{ account_id: "a", organization_id: "x" }],
      ORG,
      CLIENT,
    );
    assert.deepEqual(row, { account_id: "a", organization_id: ORG });
  });
  it("the monthly budget tables are gone", () => {
    assert.throws(() => tableConfig("client_budgets", "insert"), /Unknown client table/);
    assert.throws(() => tableConfig("client_budget_lines", "insert"), /Unknown client table/);
  });
  it("requires a client for client tables", () => {
    assert.throws(
      () => stampRows(tableConfig("client_documents", "insert"), [{}], ORG, null),
      /client is required/,
    );
  });
});

describe("stripScopeColumns", () => {
  it("drops id, organization_id and client_id", () => {
    assert.deepEqual(stripScopeColumns({ id: 1, organization_id: 2, client_id: 3, name: "x" }), {
      name: "x",
    });
  });
});

describe("assertRowsChanged", () => {
  it("throws the plain-English error when nothing changed", () => {
    assert.throws(() => assertRowsChanged([]), new RegExp(NO_PERMISSION_MESSAGE));
    assert.throws(() => assertRowsChanged(null), new RegExp(NO_PERMISSION_MESSAGE));
  });
  it("returns the rows otherwise", () => {
    assert.deepEqual(assertRowsChanged([{ id: "a" }]), [{ id: "a" }]);
  });
});
