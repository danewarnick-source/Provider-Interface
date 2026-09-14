import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REQ_1_8_4_ORIENTATION, REQ_1_12_EVV } from "./fixtures.ts";
import { canActivate, canPublish } from "./publication.ts";
import { applyVerifiedPublication, VERIFIED_PUBLICATIONS } from "./verified-publication.ts";

const APPROVAL = {
  actorId: "dane",
  actorLabel: "Dane",
  approvedAt: "2026-09-14T00:00:00.000Z",
};

describe("per-rule verified publication", () => {
  it("starts with an empty overlay — nothing is bulk-published", () => {
    assert.equal(VERIFIED_PUBLICATIONS.length, 0);
  });

  it("publishes one complete rule and leaves a gapped sibling draft", () => {
    const ok = applyVerifiedPublication(REQ_1_8_4_ORIENTATION, APPROVAL);
    assert.equal(ok.gaps.length, 0);
    assert.equal(ok.rule.publication, "published");
    assert.equal(ok.rule.lifecycle, "published");
    assert.equal(canPublish(ok.rule), true);
    assert.equal(canActivate(ok.rule), true);
    assert.equal(canActivate(REQ_1_8_4_ORIENTATION), false);

    const blocked = applyVerifiedPublication(REQ_1_12_EVV, APPROVAL);
    assert.ok(blocked.gaps.length > 0);
    assert.equal(blocked.rule.publication, "not_published");
    assert.equal(canActivate(blocked.rule), false);
  });
});
