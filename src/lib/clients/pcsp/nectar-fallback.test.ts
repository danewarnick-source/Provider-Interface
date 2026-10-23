import { test } from "node:test";
import assert from "node:assert/strict";
import { readPcspPages } from "./parser.ts";
import { applyFallback, fallbackMessages, sectionsNeedingHelp } from "./nectar-fallback.ts";
import type { LayoutPage } from "./layout.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

// A budget printed in a layout the reader doesn't know (made-up values).
const ODD: LayoutPage[] = [{
  index: 7,
  lines: [
    { y: 700, text: "Plan Budget" },
    { y: 688, text: "  Service DSI by Example Supports LLC" },
    { y: 676, text: "  Rate 8.50 per unit, 2000 units for the year" },
  ],
}];

test("the sample PCSP needs no help", () => {
  const { result, sections } = readPcspPages(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
  assert.deepEqual(sectionsNeedingHelp(sections, result), []);
});

test("a section with text but no rows is sent with its page numbers", () => {
  const { result, sections } = readPcspPages(ODD, SAMPLE_AGENCY);
  const help = sectionsNeedingHelp(sections, result);
  assert.deepEqual(help.map((h) => h.name), ["Plan Budget"]);
  assert.match(help[0].text, /^\[page 7\] Service DSI/);
  const [system, user] = fallbackMessages("Plan Budget", help[0].text);
  assert.match(system.content, /"quote"/);
  assert.equal(user.content, help[0].text);
});

test("only quoted values are kept; the reader flags that Nectar read the section", () => {
  const { result, sections } = readPcspPages(ODD, SAMPLE_AGENCY);
  const [help] = sectionsNeedingHelp(sections, result);
  const q = (value: string, quote: string) => ({ value, page: 7, quote });
  const used = applyFallback(result, "Plan Budget", {
    rows: [
      {
        code: q("DSI", "Service DSI"), provider: q("Example Supports LLC", "by Example Supports LLC"),
        rate: q("8.50", "Rate 8.50 per unit"), annualUnits: q("2000", "2000 units for the year"),
        total: q("17000", "invented total"), start: { value: "09/01/2026", page: 7, quote: "" },
      },
      { code: q("ZZ9", "not in the text") },
    ],
  }, help.text, SAMPLE_AGENCY.agencyName);
  assert.equal(used, 1);
  assert.deepEqual(result.budget, [{
    code: "DSI", kind: "", provider: "Example Supports LLC", ours: true, start: "", end: "",
    rate: 8.5, maxMonthlyUnits: 0, annualUnits: 2000, total: 0,
  }]);
  assert.equal(result.issues.at(-1)?.level, "warn");
  assert.match(result.issues.at(-1)?.message ?? "", /Nectar read it \(1 row\)/);
});

test("a reply with nothing usable says to enter the section by hand", () => {
  const { result } = readPcspPages(ODD, SAMPLE_AGENCY);
  assert.equal(applyFallback(result, "List of Identified Risks", { nope: true }, "x", "A"), 0);
  assert.match(result.issues.at(-1)?.message ?? "", /Enter it by hand/);
});
