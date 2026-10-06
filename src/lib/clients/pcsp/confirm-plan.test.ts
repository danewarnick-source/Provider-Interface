import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcsp } from "./parser.ts";
import { proposeCarryOver } from "./carry-over.ts";
import { initialReview } from "./review.ts";
import {
  aboutMeLines, billingRows, blockHeading, carriedFrom, confirmProblems, contactRows, mergePcspBlock, riskLines,
} from "./confirm-plan.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

const parse = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
const review = () => initialReview(parse, proposeCarryOver(parse.goals.map((g) => g.goal), [{ id: "g-cook", goal_text: parse.goals[0].goal }], []));
const ids = { organizationId: "org-1", clientId: "client-1" };

test("a clean review has no problems; missing dates, codes and goals are caught", () => {
  assert.deepEqual(confirmProblems(review()), []);
  const r = review();
  r.plan.end = null;
  r.budget[0].code = "";
  r.budget[1].code = "SEI";
  r.goals.forEach((g) => (g.include = false));
  assert.deepEqual(confirmProblems(r), [
    "Enter the plan year's start and end dates.",
    "Keep at least one goal.",
    "Every kept budget line needs a service code (like DSI).",
    "SEI is listed twice in the budget. Keep one line.",
  ]);
});

test("authorization rows come from our kept budget lines", () => {
  const r = review();
  r.budget[1].include = false;
  const rows = billingRows(r, { ...ids, documentId: "doc-1", now: "2026-08-21T00:00:00Z" });
  assert.deepEqual(rows.map((x) => [x.service_code, x.unit_type, x.rate_per_unit, x.annual_unit_authorization, x.monthly_max_units]), [
    ["DSI", "Q", 8.5, 2000, 200],
    ["SEI", "Q", 9.25, 1040, 100],
  ]);
  assert.equal(rows[0].service_start_date, "2026-09-01");
  assert.equal(rows[0].rate_source, "pcsp");
  assert.equal(rows[0].rate_source_document_id, "doc-1");
});

test("the From PCSP block replaces the old one and keeps typed text", () => {
  const first = mergePcspBlock("Allergic to cats.", "2025", ["Old risk."]);
  assert.equal(first, "Allergic to cats.\n\nFrom PCSP 2025:\n- Old risk.");
  assert.equal(mergePcspBlock(first, "2026", ["New risk."]), "Allergic to cats.\n\nFrom PCSP 2026:\n- New risk.");
  assert.equal(mergePcspBlock(first, "2026", []), "Allergic to cats.");
  assert.equal(mergePcspBlock(null, "2026", []), null);
});

test("risk and about-me lines read plainly", () => {
  const r = review();
  assert.deepEqual(riskLines(r), [
    "Choking on large bites of food. Response: Cut food into small pieces. Response time: Immediate. Staff watch during all meals.",
  ]);
  assert.deepEqual(aboutMeLines(r), [
    "Healthy Living · Likes outdoors: Pat enjoys gardening and music. Morning walks help. (from Pat)",
    "Safety & Security · Does not like: Loud crowded rooms. (from Guardian)",
  ]);
  assert.equal(blockHeading(r), "2026-09-01 – 2027-08-31");
});

test("other-provider contacts skip names the client already has", () => {
  const r = review();
  assert.deepEqual(contactRows(r, { ...ids, existingNames: [], startSort: 4 }), [{
    organization_id: "org-1", client_id: "client-1", role: "other_provider", name: "Sample Behavior Group Inc",
    company: "Sample Behavior Group Inc", notes: "From PCSP · BC2 · Behavior support plan for Pat at home.", sort: 4,
  }]);
  assert.deepEqual(contactRows(r, { ...ids, existingNames: ["sample behavior group inc"], startSort: 0 }), []);
});

test("continuing goals carry history only from a goal on the current plan", () => {
  const [cook, job] = review().goals;
  assert.equal(carriedFrom(cook, new Set(["g-cook"])), "g-cook");
  assert.equal(carriedFrom(cook, new Set()), null);
  assert.equal(carriedFrom(job, new Set(["g-cook"])), null);
});
