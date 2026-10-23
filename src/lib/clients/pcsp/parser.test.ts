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
    "Page 1 couldn't be read at all",
    "Plan start or end date not fou",
    "Plan activation date not found",
    "No goals found.",
  ]);
  assert.equal(res.issues[0].message, "Page 1 couldn't be read at all. Open page 1 of the PCSP and add anything from it by hand.");
});

test("a partly overlapped page says which page to check", () => {
  const res = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
  const overlap = res.issues.find((i) => i.page === 5 && /print cleanly/.test(i.message));
  assert.equal(
    overlap?.message,
    "Page 5 didn't print cleanly in this PDF, so part of it couldn't be read. Open page 5 of the PCSP and check that the goals and supports from that page are listed below.",
  );
});

test("the standard 'now obsolete' lines are ignored; a line naming a code warns once", () => {
  const res = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
  const obsolete = res.issues.filter((i) => /obsolete/i.test(i.message));
  assert.deepEqual(obsolete.map((i) => i.message), [
    "The PCSP says RP4 is obsolete. Check whether this client still has RP4.",
  ]);
});

test("purchased services: one space or a dash between code and name, and a page-break continuation", () => {
  const res = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
  assert.deepEqual(
    res.purchasedServices.map((p) => [p.code, p.name, p.units]),
    [
      ["DSI", "Day Supports Individual", 2000],
      ["HHS", "Host Home Support", 365],
      ["SLN", "Supported Living Natural", 400],
      ["SEI", "Supported Employment Individual", 1040],
      ["", "", 50],
    ],
  );
  // Only the entry that belongs to no coded service is an error.
  const missing = res.issues.filter((i) => /without its code/.test(i.message));
  assert.deepEqual(missing.map((i) => i.page), [7]);
});

test("a service reprinted in full on the next page is not a code-less service", () => {
  const svc = (index: number, lines: string[]): LayoutPage => ({
    index, lines: lines.map((text, i) => ({ y: 700 - i * 12, text })),
  });
  const block = ["    Type:               15 Minutes", "    Amount:             2000 Units", "    Duration:           09/01/2026 - 08/31/2027"];
  const pages = [
    svc(1, ["DSPD Purchased Services", "  DSI   Day Supports Individual", ...block]),
    svc(2, ["DSPD Purchased Services", ...block]),
  ];
  const res = parsePcsp(pages, SAMPLE_AGENCY);
  assert.deepEqual(res.purchasedServices.map((p) => p.code), ["DSI"]);
  assert.ok(!res.issues.some((i) => /without its code/.test(i.message)));
});

test("a non-goal support paid to the agency keeps its code", () => {
  const res = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
  assert.deepEqual(res.nonGoalSupports.map((s) => s.ourCodes), [[], ["HHS"], []]);
});
