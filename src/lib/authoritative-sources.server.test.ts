import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AUTH_KINDS, stripHtmlToText } from "./authoritative-sources.server.ts";

describe("authoritative-sources.server (N2)", () => {
  it("keeps the source kinds the Knowledge base offers", () => {
    assert.deepEqual(
      [...AUTH_KINDS],
      [
        "state_sow",
        "provider_contract",
        "dspd_requirement",
        "dhs_requirement",
        "public_record",
        "tool_template",
        "provider_policy",
        "other",
      ],
    );
  });

  it("turns a captured web page into readable text without scripts, styles or comments", () => {
    const html =
      "<html><head><title> Rule page </title><style>p{color:red}</style></head><body>" +
      "<script>track()</script><p>First &amp; second</p><div>Line<br/>two</div><!-- note --></body></html>";
    assert.deepEqual(stripHtmlToText(html), {
      title: "Rule page",
      text: "Rule page First & second\n Line\ntwo",
    });
    assert.deepEqual(stripHtmlToText("<p>no title</p>"), { title: null, text: "no title" });
  });

  it("holds no prompts or extraction code now that the requirements pipeline is gone", () => {
    const src = readFileSync(new URL("./authoritative-sources.server.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /ai-bedrock|gatewayFetch|SYSTEM_PROMPT|extract|RateLimitError/);
    assert.ok(src.split("\n").length <= 300);
  });
});
