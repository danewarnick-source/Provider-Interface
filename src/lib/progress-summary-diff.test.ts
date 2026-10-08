import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wordDiff } from "./progress-summary-diff.ts";

const join = (parts: ReturnType<typeof wordDiff>, kinds: string[]) =>
  parts
    .filter((p) => kinds.includes(p.kind))
    .map((p) => p.text)
    .join("");

describe("wordDiff", () => {
  it("(c) marks added and removed words", () => {
    const parts = wordDiff("Joby did laundry on Monday.", "Joby completed laundry on Monday.");
    const added = parts.filter((p) => p.kind === "add").map((p) => p.text.trim());
    const removed = parts.filter((p) => p.kind === "del").map((p) => p.text.trim());
    assert.deepEqual(removed, ["did"]);
    assert.deepEqual(added, ["completed"]);
  });
  it("same + add reads back the rewrite; same + del reads back the original", () => {
    const before = "She cooked pasta  and\nwashed dishes.";
    const after = "She cooked pasta, then washed all the dishes.";
    const parts = wordDiff(before, after);
    assert.equal(join(parts, ["same", "add"]), after);
    assert.equal(join(parts, ["same", "del"]), before);
  });
  it("identical text is all 'same'; empty sides are all add or del", () => {
    assert.deepEqual(wordDiff("a b", "a b"), [{ kind: "same", text: "a b" }]);
    assert.deepEqual(wordDiff("", "new text"), [{ kind: "add", text: "new text" }]);
    assert.deepEqual(wordDiff("old text", ""), [{ kind: "del", text: "old text" }]);
    assert.deepEqual(wordDiff("", ""), []);
  });
  it("very long texts fall back to one replacement instead of hanging", () => {
    const long = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(" ");
    const parts = wordDiff(long, `${long} extra`.replace(/w1 /g, "x "));
    assert.deepEqual(
      parts.map((p) => p.kind),
      ["del", "add"],
    );
  });
});
