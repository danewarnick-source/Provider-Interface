// Source checks for dose logging (meds rebuild M1): logMedicationPass's
// guards, the HHS bypass being gone, and the database rules behind them.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const migrationsDir = new URL("../../../supabase/migrations/", import.meta.url);
const migration = (suffix: string) => {
  const file = readdirSync(migrationsDir).find((f) => f.endsWith(suffix));
  assert.ok(file, `${suffix} exists`);
  return readFileSync(new URL(file, migrationsDir), "utf8");
};

describe("logMedicationPass", () => {
  const src = read("../emar-pass.functions.ts");
  const pass = src.slice(
    src.indexOf("export const logMedicationPass"),
    src.indexOf("export const addEmarAddendum"),
  );

  it("checks the med belongs to the client, is active and not paused, and the caller may chart", () => {
    assert.match(pass, /passBlockReason\(m, data\.clientId\)/);
    assert.match(pass, /rpc\("can_log_client_meds"/);
    assert.match(pass, /client_id, is_active, discontinued_at, paused_at/);
  });

  it("treats every charted status (including 'administered') as a duplicate", () => {
    assert.match(pass, /\.in\("status", \[\.\.\.CHARTED_STATUSES\]\)/);
    assert.match(pass, /This dose has already been documented/);
  });

  it("charts through log_medication_dose with a request id and the route", () => {
    assert.match(pass, /rpc\("log_medication_dose"/);
    assert.match(pass, /client_request_id: clientRequestId/);
    assert.match(pass, /route: data\.route/);
    assert.doesNotMatch(pass, /from\("emar_logs"\)\s*\.insert/);
  });
});

describe("HHS meds path", () => {
  it("saveEmarLog (browser-supplied staff name, no checks) is removed", () => {
    assert.doesNotMatch(read("../hhs.functions.ts"), /saveEmarLog|staffName/);
  });
});

describe("dose database rules", () => {
  it("guards taken doses with a unique index and request ids", () => {
    const sql = migration("_meds_m1_emar_logs_new_columns.sql");
    assert.match(sql, /client_request_id uuid not null default gen_random_uuid\(\)/);
    assert.match(sql, /unique \(client_request_id\)/);
    assert.match(sql, /where status = 'administered'/);
  });

  it("locks the medication row and checks PRN limits in one function", () => {
    const sql = migration("_meds_m1_log_medication_dose_fn.sql");
    assert.match(sql, /for update/);
    assert.match(sql, /prn_min_hours/);
    assert.match(sql, /prn_max_per_day/);
    assert.match(sql, /can_log_client_meds\(v_med\.client_id, v_uid\)/);
  });

  it("tightens INSERT rules and scopes reads to PHI access", () => {
    const inserts = migration("_meds_m1_dose_logging_insert_rules.sql");
    for (const t of ["emar_logs", "controlled_med_counts", "emar_log_addenda"]) {
      assert.match(inserts, new RegExp(`on public\\.${t}\\s+with check`));
    }
    const reads = migration("_meds_m1_phi_scoped_med_reads.sql");
    for (const t of [
      "controlled_med_counts",
      "medication_transfers",
      "emar_log_addenda",
      "medication_change_proposals",
    ]) {
      assert.match(reads, new RegExp(`on public\\.${t}\\s+using`));
    }
    assert.doesNotMatch(reads, /using \(public\.is_org_member/);
  });

  it("refuses edits to a logged dose's charted fields", () => {
    const sql = migration("_meds_m1_lock_logged_doses.sql");
    assert.match(sql, /before update on public\.emar_logs/);
    for (const col of [
      "status",
      "scheduled_for",
      "route",
      "medication_id",
      "client_id",
      "pill_count_value",
    ]) {
      assert.match(sql, new RegExp(`new\\.${col} is distinct from old\\.${col}`));
    }
  });
});
