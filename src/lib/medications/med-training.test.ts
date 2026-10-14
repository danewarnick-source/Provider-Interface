import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import {
  UNTRAINED_DOSE_MARK,
  asTrainingStatus,
  doseTrainingMark,
  trainingNotice,
} from "./med-training.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const migrationsDir = new URL("../../../supabase/migrations/", import.meta.url);
/** The newest migration whose SQL matches. */
const latestMigration = (re: RegExp) => {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files.reverse()) {
    const sql = readFileSync(new URL(f, migrationsDir), "utf8");
    if (re.test(sql)) return { file: f, sql };
  }
  assert.fail(`no migration matches ${re}`);
};
const noComments = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

describe("medication training statuses", () => {
  it("takes the four server statuses; anything else counts as unapproved", () => {
    for (const s of ["current", "expired", "unapproved", "not_set_up"] as const)
      assert.equal(asTrainingStatus(s), s);
    assert.equal(asTrainingStatus(null), "unapproved");
    assert.equal(asTrainingStatus("approved"), "unapproved");
    assert.equal(asTrainingStatus("pending"), "unapproved");
  });

  it("current says nothing; the other three say doses are marked and never blocked", () => {
    assert.equal(trainingNotice("current", false), null);
    assert.equal(trainingNotice("current", true), null);
    assert.match(trainingNotice("expired", false)?.text ?? "", /has expired\. You can still log/);
    assert.match(trainingNotice("unapproved", false)?.text ?? "", /isn't approved\. You can still log/);
    assert.match(trainingNotice("not_set_up", false)?.text ?? "", /isn't set up for your agency/);
    const admin = trainingNotice("not_set_up", true);
    assert.equal(admin?.href, "/dashboard/evidence");
    assert.match(admin?.text ?? "", /admins are told/);
    for (const s of ["expired", "unapproved", "not_set_up"] as const)
      assert.doesNotMatch(trainingNotice(s, false)?.text ?? "", /can't/);
  });

  it("marks a flagged dose with the fixed text and its reason", () => {
    assert.equal(doseTrainingMark({ given_without_current_training: false }), null);
    assert.equal(doseTrainingMark({}), null);
    assert.equal(
      doseTrainingMark({ given_without_current_training: true, training_issue: "expired" }),
      `${UNTRAINED_DOSE_MARK} (training expired)`,
    );
    assert.equal(
      doseTrainingMark({ given_without_current_training: true, training_issue: "unapproved" }),
      `${UNTRAINED_DOSE_MARK} (training not approved)`,
    );
    assert.equal(
      doseTrainingMark({ given_without_current_training: true, training_issue: "not_set_up" }),
      `${UNTRAINED_DOSE_MARK} (no med training set up)`,
    );
    assert.equal(UNTRAINED_DOSE_MARK, "Given by staff without current med training");
  });
});

describe("the one training decision (server)", () => {
  const { sql } = latestMigration(/create or replace function public\.med_training_status/);

  it("med_training_decision is pure and returns each of the four statuses", () => {
    assert.match(sql, /function public\.med_training_decision\([\s\S]*?immutable/);
    const decision = sql.slice(sql.indexOf("select case"), sql.indexOf("end\n$$;"));
    assert.match(decision, /when not coalesce\(_agency_has_training, false\) then 'not_set_up'/);
    assert.match(decision, /when coalesce\(_has_current, false\) then 'current'/);
    assert.match(decision, /when coalesce\(_has_expired, false\) then 'expired'/);
    assert.match(decision, /else 'unapproved'/);
  });

  it("med_training_status reads the training records and only asks the decision", () => {
    const status = sql.slice(sql.indexOf("function public.med_training_status"));
    assert.match(status, /ef\.review_status = 'accepted'/);
    assert.match(status, /ei\.expires_on is null or ei\.expires_on >= _on/);
    assert.match(status, /ei\.expires_on < _on/);
    assert.match(status, /return public\.med_training_decision\(v_set_up, v_current, v_expired\)/);
    assert.doesNotMatch(noComments(status), /return '(current|expired|unapproved|not_set_up)'/);
  });

  it("the app normalizes the server's answer and has no second decision", () => {
    const server = read("./med-training.server.ts");
    assert.match(server, /rpc\("med_training_status"/);
    assert.match(server, /asTrainingStatus\(data\)/);
    assert.doesNotMatch(read("./med-training.ts"), /canGiveWithTraining/);
  });
});

describe("a dose by staff without current training", () => {
  const { file, sql } = latestMigration(/create or replace function public\.log_medication_dose/);
  const code = noComments(sql);

  it("still saves: no training refusal in log_medication_dose", () => {
    assert.match(file, /_meds_log_medication_dose_marks_untrained\.sql$/);
    assert.doesNotMatch(code, /TRAINING:/);
    assert.doesNotMatch(code, /v_training[^;]*\n?\s*then\s+raise/);
    assert.match(code, /v_untrained := v_training <> 'current'/);
    assert.match(code, /given_without_current_training, training_issue\n\s*\) values/);
    assert.match(code, /v_untrained, case when v_untrained then v_training end/);
  });

  it("notifies admins for expired, unapproved and not set up, and not for current", () => {
    const block = code.slice(code.indexOf("if v_untrained then"), code.indexOf("end if;", code.indexOf("if v_untrained then")));
    assert.match(block, /insert into public\.notifications/);
    assert.match(block, /'admin', 'staff_mandate_missing', 'urgent'/);
    assert.match(block, /'Given by staff without current med training'/);
    assert.match(block, /v_id, 'emar_log'/);
    for (const s of ["expired", "not_set_up"]) assert.match(block, new RegExp(`when '${s}'`));
    assert.match(block, /else 'Their med training isn''t approved\.'/);
    // The only notification insert is behind v_untrained, which is false for 'current'.
    assert.equal(code.match(/insert into public\.notifications/g)?.length, 1);
  });

  it("Give meds no longer stops a given dose over training", () => {
    const fns = read("./give-meds.functions.ts");
    const pass = fns.slice(
      fns.indexOf("export const logMedicationPass"),
      fns.indexOf("async function handsOnBlockedReason"),
    );
    assert.doesNotMatch(pass, /medTrainingStatus|training isn't approved/);
    assert.match(pass, /rpc\("log_medication_dose"/);
    const ui = read("../../components/medications/give-meds/give-meds.tsx");
    assert.doesNotMatch(ui, /canGive/);
    assert.match(ui, /const startGive = \(t: GiveTarget\) => setGive\(t\)/);
  });

  it("columns: a flag and a reason, kept in step", () => {
    const { sql: cols } = latestMigration(/add column if not exists given_without_current_training/);
    assert.match(cols, /training_issue in \('expired', 'unapproved', 'not_set_up'\)/);
    assert.match(cols, /given_without_current_training = \(training_issue is not null\)/);
  });
});
