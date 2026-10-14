import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./state-rules.server.ts", import.meta.url), "utf8");

function body(name: string): string {
  const start = SRC.search(new RegExp(`(export )?(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} exists`);
  const next = SRC.slice(start + 1).search(/\n\/\*\*|\n(export )?(async )?function /);
  return SRC.slice(start, next < 0 ? undefined : start + 1 + next);
}

describe("state-rules.server.ts (N4)", () => {
  it("the guard: signed in, then an active hive executive, before anything else", () => {
    const guard = body("requireHiveExecutive");
    const signedIn = guard.indexOf(
      "if (!supabase || !userId) throw new Error(STATE_RULES_SIGNED_OUT);",
    );
    const exec = guard.indexOf('await supabase.rpc("is_hive_executive", { _user: userId })');
    const refuse = guard.indexOf(
      "if (error || data !== true) throw new Error(STATE_RULES_EXEC_ONLY);",
    );
    assert.ok(signedIn > 0 && exec > signedIn && refuse > exec);
  });

  it("uploads go to the private state-rules bucket with a signed URL, checked first", () => {
    const start = body("startStateRuleUpload");
    assert.ok(
      start.indexOf("stateRuleFileProblem(file)") < start.indexOf("createSignedUploadUrl(path)"),
    );
    assert.match(start, /\.from\(STATE_RULES_BUCKET\)\.createSignedUploadUrl\(path\)/);
  });

  it("publishing reads the uploaded file's text and refuses a file without any", () => {
    const read = body("uploadedText");
    assert.match(read, /if \(!isStateRulePath\(upload\.path\)\) throw new Error/);
    assert.match(read, /readStoredFile\(db, upload\.path, STATE_RULES_BUCKET\)/);
    assert.match(
      read,
      /if \(read\.parse_status === "no_text"\) throw new Error\(STATE_RULE_NO_TEXT\);/,
    );
  });

  it("a new version archives the old one (never deletes it) and takes it out of search", () => {
    const publish = body("publishStateRule");
    const archive = publish.indexOf(".update({ archived_at: now })");
    const insert = publish.indexOf(".insert({");
    const retire = publish.indexOf("await retireSections(db, { stateDocumentId: current.id })");
    assert.ok(archive > 0 && insert > archive && retire > insert);
    assert.match(
      publish,
      /if \(current\) \{\s*await db\.from\("state_rule_documents"\)\.update\(\{ archived_at: null \}\)/,
    );
    assert.doesNotMatch(SRC, /\.delete\(|\.remove\(/);
  });

  it("a new rule may not reuse another rule's key", () => {
    assert.match(
      body("publishStateRule"),
      /\.eq\("rule_key", plan\.rule_key\)\s*\.limit\(1\);\s*if \(taken\?\.length\)/,
    );
  });

  it("search: writes the sections first, then embeds until the deadline; only the current version", () => {
    const update = body("updateSearch");
    assert.match(
      update,
      /if \(now\.sections === 0\) await indexStateRuleVersion\(db, rule, \{ embed: false, deadline \}\);/,
    );
    assert.match(
      update,
      /await embedPendingSections\(db, \{ stateDocumentId: rule\.id \}, \{ embed: true, deadline \}\);/,
    );
    assert.match(body("updateStateRuleSearch"), /if \(rule\.archived_at\) throw new Error/);
  });

  it("logs ids only", () => {
    for (const line of SRC.split("\n").filter((l) => l.includes("console."))) {
      assert.match(line, /\{ stateRuleId: rule\.id \}/);
    }
    assert.ok(SRC.split("\n").length <= 300);
  });
});
