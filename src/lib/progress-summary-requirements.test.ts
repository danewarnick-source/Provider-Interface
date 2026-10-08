import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  requirementLines,
  requirementsForCode,
  summaryRequirements,
} from "./progress-summary-requirements.ts";

const ids = (codes: string[]) => summaryRequirements(codes).items.map((r) => r.id);

describe("summaryRequirements — DHHS91172 summary contents", () => {
  it("quarterly codes (HHS, SLN): §1.25 items, goal progress §1.25(5)", () => {
    const r = summaryRequirements(["SLN", "HHS"]);
    assert.equal(r.cadence, "quarterly");
    assert.equal(r.goalProgress, true);
    assert.deepEqual(ids(["SLN"]), [
      "name",
      "services",
      "date_range",
      "staff_name",
      "general_summary",
      "status_response",
      "notable_events",
      "goal_progress",
    ]);
    assert.equal(r.items.find((i) => i.id === "goal_progress")?.cite, "DHHS91172 §1.25(5)");
    assert.equal(r.items.find((i) => i.id === "general_summary")?.cite, "DHHS91172 §1.25(4)");
  });
  it("SEI monthly: §30.3(4) employment activities, response, employment goals", () => {
    const r = summaryRequirements(["SEI"]);
    assert.equal(r.cadence, "monthly");
    const acts = r.items.find((i) => i.id === "employment_activities");
    assert.equal(acts?.cite, "DHHS91172 §30.3(4)(D)");
    assert.ok(acts?.detect?.test("She worked three shifts."));
    assert.equal(r.items.find((i) => i.id === "goal_progress")?.cite, "DHHS91172 §30.3(4)(F)");
  });
  it("SJD adds the weekly assessment and the USOR contact", () => {
    const r = summaryRequirements(["SJD"]);
    assert.equal(r.items.find((i) => i.id === "usor_contact")?.cite, "DHHS91172 §33.3(4)(I)");
    assert.match(
      r.items.find((i) => i.id === "weekly_assessment")?.cite ?? "",
      /§33\.3\(4\)\(G\), §33\.2\(j\)/,
    );
    assert.ok(r.items.find((i) => i.id === "usor_contact")?.detect?.test("Called USOR on 10/4"));
  });
  it("CMP/CMS cite §32.3(2); PN2 adds the Medical Care Plan status (§19.2(10))", () => {
    assert.equal(
      summaryRequirements(["CMS"]).items.find((i) => i.id === "goal_progress")?.cite,
      "DHHS91172 §32.3(2)(E)",
    );
    assert.equal(
      summaryRequirements(["PN2"]).items.find((i) => i.id === "medical_care_plan")?.cite,
      "DHHS91172 §19.2(10)",
    );
  });
  it("PBA (financial) and no-summary codes have nothing to review", () => {
    assert.deepEqual(requirementsForCode("PBA"), []);
    assert.deepEqual(requirementsForCode("RP2"), []);
    assert.deepEqual(summaryRequirements(["PBA"], "financial_statement").items, []);
  });
  it("no goal progress when every code is excluded (§1.25(5))", () => {
    const r = summaryRequirements(["ELS"]);
    assert.equal(r.goalProgress, false);
    assert.ok(!r.items.some((i) => i.id === "goal_progress"));
  });
  it("requirementLines lists only what has to be typed, with cites", () => {
    const lines = requirementLines(summaryRequirements(["SLN"]).items);
    assert.ok(lines.every((l) => /DHHS91172 §/.test(l)));
    assert.ok(!lines.some((l) => l.startsWith("[name]")));
  });
});
