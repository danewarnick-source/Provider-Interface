import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedCodesFor,
  assignmentCodes,
  assignmentCoversCode,
  buildAssignmentMap,
  importAssignmentCodes,
  normalizeServiceCodes,
  resolveStaffClientCodes,
  uncoveredCodes,
  withCodeAdded,
  withCodeRemoved,
  caseloadCardActions,
  caseloadDailyNoteLabel,
  caseloadTimeClockLabel,
  clientAuthorizedCodes,
  defaultCaseloadCode,
  firstClockableCode,
  hasHhsCode,
  hasHostHomeDailyCode,
  hostHomeDailyNoteCode,
  isDualHhsAndClockable,
  isHostHomeDailyNoteCard,
  isHostHomeOnlyAssignment,
  stackDualCaseloadActions,
  type AssignmentMap,
} from "./assignment-codes.ts";

describe("clientAuthorizedCodes", () => {
  it("uses authorized_dspd_codes when job_code is empty (Stephen / SLH)", () => {
    assert.deepEqual(clientAuthorizedCodes({ job_code: null, authorized_dspd_codes: ["SLH"] }), [
      "SLH",
    ]);
    assert.deepEqual(clientAuthorizedCodes({ job_code: [], authorized_dspd_codes: ["SLH"] }), [
      "SLH",
    ]);
  });

  it("unions authorized + job_code without dupes", () => {
    assert.deepEqual(
      clientAuthorizedCodes({
        authorized_dspd_codes: ["SLH", "DSI"],
        job_code: ["dsi", "HHS"],
      }),
      ["SLH", "DSI", "HHS"],
    );
  });
});

describe("allowedCodesFor — assigned ∩ authorized, never all", () => {
  it("returns [] while assignments are still loading (map undefined)", () => {
    assert.deepEqual(allowedCodesFor(undefined, "client-stephen", ["SLH", "DSI"]), []);
  });

  it("returns [] when the staff has no assignment row", () => {
    const map: AssignmentMap = new Map();
    assert.deepEqual(allowedCodesFor(map, "client-stephen", ["SLH"]), []);
  });

  it("returns [] for an empty assignment set — empty never means all", () => {
    const map: AssignmentMap = new Map([["client-stephen", new Set<string>()]]);
    assert.deepEqual(allowedCodesFor(map, "client-stephen", ["SLH"]), []);
  });

  it("restricts to the explicit list", () => {
    const map: AssignmentMap = new Map([["client-stephen", new Set(["DSI"])]]);
    assert.deepEqual(allowedCodesFor(map, "client-stephen", ["SLH", "DSI"]), ["DSI"]);
  });

  it("drops assigned codes the client is no longer authorized for", () => {
    const map: AssignmentMap = new Map([["client-stephen", new Set(["DSI", "SLH"])]]);
    const clientCodes = clientAuthorizedCodes({ job_code: null, authorized_dspd_codes: ["SLH"] });
    assert.deepEqual(allowedCodesFor(map, "client-stephen", clientCodes), ["SLH"]);
  });

  it("does not grant a newly authorized code nobody assigned", () => {
    const map: AssignmentMap = new Map([["client-stephen", new Set(["SLH"])]]);
    assert.deepEqual(allowedCodesFor(map, "client-stephen", ["SLH", "SEI"]), ["SLH"]);
  });

  it("compares case-insensitively", () => {
    const map: AssignmentMap = new Map([["c", new Set(["DSI"])]]);
    assert.deepEqual(allowedCodesFor(map, "c", [" dsi "]), ["DSI"]);
  });
});

describe("buildAssignmentMap — use-my-assignments rows", () => {
  it("null or empty service_codes contribute nothing", () => {
    const map = buildAssignmentMap([
      { client_id: "a", service_codes: null },
      { client_id: "b", service_codes: [] },
      { client_id: "c", service_codes: ["slh"] },
    ]);
    assert.equal(map.has("a"), false);
    assert.equal(map.has("b"), false);
    assert.deepEqual([...map.get("c")!], ["SLH"]);
  });

  it("merges codes across duplicate rows for one client", () => {
    const map = buildAssignmentMap([
      { client_id: "a", service_codes: ["DSI"] },
      { client_id: "a", service_codes: null },
      { client_id: "a", service_codes: ["HHS", "dsi"] },
    ]);
    assert.deepEqual([...map.get("a")!].sort(), ["DSI", "HHS"]);
  });
});

describe("explicit assignment code helpers", () => {
  it("normalizeServiceCodes trims, upper-cases, de-dupes, drops blanks", () => {
    assert.deepEqual(normalizeServiceCodes([" dsi", "DSI", "", null, "hhs"]), ["DSI", "HHS"]);
    assert.deepEqual(normalizeServiceCodes(null), []);
  });

  it("assignmentCodes treats NULL as no codes", () => {
    assert.deepEqual(assignmentCodes(null), []);
    assert.deepEqual(assignmentCodes([]), []);
  });

  it("assignmentCoversCode never covers on NULL / []", () => {
    assert.equal(assignmentCoversCode(null, "HHS"), false);
    assert.equal(assignmentCoversCode([], "HHS"), false);
    assert.equal(assignmentCoversCode(["HHS"], "hhs"), true);
    assert.equal(assignmentCoversCode(["HHS"], "DSI"), false);
  });

  it("withCodeAdded appends without collapsing to all", () => {
    assert.deepEqual(withCodeAdded(["DSI"], "HHS"), ["DSI", "HHS"]);
    assert.deepEqual(withCodeAdded(["DSI"], "dsi"), ["DSI"]);
    assert.deepEqual(withCodeAdded(null, "HHS"), ["HHS"]);
  });

  it("withCodeRemoved drops the code; [] means delete the row", () => {
    assert.deepEqual(withCodeRemoved(["DSI", "HHS"], "hhs"), ["DSI"]);
    assert.deepEqual(withCodeRemoved(["DSI"], "DSI"), []);
    assert.deepEqual(withCodeRemoved(null, "DSI"), []);
  });

  it("resolveStaffClientCodes requires codes ⊆ authorized", () => {
    assert.deepEqual(resolveStaffClientCodes(["dsi", "HHS"], ["HHS", "DSI"]), ["DSI", "HHS"]);
    assert.deepEqual(resolveStaffClientCodes([], ["HHS"]), []);
    assert.throws(
      () => resolveStaffClientCodes(["SLH"], ["HHS"]),
      /not authorized for this client: SLH/,
    );
    assert.throws(() => resolveStaffClientCodes(["HHS"], []), /not authorized/);
    assert.throws(() => resolveStaffClientCodes([" ", ""], ["HHS"]), /at least one/);
  });

  it("importAssignmentCodes: source codes ∩ authorized, else all authorized, explicitly", () => {
    assert.deepEqual(importAssignmentCodes(null, ["HHS", "DSI"]), ["HHS", "DSI"]);
    assert.deepEqual(importAssignmentCodes([], ["HHS"]), ["HHS"]);
    assert.deepEqual(importAssignmentCodes(["dsi", "SLH"], ["HHS", "DSI"]), ["DSI"]);
    assert.deepEqual(importAssignmentCodes(["SLH"], ["HHS"]), []);
    assert.deepEqual(importAssignmentCodes(null, []), []);
  });

  it("uncoveredCodes lists authorized codes with no staff (NULL rows cover nothing)", () => {
    assert.deepEqual(
      uncoveredCodes(["HHS", "DSI", "SEI"], [{ service_codes: ["DSI"] }, { service_codes: null }]),
      ["HHS", "SEI"],
    );
  });
});

describe("defaultCaseloadCode — do not invent SEI", () => {
  it("uses the first assigned code", () => {
    assert.equal(defaultCaseloadCode(["HHS", "DSI"]), "HHS");
  });

  it("does not fall back to SEI (or any other code) when none are assigned", () => {
    assert.equal(defaultCaseloadCode([]), "");
    assert.notEqual(defaultCaseloadCode([]), "SEI");
  });
});

describe("host-home daily assignment", () => {
  it("treats HHS as host-home daily", () => {
    assert.equal(hasHostHomeDailyCode(["HHS"]), true);
    assert.equal(isHostHomeOnlyAssignment(["HHS"]), true);
  });

  it("does not treat mixed HHS + clockable as host-only", () => {
    assert.equal(hasHostHomeDailyCode(["HHS", "DSI"]), true);
    assert.equal(isHostHomeOnlyAssignment(["HHS", "DSI"]), false);
  });

  it("accepts an AssignmentMap Set; empty is not host-home", () => {
    assert.equal(isHostHomeOnlyAssignment(new Set(["HHS", "PPS"])), true);
    assert.equal(isHostHomeOnlyAssignment(new Set<string>()), false);
    assert.equal(isHostHomeOnlyAssignment(null), false);
  });

  it("treats clockable-only as not host-home", () => {
    assert.equal(hasHostHomeDailyCode(["SLH"]), false);
    assert.equal(isHostHomeOnlyAssignment(["SLH"]), false);
  });

  it("flags HHS + DSI as dual codes on file — not as punch-on-host-home", () => {
    assert.equal(hasHhsCode(["HHS", "DSI"]), true);
    assert.equal(firstClockableCode(["HHS", "DSI"]), "DSI");
    assert.equal(isDualHhsAndClockable(["HHS", "DSI"]), true);
    assert.equal(isDualHhsAndClockable(["HHS"]), false);
    assert.equal(isDualHhsAndClockable(["DSI"]), false);
    assert.equal(isDualHhsAndClockable(["HHS", "SLH", "SEI"]), true);
  });

  it("treats Tommy-style HHS + DSI/SEI/SLH with no clockable shift today as host-home only", () => {
    const tommy = ["DSI", "HHS", "SEI", "SLH"];
    assert.equal(isDualHhsAndClockable(tommy), true);
    assert.equal(
      isHostHomeDailyNoteCard({ codes: tommy, todayJobCode: null, isOnTheClock: false }),
      true,
    );
    assert.deepEqual(caseloadCardActions({ codes: tommy, isOnTheClock: false }), {
      showDailyNote: true,
      showTimeClock: false,
    });
    assert.equal(
      stackDualCaseloadActions({
        codes: tommy,
        isHostHomeDailyNoteCard: true,
        hasClockableShiftToday: false,
        isOnTheClock: false,
      }),
      false,
    );
  });

  it("HHS+DSI on file, no open punch → daily note only (even with a scheduled DSI shift)", () => {
    const codes = ["HHS", "DSI"];
    assert.equal(
      isHostHomeDailyNoteCard({ codes, todayJobCode: "DSI", isOnTheClock: false }),
      true,
    );
    assert.deepEqual(
      caseloadCardActions({ codes, isOnTheClock: false, hasClockableShiftToday: true }),
      { showDailyNote: true, showTimeClock: false },
    );
    assert.equal(
      stackDualCaseloadActions({
        codes,
        isHostHomeDailyNoteCard: true,
        hasClockableShiftToday: true,
        isOnTheClock: false,
      }),
      false,
    );
    assert.equal(caseloadDailyNoteLabel({ code: "HHS" }), "Open daily note (HHS)");
  });

  it("HHS + open DSI punch → daily note (HHS) + open time clock (DSI)", () => {
    const codes = ["HHS", "DSI"];
    assert.equal(
      isHostHomeDailyNoteCard({ codes, todayJobCode: "DSI", isOnTheClock: true }),
      false,
    );
    assert.deepEqual(caseloadCardActions({ codes, isOnTheClock: true }), {
      showDailyNote: true,
      showTimeClock: true,
    });
    assert.equal(
      stackDualCaseloadActions({
        codes,
        isHostHomeDailyNoteCard: false,
        hasClockableShiftToday: false,
        isOnTheClock: true,
      }),
      true,
    );
    assert.equal(hostHomeDailyNoteCode(codes), "HHS");
    assert.equal(caseloadDailyNoteLabel({ code: "HHS" }), "Open daily note (HHS)");
    assert.equal(
      caseloadDailyNoteLabel({ code: "HHS", alreadyDoneToday: true }),
      "Complete daily note (HHS)",
    );
    assert.equal(caseloadTimeClockLabel("DSI"), "End shift (DSI)");
  });

  it("clockable-only with no open punch → no Open Punch pad on the card", () => {
    assert.equal(
      isHostHomeDailyNoteCard({ codes: ["DSI"], todayJobCode: "DSI", isOnTheClock: false }),
      false,
    );
    assert.deepEqual(
      caseloadCardActions({
        codes: ["DSI"],
        isOnTheClock: false,
        hasClockableShiftToday: true,
      }),
      { showDailyNote: false, showTimeClock: false },
    );
    assert.equal(
      stackDualCaseloadActions({
        codes: ["DSI"],
        isHostHomeDailyNoteCard: false,
        hasClockableShiftToday: true,
        isOnTheClock: false,
      }),
      false,
    );
  });

  it("clockable-only with an open punch → time clock only, labeled with that punch code", () => {
    assert.deepEqual(caseloadCardActions({ codes: ["SLH"], isOnTheClock: true }), {
      showDailyNote: false,
      showTimeClock: true,
    });
    assert.equal(caseloadTimeClockLabel("SLH"), "End shift (SLH)");
  });

  it("never stacks a start-punch button onto a host-home daily-note card", () => {
    assert.equal(
      stackDualCaseloadActions({
        codes: ["HHS", "DSI"],
        isHostHomeDailyNoteCard: true,
        hasClockableShiftToday: false,
        isOnTheClock: false,
      }),
      false,
    );
    assert.equal(
      stackDualCaseloadActions({
        codes: ["HHS", "DSI"],
        isHostHomeDailyNoteCard: true,
        hasClockableShiftToday: true,
        isOnTheClock: false,
      }),
      false,
    );
  });

  it("leaves HHS-only as daily note only until they are on the clock", () => {
    assert.equal(
      isHostHomeDailyNoteCard({ codes: ["HHS"], todayJobCode: "HHS", isOnTheClock: false }),
      true,
    );
    assert.deepEqual(caseloadCardActions({ codes: ["HHS"], isOnTheClock: false }), {
      showDailyNote: true,
      showTimeClock: false,
    });
    assert.equal(
      stackDualCaseloadActions({
        codes: ["HHS"],
        isHostHomeDailyNoteCard: true,
        hasClockableShiftToday: false,
        isOnTheClock: false,
      }),
      false,
    );
    assert.deepEqual(caseloadCardActions({ codes: ["HHS", "SEI"], isOnTheClock: true }), {
      showDailyNote: true,
      showTimeClock: true,
    });
  });

  it("hides the HHS daily-note CTA after today's note is filed", () => {
    assert.deepEqual(
      caseloadCardActions({
        codes: ["HHS"],
        isOnTheClock: false,
        dailyNoteDoneToday: true,
      }),
      { showDailyNote: false, showTimeClock: false },
    );
    assert.deepEqual(
      caseloadCardActions({
        codes: ["HHS", "SLH"],
        isOnTheClock: true,
        dailyNoteDoneToday: true,
      }),
      { showDailyNote: false, showTimeClock: true },
    );
  });
});

describe("stackDualCaseloadActions with AssignmentMap values", () => {
  it("accepts a Set and stacks when on the clock", () => {
    assert.equal(
      stackDualCaseloadActions({
        codes: new Set(["HHS", "DSI"]),
        isHostHomeDailyNoteCard: false,
        hasClockableShiftToday: true,
        isOnTheClock: true,
      }),
      true,
    );
  });

  it("no assigned codes never stacks — even on the clock", () => {
    assert.equal(
      stackDualCaseloadActions({
        codes: new Set<string>(),
        isHostHomeDailyNoteCard: false,
        hasClockableShiftToday: true,
        isOnTheClock: true,
      }),
      false,
    );
  });
});
