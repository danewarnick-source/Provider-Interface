// Source checks for the server side of support strategies sends: the table,
// who may record or undo a send, the Evidence copy, the one rule everywhere,
// and Nectar copying (never writing) strategies from an uploaded document.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("client_strategy_sends migration", () => {
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  const file = readdirSync(dir).find((f) => f.endsWith("_client_strategy_sends.sql"));
  const sql = file ? readFileSync(new URL(file, dir), "utf8") : "";

  it("is additive, org-scoped and one live send per plan", () => {
    assert.ok(file, "migration file exists");
    assert.match(sql, /create table if not exists public\.client_strategy_sends/);
    assert.match(sql, /on public\.client_strategy_sends \(plan_id\) where voided_at is null/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /is_org_admin_or_manager\(organization_id, auth\.uid\(\)\)/);
    assert.match(sql, /access_can_see_client\(client_id, auth\.uid\(\)\)/);
    assert.doesNotMatch(sql, /using \(true\)|\bdrop\b|\bdelete\b/i);
  });
});

describe("recording a send", () => {
  const fns = read("./strategy-sends.functions.ts");

  it("is for editors, the current plan, approved strategies or an upload, and not in the future", () => {
    assert.match(fns, /action: "edit"/);
    assert.match(fns, /plan\.id !== data\.planId/);
    assert.match(fns, /strategiesApprovedFor\(training \?\? null, plan\)/);
    assert.match(fns, /data\.sentOn > denverYmd\(\)/);
  });

  it("files the exact PDF or the uploaded file as an accepted Evidence file", () => {
    assert.match(fns, /loadStrategiesDocument\(sb, client\)/);
    assert.match(fns, /uploadedStrategiesDoc\(sb, client\.id, content\)/);
    assert.match(fns, /accepted: true/);
    assert.match(fns, /evidence_file_id: evidenceFileId/);
    assert.match(read("../evidence/record-upload.server.ts"), /return row\.id;/);
  });

  it("undoes with a soft void and never deletes", () => {
    assert.match(fns, /voided_at: new Date\(\)\.toISOString\(\), voided_by: userId/);
    assert.doesNotMatch(fns, /\.delete\(/);
  });

  it("never counts a send's own Evidence copy as an older upload", () => {
    assert.match(read("./strategy-sends.server.ts"), /sendFiles\.has\(f\.id\)/);
  });
});

describe("one rule everywhere", () => {
  it("Client file, Overview and Evidence read the send states", () => {
    assert.match(read("./file-index.ts"), /loadStrategyStates\(/);
    assert.match(read("./overview-load.ts"), /loadStrategyStates\(/);
    assert.match(read("../evidence.functions.ts"), /loadStrategyStates\(/);
    assert.doesNotMatch(read("./file-index-queries.ts"), /support strategies|training_type/i);
    assert.doesNotMatch(read("./file-docs.ts"), /"bsp"/);
  });
});

describe("new plan year and uploaded documents", () => {
  it("drafts only missing strategies, keeping the ones that carried over", () => {
    const t = read("./training.functions.ts");
    assert.match(t, /"missing"/);
    assert.match(t, /opts\.carry \? carryForward\(supports, existing\)/);
  });

  it("copies strategies from the document, checks each bullet, and leaves a draft", () => {
    const pull = read("./strategies-pull.functions.ts");
    assert.match(pull, /parsePullReply\(reply, needed, text\)/);
    assert.match(pull, /status: "draft"/);
    assert.match(pull, /source_document_id: doc\.id/);
    assert.match(pull, /approved_at: null/);
  });
});
