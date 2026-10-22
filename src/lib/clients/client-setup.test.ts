import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SETUP_STEPS,
  nextSetupStep,
  previousSetupStep,
  setupBannerText,
  setupSummary,
  stepCounter,
} from "./client-setup.ts";
import { CLIENT_SECTION_LABEL } from "./profile-sections.ts";

const label = (s: keyof typeof CLIENT_SECTION_LABEL) => CLIENT_SECTION_LABEL[s];

describe("setup steps", () => {
  it("walk About → Contacts → Health → Team → Behavior → Client file", () => {
    assert.deepEqual([...SETUP_STEPS], ["about", "contacts", "health", "team", "behavior", "file"]);
    assert.equal(nextSetupStep("about"), "contacts");
    assert.equal(nextSetupStep("file"), null);
    assert.equal(previousSetupStep("about"), null);
    assert.equal(previousSetupStep("team"), "health");
    assert.equal(stepCounter("health"), "Step 3 of 6");
  });
});

describe("setupSummary", () => {
  it("says what's set up and links each skipped step to where it's added later", () => {
    const lines = setupSummary({ about: "done", health: "skipped", team: "done" }, label);
    assert.equal(lines.length, 6);
    assert.deepEqual(
      lines.map((l) => [l.step, l.done]),
      [
        ["about", true],
        ["contacts", false],
        ["health", false],
        ["team", true],
        ["behavior", false],
        ["file", false],
      ],
    );
    const health = lines.find((l) => l.step === "health")!;
    assert.equal(health.text, "Skipped: add it later in Health");
    assert.equal(health.linkLabel, "Open Health");
    assert.equal(lines.find((l) => l.step === "behavior")!.section, "plans");
    assert.equal(lines[0].linkLabel, null);
  });
});

describe("setupBannerText", () => {
  it("names the client", () => {
    assert.equal(setupBannerText("Sam ").title, "Finish setting up Sam");
    assert.equal(setupBannerText("").title, "Finish setting up this client");
  });
});
