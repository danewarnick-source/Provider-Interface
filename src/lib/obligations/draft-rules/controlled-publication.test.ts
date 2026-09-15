import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REQ_1_8_4_ORIENTATION, REQ_1_12_EVV } from "./fixtures.ts";
import { canActivate } from "./publication.ts";
import {
  committedPublicationIssues,
  formatVerifiedPublicationSnippet,
  mergeVerifiedPublications,
  proposeVerifiedPublications,
} from "./controlled-publication.ts";
import { applyVerifiedPublicationOverlay, VERIFIED_PUBLICATIONS } from "./verified-publication.ts";

const APPROVAL = {
  actorId: "dane",
  actorLabel: "Dane",
  approvedAt: "2026-09-15T00:00:00.000Z",
};

describe("controlled publication path", () => {
  it("keeps the committed overlay empty — this PR does not publish", () => {
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    assert.deepEqual(committedPublicationIssues([REQ_1_8_4_ORIENTATION, REQ_1_12_EVV]), []);
  });

  it("accepts one complete rule and leaves a gapped sibling draft with reasons", () => {
    const decision = proposeVerifiedPublications(
      [REQ_1_8_4_ORIENTATION, REQ_1_12_EVV],
      ["REQ-1.8.4", "REQ-1.12"],
      APPROVAL,
    );
    assert.deepEqual(
      decision.accepted.map((row) => row.ruleId),
      ["REQ-1.8.4"],
    );
    assert.equal(decision.unresolved.length, 1);
    assert.equal(decision.unresolved[0]?.ruleId, "REQ-1.12");
    assert.ok((decision.unresolved[0]?.reasons.length ?? 0) > 0);

    const merged = mergeVerifiedPublications(VERIFIED_PUBLICATIONS, decision.accepted);
    const overlay = applyVerifiedPublicationOverlay([REQ_1_8_4_ORIENTATION, REQ_1_12_EVV]);
    // Overlay reads the committed list, not the proposed merge.
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
    assert.equal(merged.length, 1);
    assert.equal(overlay[0]?.publication, "not_published");
    assert.equal(overlay[1]?.publication, "not_published");
    assert.equal(canActivate(REQ_1_12_EVV), false);
  });

  it("does not publish unrequested siblings when proposing one id", () => {
    const decision = proposeVerifiedPublications(
      [REQ_1_8_4_ORIENTATION, REQ_1_12_EVV],
      ["REQ-1.8.4"],
      APPROVAL,
    );
    assert.equal(decision.accepted.length, 1);
    assert.equal(decision.unresolved.length, 0);
    const merged = mergeVerifiedPublications([], decision.accepted);
    assert.deepEqual(
      merged.map((row) => row.ruleId),
      ["REQ-1.8.4"],
    );
  });

  it("rejects a missing id and a gapped approval without flipping the list", () => {
    const missing = proposeVerifiedPublications([REQ_1_8_4_ORIENTATION], ["REQ-NOPE"], APPROVAL);
    assert.equal(missing.accepted.length, 0);
    assert.deepEqual(missing.unresolved[0]?.reasons, ["Rule is not in the loaded catalog."]);

    const blank = proposeVerifiedPublications([REQ_1_8_4_ORIENTATION], ["REQ-1.8.4"], {
      actorId: "",
      actorLabel: "Dane",
      approvedAt: APPROVAL.approvedAt,
    });
    assert.equal(blank.accepted.length, 0);
    assert.ok(blank.unresolved[0]?.reasons.some((reason) => /approval/i.test(reason)));
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
  });

  it("fails the committed gate when a listed row cannot publish", () => {
    const issues = committedPublicationIssues(
      [REQ_1_8_4_ORIENTATION, REQ_1_12_EVV],
      [{ ruleId: "REQ-1.12", approval: APPROVAL }],
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.ruleId, "REQ-1.12");
    assert.ok((issues[0]?.reasons.length ?? 0) > 0);
  });

  it("prints a one-row snippet, not a bulk fill", () => {
    const snippet = formatVerifiedPublicationSnippet({
      ruleId: "REQ-1.8.4",
      approval: APPROVAL,
    });
    assert.match(snippet, /REQ-1\.8\.4/);
    assert.doesNotMatch(snippet, /REQ-1\.12/);
  });
});
