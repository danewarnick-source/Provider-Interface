import { test } from "node:test";
import assert from "node:assert/strict";
import { RATIO_CHOICES, ratioChoice, ratioText } from "./ratio.ts";

test("the card offers 1:1, 1:2, 1:3, 1:4 and 2:1", () => {
  assert.deepEqual([...RATIO_CHOICES], ["1:1", "1:2", "1:3", "1:4", "2:1"]);
});

test("a stored ratio reads back as its choice, spaces ignored", () => {
  assert.equal(ratioChoice("1:2"), "1:2");
  assert.equal(ratioChoice(" 2 : 1 "), "2:1");
});

test("empty or unknown ratios are not a choice", () => {
  assert.equal(ratioChoice(null), null);
  assert.equal(ratioChoice(""), null);
  assert.equal(ratioChoice("1:6"), null);
  assert.equal(ratioChoice("one to one"), null);
});

test("the card shows Not set, the choice, or the odd stored value as is", () => {
  assert.equal(ratioText(null), "Not set");
  assert.equal(ratioText("  "), "Not set");
  assert.equal(ratioText("1:3"), "1:3");
  assert.equal(ratioText("1:6"), "1:6");
});
