import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parsePcsp, readPcspPages } from "./parser.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";
import type { LayoutPage } from "./layout.ts";

const expected = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixture/sample-expected.json", import.meta.url)), "utf8"),
);

test("made-up PCSP reads to exactly the expected plan", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY))), expected);
});

test("sections are returned for the Nectar fallback", () => {
  const { sections } = readPcspPages(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
  const names = sections.map((s) => s.name);
  assert.ok(names.includes("Plan Budget"));
  assert.ok(names.includes("Goals and Supports"));
});

test("no approved codes set up: codes aren't checked, one note says so", () => {
  const res = parsePcsp(SAMPLE_PCSP_PAGES, { ...SAMPLE_AGENCY, agencyCodes: [] });
  assert.equal(res.issues.filter((i) => /approved codes/.test(i.message)).length, 1);
});

test("a code not approved for the agency is an error on its page", () => {
  const res = parsePcsp(SAMPLE_PCSP_PAGES, { ...SAMPLE_AGENCY, agencyCodes: ["DSI", "HHS"] });
  assert.ok(res.issues.some((i) => i.level === "error" && i.page === 4 && /Code SEI/.test(i.message)));
  assert.ok(res.issues.some((i) => i.level === "error" && /Budget line SEI/.test(i.message)));
});

test("a fully overlapped page is skipped, and an empty PCSP reports missing dates and goals", () => {
  const pages: LayoutPage[] = [{ index: 1, lines: [{ y: 700, text: "Some text" }, { y: 20, text: "Plan Activated: Strengths: x" }] }];
  const res = parsePcsp(pages, SAMPLE_AGENCY);
  assert.deepEqual(res.issues.map((i) => i.message.slice(0, 30)), [
    "This page's text is printed on",
    "Plan start or end date not fou",
    "Plan activation date not found",
    "No goals found.",
  ]);
});
