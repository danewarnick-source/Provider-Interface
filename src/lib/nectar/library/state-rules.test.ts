import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStateRulePath,
  planStateRuleVersion,
  PublishStateRuleInput,
  ruleKeyFor,
  searchProgress,
  STATE_RULE_MAX_BYTES,
  StateRuleIdInput,
  stateRuleFileProblem,
  stateRuleObjectPath,
  StateRuleUploadUrlInput,
} from "./state-rules.ts";

const ID = "6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";
const CURRENT = {
  id: "256f037e-3487-4c8a-bc32-201eab1c42cc",
  rule_key: "dhhs91172-sow",
  title: "DHHS91172 Scope of Work",
  version: 1,
  effective_from: "2026-07-01",
};

describe("state-rules.ts (N4)", () => {
  it("takes only files Nectar can read: PDF, Word (.docx) or text, up to 25 MB", () => {
    assert.equal(stateRuleFileProblem({ fileName: "sow.pdf", sizeBytes: 10 }), null);
    assert.equal(stateRuleFileProblem({ fileName: "rule.DOCX", sizeBytes: 10 }), null);
    assert.equal(stateRuleFileProblem({ fileName: "rule.md", sizeBytes: 10 }), null);
    assert.match(stateRuleFileProblem({ fileName: "rule.doc", sizeBytes: 10 })!, /PDF, Word/);
    assert.match(stateRuleFileProblem({ fileName: "a.pdf", sizeBytes: 0 })!, /empty/);
    assert.match(
      stateRuleFileProblem({ fileName: "a.pdf", sizeBytes: STATE_RULE_MAX_BYTES + 1 })!,
      /25 MB/,
    );
  });

  it("stores the file under a fresh id, and accepts back only such a path", () => {
    const path = stateRuleObjectPath("Scope of Work (2026).pdf", ID);
    assert.equal(path, `${ID}-Scope_of_Work__2026_.pdf`);
    assert.equal(isStateRulePath(path), true);
    assert.equal(
      isStateRulePath(`7fabcf5d-f826-487f-8730-8b0c3f1969bb/library/${ID}-x.pdf`),
      false,
    );
    assert.equal(isStateRulePath(`${ID}-../x.pdf`), false);
    assert.equal(isStateRulePath("x.pdf"), false);
  });

  it("a new rule starts at v1 under a key from its title", () => {
    assert.equal(ruleKeyFor("R539-4 Behavior Supports"), "r539-4-behavior-supports");
    assert.equal(ruleKeyFor("  ***  "), "state-rule");
    assert.deepEqual(planStateRuleVersion(null, { title: "R539-4 Behavior Supports" }), {
      rule_key: "r539-4-behavior-supports",
      title: "R539-4 Behavior Supports",
      version: 1,
      effective_from: null,
    });
  });

  it("a replacement is the next version of the same rule, keeping its title and date unless given", () => {
    assert.deepEqual(planStateRuleVersion(CURRENT, {}), {
      rule_key: "dhhs91172-sow",
      title: "DHHS91172 Scope of Work",
      version: 2,
      effective_from: "2026-07-01",
    });
    assert.deepEqual(
      planStateRuleVersion(CURRENT, {
        title: "DHHS91172 Scope of Work (amended)",
        effectiveFrom: "2027-01-01",
      }),
      {
        rule_key: "dhhs91172-sow",
        title: "DHHS91172 Scope of Work (amended)",
        version: 2,
        effective_from: "2027-01-01",
      },
    );
  });

  it("reports how much of a version is in Nectar search", () => {
    assert.deepEqual(searchProgress(0, 0), {
      sections: 0,
      embedded: 0,
      pending: 0,
      label: "Not in Nectar search yet",
    });
    assert.equal(searchProgress(300, 300).label, "300 sections in Nectar search");
    assert.equal(searchProgress(300, 120).pending, 180);
    assert.match(searchProgress(300, 120).label, /180 still being prepared/);
  });

  it("validates the executive's inputs", () => {
    const upload = {
      path: `${ID}-sow.pdf`,
      fileName: "sow.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5,
    };
    assert.ok(PublishStateRuleInput.safeParse({ title: "New rule", upload }).success);
    assert.ok(PublishStateRuleInput.safeParse({ ruleKey: "dhhs91172-sow", upload }).success);
    assert.equal(PublishStateRuleInput.safeParse({ upload }).success, false, "a name or a rule");
    assert.equal(PublishStateRuleInput.safeParse({ ruleKey: "Bad Key", upload }).success, false);
    assert.equal(StateRuleIdInput.safeParse({ stateRuleId: "nope" }).success, false);
    assert.equal(
      StateRuleUploadUrlInput.safeParse({ fileName: "a.pdf", sizeBytes: STATE_RULE_MAX_BYTES + 1 })
        .success,
      false,
    );
  });
});
