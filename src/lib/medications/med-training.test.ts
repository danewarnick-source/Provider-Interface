import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { asTrainingStatus, canGiveWithTraining, trainingNotice } from "./med-training.ts";

describe("medication training", () => {
  it("anything but approved or not set up counts as not current", () => {
    assert.equal(asTrainingStatus("approved"), "approved");
    assert.equal(asTrainingStatus("not_set_up"), "not_set_up");
    assert.equal(asTrainingStatus(null), "not_current");
    assert.equal(asTrainingStatus("pending"), "not_current");
  });

  it("only staff without approved, current training are stopped from giving", () => {
    assert.equal(canGiveWithTraining("approved"), true);
    assert.equal(canGiveWithTraining("not_set_up"), true);
    assert.equal(canGiveWithTraining("not_current"), false);
  });

  it("admins of an agency without medication training are told to set it up in Evidence", () => {
    assert.equal(trainingNotice("approved", true), null);
    assert.equal(trainingNotice("not_set_up", false), null);
    const admin = trainingNotice("not_set_up", true);
    assert.match(admin?.text ?? "", /Set up medication training in Evidence/);
    assert.equal(admin?.href, "/dashboard/evidence");
    assert.equal(trainingNotice("not_current", false)?.tone, "danger");
  });

  it("the server check counts only accepted, unexpired training and keeps the scheduler note", () => {
    const server = readFileSync(new URL("./med-training.server.ts", import.meta.url), "utf8");
    assert.match(server, /S4-REPOINT: use qualificationsOnDate/);
    assert.match(server, /rpc\("med_training_status"/);
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20261014001300_meds_m5_med_training_status.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(sql, /review_status = 'accepted'/);
    assert.match(sql, /expires_on >= _on/);
    assert.match(sql, /return 'not_set_up'/);
  });
});
