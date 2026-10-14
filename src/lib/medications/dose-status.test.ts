import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDoseAlreadyCharted, isTakenStatus, passBlockReason } from "./dose-status.ts";

describe("duplicate-dose guard", () => {
  it("treats a stored 'administered' row as charted, so the dose can't be charted twice", () => {
    assert.equal(isDoseAlreadyCharted([{ status: "administered" }]), true);
  });

  it("still treats the old spellings and exception statuses as charted", () => {
    for (const status of [
      "self_administered",
      "given",
      "refused",
      "omitted",
      "missed",
      "held",
      "loa",
    ]) {
      assert.equal(isDoseAlreadyCharted([{ status }]), true, status);
    }
  });

  it("an empty history or an unknown status is not a duplicate", () => {
    assert.equal(isDoseAlreadyCharted([]), false);
    assert.equal(isDoseAlreadyCharted([{ status: null }, { status: "draft" }]), false);
  });

  it("reads taken statuses in any case", () => {
    assert.equal(isTakenStatus("ADMINISTERED"), true);
    assert.equal(isTakenStatus("refused"), false);
  });
});

describe("passBlockReason", () => {
  const med = { client_id: "c1", is_active: true, discontinued_at: null, paused_at: null };
  it("allows an active med for its own client", () => {
    assert.equal(passBlockReason(med, "c1"), null);
  });
  it("blocks another client's med, a stopped med and a paused med", () => {
    assert.match(passBlockReason(med, "c2") ?? "", /different client/);
    assert.match(passBlockReason({ ...med, is_active: false }, "c1") ?? "", /stopped/);
    assert.match(
      passBlockReason({ ...med, discontinued_at: "2026-10-01T00:00:00Z" }, "c1") ?? "",
      /stopped/,
    );
    assert.match(
      passBlockReason({ ...med, paused_at: "2026-10-01T00:00:00Z" }, "c1") ?? "",
      /paused/,
    );
  });
});
