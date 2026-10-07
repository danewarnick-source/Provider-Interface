import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIST_SHORTCUTS,
  canFixSection,
  codesCell,
  dueTone,
  nextDueText,
  readinessTag,
  unitsShortcut,
  type ListViewer,
} from "./list-display.ts";

const ENDED = { codes: ["DSI", "SEI"], endedOn: "2026-08-31" };

describe("codesCell", () => {
  it("shows active codes", () => {
    assert.deepEqual(codesCell({ codes: ["DSI"], endedCodes: null, planExpired: false }), {
      kind: "active",
      codes: ["DSI"],
    });
  });
  it("shows ended codes with the end date and opens Services while the plan is current", () => {
    assert.deepEqual(codesCell({ codes: [], endedCodes: ENDED, planExpired: false }), {
      kind: "ended",
      codes: ["DSI", "SEI"],
      status: "Ended Aug 31",
      section: "services",
    });
  });
  it("says the plan expired and opens Plans when the plan year ended too", () => {
    assert.deepEqual(codesCell({ codes: [], endedCodes: ENDED, planExpired: true }), {
      kind: "ended",
      codes: ["DSI", "SEI"],
      status: "Plan expired",
      section: "plans",
    });
  });
  it("is empty when the client never had codes", () => {
    assert.deepEqual(codesCell({ codes: [], endedCodes: null, planExpired: true }), {
      kind: "none",
    });
  });
});

describe("readinessTag", () => {
  it("says Ready to schedule, N to fix (reasons in the tooltip) or Finish setup", () => {
    assert.deepEqual(readinessTag({ kind: "client", readiness: { ready: true, missing: [] } }), {
      tone: "ok",
      text: "Ready to schedule",
    });
    assert.deepEqual(
      readinessTag({
        kind: "client",
        readiness: { ready: false, missing: ["Authorizations ended Aug 31, 2026", "x"] },
      }),
      { tone: "danger", text: "2 to fix", title: "Authorizations ended Aug 31, 2026\nx" },
    );
    assert.equal(
      readinessTag({ kind: "draft", readiness: { ready: false, missing: [] } }).text,
      "Finish setup",
    );
  });
});

describe("nextDueText and dueTone", () => {
  it("uses the Plans wording for the plan year", () => {
    const plan = { kind: "plan" as const, label: "Plan renews", date: "2026-09-01" };
    assert.equal(nextDueText({ ...plan, days: -36 }), "PCSP is 36 days overdue");
    assert.equal(nextDueText({ ...plan, days: -1 }), "PCSP is 1 day overdue");
    assert.equal(nextDueText({ ...plan, days: 12 }), "PCSP expires in 12 days");
    assert.equal(nextDueText({ ...plan, days: 0 }), "PCSP expires today");
  });
  it("keeps other items' labels with a short date or days overdue", () => {
    const s = { kind: "summary" as const, label: "Summary due", date: "2026-10-15" };
    assert.equal(nextDueText({ ...s, days: 9 }), "Summary due · Oct 15");
    assert.equal(nextDueText({ ...s, days: -3 }), "Summary due · 3 days overdue");
    assert.equal(dueTone({ ...s, days: -3 }), "overdue");
    assert.equal(dueTone({ ...s, days: 9 }), "soon");
    assert.equal(dueTone({ ...s, days: 60 }), "normal");
  });
});

describe("shortcuts", () => {
  const all: ListViewer = {
    canMedical: true,
    canBilling: true,
    canEditClients: true,
    canEditBilling: true,
    canEditTeam: true,
  };
  it("maps each empty cell to the section that fixes it", () => {
    assert.equal(LIST_SHORTCUTS.codes.section, "services");
    assert.equal(LIST_SHORTCUTS.home.section, "profile");
    assert.equal(LIST_SHORTCUTS.units.section, "services");
    assert.equal(LIST_SHORTCUTS.team.section, "team");
  });
  it("needs the section visible and editable", () => {
    assert.equal(canFixSection("services", all), true);
    assert.equal(canFixSection("services", { ...all, canBilling: false }), false);
    assert.equal(canFixSection("services", { ...all, canEditBilling: false }), false);
    assert.equal(canFixSection("profile", { ...all, canEditClients: false }), false);
    assert.equal(canFixSection("team", { ...all, canEditTeam: false }), false);
    assert.equal(canFixSection("plans", all), true);
  });
  it("offers + Add units only for an active code with no yearly units", () => {
    const u = { code: "DSI", left: 5, annual: 10, pct: 50 };
    assert.equal(unitsShortcut({ unitsLeft: null, codes: ["DSI"], needsUnits: true }), "units");
    assert.equal(unitsShortcut({ unitsLeft: null, codes: [], needsUnits: true }), null);
    assert.equal(unitsShortcut({ unitsLeft: null, codes: ["DSI"], needsUnits: false }), null);
    assert.equal(unitsShortcut({ unitsLeft: u, codes: ["DSI"], needsUnits: true }), null);
  });
});
