import { test } from "node:test";
import assert from "node:assert/strict";
import { agencyKey, ourAgencyMatcher } from "./agency-match.ts";
import { parsePcsp } from "./parser.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

test("agency names compare without case, punctuation or LLC/Inc", () => {
  assert.equal(agencyKey("Example Supports, LLC"), "EXAMPLESUPPORTS");
  assert.equal(agencyKey("EXAMPLE SUPPORTS L.L.C."), "EXAMPLESUPPORTS");
  assert.equal(agencyKey("example supports inc."), "EXAMPLESUPPORTS");
  assert.equal(agencyKey("The Example Supports Co"), "EXAMPLESUPPORTS");
  assert.equal(agencyKey("Pat's Care & Support, Incorporated"), "PATSCAREANDSUPPORT");
  assert.equal(agencyKey("  "), "");
});

test("a provider matches our legal name however USTEPS prints it", () => {
  const ours = ourAgencyMatcher("Example Supports, LLC");
  for (const printed of [
    "Example Supports LLC",
    "EXAMPLE SUPPORTS, L.L.C.",
    "example supports",
    "Example Supports, Inc.",
    "Example-Supports",
    "ExampleSupports",
    "Example Supports of Utah LLC",
  ]) {
    assert.ok(ours(printed), printed);
  }
});

test("other agencies and single shared words don't match", () => {
  const ours = ourAgencyMatcher("Example Supports, LLC");
  for (const other of ["Sample Behavior Group", "Supports", "Examples Supported LLC", "", "LLC"]) {
    assert.equal(ours(other), false, other);
  }
  const short = ourAgencyMatcher("ABC");
  assert.ok(short("ABC Inc."));
  assert.ok(short("ABC Care Services"));
  assert.equal(short("ABCD Home Care"), false);
});

test("the name the agency goes by also counts as ours", () => {
  const ours = ourAgencyMatcher(["Example Holdings, LLC", "Example Supports"]);
  assert.ok(ours("EXAMPLE SUPPORTS LLC"));
  assert.ok(ours("Example Holdings"));
  assert.equal(ours("Sample Coordination Co"), false);
  assert.equal(ourAgencyMatcher([])("Example Supports"), false);
});

test("the reader finds our codes with the legal name typed differently", () => {
  const codes = (agencyName: string, otherNames?: string[]) =>
    parsePcsp(SAMPLE_PCSP_PAGES, { ...SAMPLE_AGENCY, agencyName, otherNames })
      .budget.filter((b) => b.ours)
      .map((b) => b.code);
  const expected = codes(SAMPLE_AGENCY.agencyName);
  assert.ok(expected.length > 0);
  assert.deepEqual(codes("EXAMPLE SUPPORTS L.L.C."), expected);
  assert.deepEqual(codes("example supports, inc"), expected);
  assert.deepEqual(codes("Example Holdings LLC"), []);
  assert.deepEqual(codes("Example Holdings LLC", ["Example Supports"]), expected);
});
