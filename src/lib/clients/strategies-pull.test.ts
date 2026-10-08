import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulletInDocument,
  cleanBullet,
  normalizeForMatch,
  parsePullReply,
  pullUserPrompt,
} from "./strategies-pull.ts";
import type { StrategySupport } from "./support-strategies.ts";

const supports: StrategySupport[] = [
  {
    supportId: "a",
    goal: "Cook a meal",
    support: "Coach recipe steps",
    details: "",
    codes: ["DSI"],
  },
  { supportId: "b", goal: "Work", support: "Job coaching", details: "", codes: ["SEI"] },
];

const DOC = `Support Strategies — Pat Example
Cooking: • Staff read each recipe step aloud with Pat.
2. Staff let Pat choose the meal from the pic-
ture binder each Sunday.
Employment: none listed yet.`;

describe("pulling strategies from an uploaded document", () => {
  it("matches near-verbatim: case, punctuation, spacing and line-break hyphens don't matter", () => {
    const doc = normalizeForMatch(DOC);
    assert.equal(bulletInDocument("staff read each recipe step aloud with Pat", doc), true);
    assert.equal(
      bulletInDocument("Staff let Pat choose the meal from the picture binder each Sunday.", doc),
      true,
    );
    assert.equal(bulletInDocument("Staff cook the meal for Pat.", doc), false);
    assert.equal(bulletInDocument("Staff", doc), false);
  });

  it("strips bullet markers", () => {
    assert.equal(cleanBullet("• Staff  read\nsteps"), "Staff read steps");
    assert.equal(cleanBullet("2) Staff read"), "Staff read");
    assert.equal(cleanBullet("- Staff read"), "Staff read");
  });

  it("keeps only bullets found in the document and names supports left blank", () => {
    const reply = JSON.stringify({
      strategies: [
        {
          n: 1,
          bullets: [
            "• Staff read each recipe step aloud with Pat.",
            "Staff praise Pat for every step.",
            "Staff read each recipe step aloud with Pat.",
          ],
        },
        { n: 2, bullets: ["Staff fade job coaching over time."] },
      ],
    });
    const out = parsePullReply(reply, supports, DOC);
    assert.deepEqual(out.drafts.get("a"), ["Staff read each recipe step aloud with Pat."]);
    assert.equal(out.drafts.has("b"), false);
    assert.deepEqual(
      out.blank.map((s) => s.supportId),
      ["b"],
    );
    assert.equal(out.dropped, 2);
  });

  it("leaves every support blank on a bad reply", () => {
    const out = parsePullReply("not json", supports, DOC);
    assert.equal(out.drafts.size, 0);
    assert.equal(out.blank.length, 2);
  });

  it("numbers the supports and includes the document text", () => {
    const p = pullUserPrompt(supports, DOC);
    assert.match(p, /1\. Goal: Cook a meal/);
    assert.match(p, /2\. Goal: Work/);
    assert.match(p, /STRATEGIES DOCUMENT TEXT:\nSupport Strategies/);
  });
});
