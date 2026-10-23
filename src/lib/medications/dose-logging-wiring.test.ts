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
  const src = read("./give-meds.functions.ts");
  const pass = src.slice(
    src.indexOf("export const logMedicationPass"),
    src.indexOf("async function handsOnBlockedReason"),
  );

  it("checks the med belongs to the client, is active and not paused, and the caller may chart", () => {
    assert.match(pass, /passBlockReason\(m, data\.clientId\)/);
    assert.match(src, /rpc\("can_log_client_meds"/);
    assert.match(pass, /client_id, organization_id, is_active, discontinued_at, paused_at/);
  });

  it("reads how_taken (not support_level), keeps the nurse-role check, never blocks on training", () => {
    assert.match(pass, /administratorRole\(m\.how_taken, data\.nurseRole\)/);
    const code = pass
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    assert.doesNotMatch(code, /support_level/);
    assert.doesNotMatch(pass, /medTrainingStatus\(/);
    assert.match(pass, /rpc\("med_admin_role_permitted"/);
  });

  it("charts through log_medication_dose only, with no browser count or decrement", () => {
    assert.match(pass, /rpc\("log_medication_dose"/);
    assert.doesNotMatch(pass, /from\("emar_logs"\)\s*\.insert/);
    assert.doesNotMatch(pass, /from\("controlled_med_counts"\)\s*\.insert/);
    assert.doesNotMatch(pass, /pill_count_current/);
    assert.doesNotMatch(src, /controlledExpected|expected_count:/);
  });

  it("the old pass path and its shadow checklists are gone", () => {
    assert.doesNotMatch(
      read("../emar-pass.functions.ts"),
      /logMedicationPass =|logShiftChangeCount/,
    );
  });
});

describe("Give meds is the only place doses are logged", () => {
  const routes = new URL("../../routes/", import.meta.url);
  const screens = [
    readFileSync(new URL("dashboard.workspace.$clientId.tsx", routes), "utf8"),
    readFileSync(new URL("dashboard.hhs-hub.$clientId.tsx", routes), "utf8"),
    readFileSync(new URL("dashboard.shift.$shiftId.tsx", routes), "utf8"),
    read("../../components/medications/give-meds/clock-out-meds.tsx"),
  ];
  it("each screen uses the Give meds component", () => {
    for (const s of screens) assert.match(s, /<GiveMeds\b/);
    assert.match(read("../../components/evv/punch-pad.tsx"), /<ClockOutMeds\b/);
  });
  it("no screen writes emar_logs or calls logMedicationPass itself", () => {
    for (const s of [...screens, read("../../components/evv/punch-pad.tsx")]) {
      assert.doesNotMatch(s, /from\("emar_logs"\)\s*\.insert|logMedicationPass/);
    }
  });
  it("Wrong or missed dose? files a Medication error incident linked to the dose", () => {
    const logged = read("../../components/medications/give-meds/logged-doses.tsx");
    assert.match(logged, /defaultCategory="Medication error"/);
    assert.match(logged, /emarLogId=/);
    const incidents = read("../incidents.functions.ts");
    assert.match(incidents, /emar_log_id: emarLogId/);
    assert.match(incidents, /That dose isn't this client's/);
    assert.match(incidents, /is_medication_error: true/);
  });
  it("the clock-out link points at the MAR tab that exists", () => {
    assert.match(read("../../components/medications/give-meds/clock-out-meds.tsx"), /tab: "emar"/);
    assert.doesNotMatch(read("../../components/evv/punch-pad.tsx"), /mar-emar/);
  });
});

describe("HHS meds path", () => {
  it("saveEmarLog (browser-supplied staff name, no checks) is removed", () => {
    assert.doesNotMatch(read("../scheduler/hhs.functions.ts"), /saveEmarLog|staffName/);
  });
});

describe("dose database rules", () => {
  it("M5: one function saves the dose with its one-statement count change", () => {
    const sql = migration("_meds_m5_log_medication_dose_counts_times_training.sql");
    assert.match(sql, /set pill_count_current = pill_count_current - 1/);
    assert.match(sql, /returning pill_count_current into v_expected_after/);
    assert.doesNotMatch(sql, /greatest\(0/i, "never clamps at 0");
    assert.match(sql, /v_expected_before := v_med\.pill_count_current/);
    assert.match(sql, /interval '24 hours'/);
    assert.match(sql, /med_training_status\(v_uid/);
    assert.match(sql, /med_witness_confirmations/);
    assert.match(sql, /v_conf\.witness_id = v_uid/);
  });

  it("M5: follow-ups go through record_prn_followup and the lock covers every charted field", () => {
    const f = migration("_meds_m5_prn_followups.sql");
    assert.match(f, /'prn_followup_due'/);
    assert.match(f, /cron\.schedule\('prn-followup-due'/);
    const lock = migration("_meds_m5_lock_logged_doses_fully.sql");
    assert.match(lock, /to_jsonb\(new\) - v_review_fields/);
  });

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
