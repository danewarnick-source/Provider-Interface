import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import {
  UNIT_ALERT_NOT_ALLOWED,
  canRecordUnitAlert,
  coordinatorEmail,
  coordinatorMailto,
  unitAlertLine,
  unitAlertState,
  type UnitAlert,
} from "./unit-alerts.ts";

const input = {
  clientName: "Jamie Rivers",
  code: "SLN",
  used: 412,
  total: 600,
  unitWord: "units",
  runsOutOn: "2026-11-03",
};

describe("coordinator email", () => {
  it("subject is the client and code; body has units, run-out date and the ask", () => {
    const { subject, body } = coordinatorEmail(input);
    assert.equal(subject, "Jamie Rivers: SLN units");
    assert.match(body, /^412 of 600 units used\./);
    assert.match(body, /run out Nov 3, 2026\./);
    assert.match(body, /Can we talk about adjusting the PCSP\?$/);
  });

  it("uses days for daily codes and rounds with separators", () => {
    const { body } = coordinatorEmail({ ...input, used: 1234.6, total: 2000, unitWord: "days" });
    assert.match(body, /^1,235 of 2,000 days used\./);
  });

  it("encodes subject and body; nothing else about the client", () => {
    const url = coordinatorMailto(" sc@example.org ", { ...input, clientName: "Ana & Bo?" });
    assert.ok(url.startsWith("mailto:sc@example.org?subject="));
    const q = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    assert.equal(q.get("subject"), "Ana & Bo?: SLN units");
    assert.equal(q.get("body"), coordinatorEmail({ ...input, clientName: "Ana & Bo?" }).body);
    assert.ok(!url.includes(" ") && !url.includes("\n") && !url.includes("&Bo"));
    assert.match(url, /%0D%0A/);
    const params = [...q.keys()];
    assert.deepEqual(params, ["subject", "body"]);
    assert.ok(!q.get("body")!.includes("Ana"), "body doesn't name the client");
  });
});

describe("unit alert state", () => {
  const alert: UnitAlert = {
    id: "a1",
    billingCodeId: "row1",
    by: "Dane Warnick",
    on: "2026-10-08",
  };
  const base = {
    warning: true,
    billingCodeId: "row1",
    alerts: [] as UnitAlert[],
    coordinatorEmail: "sc@example.org",
    clicked: false,
    canEdit: true,
  };

  it("nothing without the run-out warning", () => {
    assert.deepEqual(unitAlertState({ ...base, warning: false, alerts: [alert] }), {
      kind: "hidden",
    });
  });

  it("warning shown → the Email coordinator button", () => {
    assert.deepEqual(unitAlertState(base), { kind: "email", email: "sc@example.org" });
  });

  it("no coordinator or no email → the Contacts link", () => {
    assert.equal(unitAlertState({ ...base, coordinatorEmail: null }).kind, "add_email");
    assert.equal(unitAlertState({ ...base, coordinatorEmail: "  " }).kind, "add_email");
  });

  it("after the button is clicked → the I sent it checkbox", () => {
    assert.equal(unitAlertState({ ...base, clicked: true }).kind, "confirm");
  });

  it("recorded → the line with Undo; a record for another row (renewal) doesn't count", () => {
    assert.deepEqual(unitAlertState({ ...base, alerts: [alert] }), { kind: "recorded", alert });
    assert.equal(
      unitAlertState({ ...base, alerts: [{ ...alert, billingCodeId: "old" }] }).kind,
      "email",
    );
  });

  it("viewers only see a record", () => {
    assert.equal(unitAlertState({ ...base, canEdit: false }).kind, "hidden");
    assert.equal(unitAlertState({ ...base, canEdit: false, alerts: [alert] }).kind, "recorded");
  });

  it("says who and when", () => {
    assert.equal(unitAlertLine(alert), "✓ Coordinator emailed by Dane Warnick, Oct 8, 2026");
    assert.equal(unitAlertLine({ ...alert, by: null }), "✓ Coordinator emailed, Oct 8, 2026");
  });
});

describe("client_unit_alerts wiring", () => {
  const dir = new URL("../../../../supabase/migrations/", import.meta.url);
  const file = readdirSync(dir).find((f) => f.endsWith("_client_unit_alerts.sql"));
  const sql = file ? readFileSync(new URL(file, dir), "utf8") : "";
  const fns = readFileSync(new URL("./unit-alerts.functions.ts", import.meta.url), "utf8");

  it("migration is additive, org-scoped and one live record per authorization row", () => {
    assert.ok(file, "migration file exists");
    assert.match(sql, /create table if not exists public\.client_unit_alerts/);
    assert.match(sql, /references public\.client_billing_codes\(id\)/);
    assert.match(sql, /\(billing_code_id\) where voided_at is null/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /access_can_see_client\(client_id, auth\.uid\(\)\)/);
    assert.match(sql, /access_has_category\(organization_id, auth\.uid\(\), 'billing', 'edit'\)/);
    assert.doesNotMatch(sql, /using \(true\)|\bdrop\b|\bdelete\b/i);
  });

  it("records only while the warning shows; Undo is a soft void", () => {
    assert.match(fns, /action: "edit_billing"/);
    assert.match(fns, /!view\.runsOutOn/);
    assert.match(fns, /voided_at: new Date\(\)\.toISOString\(\), voided_by: userId/);
    assert.doesNotMatch(fns, /\.delete\(/);
  });
});

describe("who can record \"I sent it\"", () => {
  it("Owners and Admins with Billing edit; nobody else", () => {
    assert.equal(canRecordUnitAlert("owner", true), true);
    assert.equal(canRecordUnitAlert("admin", true), true);
    assert.equal(canRecordUnitAlert("admin", false), false);
    assert.equal(canRecordUnitAlert("staff", true), false);
    assert.equal(canRecordUnitAlert(null, true), false);
    assert.equal(canRecordUnitAlert("manager", true), false);
  });

  it("someone who can't record sees only a saved record", () => {
    const base = {
      warning: true,
      billingCodeId: "bc1",
      coordinatorEmail: "sc@example.org",
      clicked: false,
      canEdit: canRecordUnitAlert("staff", true),
    };
    assert.deepEqual(unitAlertState({ ...base, alerts: [] }), { kind: "hidden" });
    const alert = { id: "a1", billingCodeId: "bc1", by: "Dane Warnick", on: "2026-10-13" };
    assert.equal(unitAlertState({ ...base, alerts: [alert] }).kind, "recorded");
  });

  it("server, screen and database all apply it", () => {
    const fns = readFileSync(new URL("./unit-alerts.functions.ts", import.meta.url), "utf8");
    for (const fn of ["export const recordUnitAlert", "export const voidUnitAlert"]) {
      const body = fns.slice(fns.indexOf(fn), fns.indexOf("export const", fns.indexOf(fn) + 1) >>> 0);
      assert.match(body, /await assertCanRecord\(sb, userId, organizationId, clientId\)/, fn);
    }
    assert.match(fns, /requireCategory\(sb, userId, organizationId, "billing", "edit"\)/);
    assert.match(fns, /canRecordUnitAlert\(access\.level, true\)\) throw new Error\(UNIT_ALERT_NOT_ALLOWED\)/);
    assert.match(UNIT_ALERT_NOT_ALLOWED, /Owners and Admins with Billing edit/);
    const ui = readFileSync(
      new URL("../../../components/clients/profile/services/coordinator-email.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /canRecordUnitAlert\(useAccess\(\)\.level, canEdit\)/);
    assert.match(ui, /canEdit: canRecord/);
    const dir = new URL("../../../../supabase/migrations/", import.meta.url);
    const file = readdirSync(dir).find((f) => f.endsWith("_client_unit_alerts_owners_admins.sql"));
    assert.ok(file, "policy migration exists");
    const sql = readFileSync(new URL(file!, dir), "utf8");
    assert.equal(sql.match(/m\.access_level in \('owner', 'admin'\)/g)?.length, 3);
    assert.equal(sql.match(/access_has_category\(organization_id, auth\.uid\(\), 'billing', 'edit'\)/g)?.length, 3);
    assert.doesNotMatch(sql, /is_org_admin_or_manager|\brole\b|using \(true\)|\bdrop\b|\bdelete\b/i);
  });
});
