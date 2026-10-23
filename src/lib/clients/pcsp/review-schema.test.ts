import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcsp } from "./parser.ts";
import { proposeCarryOver } from "./carry-over.ts";
import { initialReview } from "./review.ts";
import { reviewedPcspSchema } from "./review-schema.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

const parse = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
const review = initialReview(parse, proposeCarryOver(parse.goals.map((g) => g.goal), [], []));

test("the review built from the sample PCSP passes the confirm schema unchanged", () => {
  assert.deepEqual(reviewedPcspSchema.parse(review), review);
});

test("bad unit types and dates are refused", () => {
  const bad = structuredClone(review);
  bad.budget[0].unitType = "weekly";
  assert.throws(() => reviewedPcspSchema.parse(bad));
  const badDate = structuredClone(review);
  badDate.plan.start = "09/01/2026";
  assert.throws(() => reviewedPcspSchema.parse(badDate));
});
