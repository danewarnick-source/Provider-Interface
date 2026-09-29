import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  REMOVED_FROM_CASELOAD_REASON,
  addClientToDraft,
  addableClients,
  caseloadChanges,
  caseloadFactsFor,
  hasCaseloadChanges,
  newEvidenceSuggestionKeys,
  removeClientFromDraft,
  selectAllDraftCodes,
  teamMemberCaseloadQueryKey,
  toggleDraftCode,
} from "./caseload.ts";

const AUTH = ["SLH", "SLN", "DSI"];

describe("caseload draft", () => {
  it("adding a client pre-checks all of its authorized codes", () => {
    assert.deepEqual(addClientToDraft({}, "c1", AUTH), { c1: AUTH });
  });

  it("toggles only within the client's authorized codes, in authorized order", () => {
    let d = addClientToDraft({}, "c1", ["SLH"]);
    d = toggleDraftCode(d, "c1", "DSI", AUTH);
    assert.deepEqual(d.c1, ["SLH", "DSI"]);
    d = toggleDraftCode(d, "c1", "SLH", AUTH);
    assert.deepEqual(d.c1, ["DSI"]);
    assert.equal(toggleDraftCode(d, "c1", "HHS", AUTH), d, "unauthorized code is ignored");
  });

  it("Select all checks every code, or clears when all are on", () => {
    let d = selectAllDraftCodes({ c1: ["SLH"] }, "c1", AUTH);
    assert.deepEqual(d.c1, AUTH);
    d = selectAllDraftCodes(d, "c1", AUTH);
    assert.deepEqual(d.c1, []);
  });

  it("remove drops the client", () => {
    assert.deepEqual(removeClientFromDraft({ c1: ["SLH"], c2: ["DSI"] }, "c1"), { c2: ["DSI"] });
  });
});

describe("caseloadChanges", () => {
  it("added, changed, removed; unchanged and order-only edits are skipped", () => {
    const saved = { a: ["SLH"], b: ["SLH", "DSI"], c: ["SLN"], d: ["DSI", "SLH"] };
    const draft = { b: ["SLH"], c: [], d: ["SLH", "DSI"], e: ["HHS"] };
    assert.deepEqual(caseloadChanges(saved, draft), [
      { clientId: "a", codes: [], kind: "removed" },
      { clientId: "b", codes: ["SLH"], kind: "changed" },
      { clientId: "c", codes: [], kind: "removed" },
      { clientId: "e", codes: ["HHS"], kind: "added" },
    ]);
    assert.equal(hasCaseloadChanges(saved, saved), false);
    assert.equal(hasCaseloadChanges({}, { x: [] }), false);
  });
});

describe("addableClients", () => {
  it("offers clients not on the draft, by name", () => {
    const out = addableClients(
      [
        { clientId: "2", name: "Zed" },
        { clientId: "1", name: "Amy" },
        { clientId: "3", name: "Bo" },
      ],
      { "3": ["SLH"] },
    );
    assert.deepEqual(
      out.map((c) => c.name),
      ["Amy", "Zed"],
    );
  });
});

describe("evidence suggestions from the caseload", () => {
  const person = { userId: "u1", transportsClients: false, positions: [] };
  const flags = [
    { clientId: "abi", hasAbi: true, behaviorSupport: false },
    { clientId: "plain", hasAbi: false, behaviorSupport: false },
  ];

  it("facts come from clients with codes only", () => {
    assert.deepEqual(caseloadFactsFor({ abi: [], plain: ["SLH", "DSI"] }, flags), {
      clientIds: ["plain"],
      serviceCodes: ["DSI", "SLH"],
      hasAbiClient: false,
      hasBehaviorSupportClient: false,
    });
    assert.equal(caseloadFactsFor({ abi: ["SLH"] }, flags).hasAbiClient, true);
  });

  it("adding an ABI client suggests ABI training when the person lacks it", () => {
    const before = caseloadFactsFor({ plain: ["SLH"] }, flags);
    const after = caseloadFactsFor({ plain: ["SLH"], abi: ["SLH"] }, flags);
    const keys = newEvidenceSuggestionKeys({ person, before, after, existingKeys: [] });
    assert.ok(keys.includes("abi_training"), keys.join(","));
    const have = newEvidenceSuggestionKeys({
      person,
      before,
      after,
      existingKeys: ["abi_training"],
    });
    assert.ok(!have.includes("abi_training"));
  });

  it("no new clients or codes → no suggestions", () => {
    const facts = caseloadFactsFor({ plain: ["SLH"] }, flags);
    assert.deepEqual(
      newEvidenceSuggestionKeys({ person, before: facts, after: facts, existingKeys: [] }),
      [],
    );
  });
});

describe("caseload wiring", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

  it("query key is stable and shared", () => {
    assert.deepEqual(teamMemberCaseloadQueryKey("o", "s"), ["team-member-caseload", "o", "s"]);
    assert.match(
      read("../../components/team-members/profile/profile-header.tsx"),
      /useMemberCaseload/,
    );
  });

  it("the tab saves only through setStaffClientCodes; nothing in team-members writes staff_assignments", () => {
    const tab = read("../../components/team-members/profile/caseload-tab.tsx");
    assert.match(tab, /setStaffClientCodes/);
    assert.doesNotMatch(tab, /staff_assignments/);
    assert.doesNotMatch(
      read("./caseload.functions.ts"),
      /from\("staff_assignments"\)\s*\.(insert|update|upsert|delete)/,
    );
  });

  it("removing a client waives its open staff_per_client items, never deletes", () => {
    assert.equal(REMOVED_FROM_CASELOAD_REASON, "Removed from caseload");
    const fn = read("./caseload.functions.ts");
    assert.match(fn, /status: "waived", waive_reason: REMOVED_FROM_CASELOAD_REASON/);
    assert.match(fn, /"staff_per_client"/);
    assert.doesNotMatch(fn, /company_obligation_instances"\)\s*\.delete/);
    assert.match(read("../scheduler/setup.functions.ts"), /waiveRemovedClientItemsInternal/);
  });

  it("/dashboard/assignments only redirects to Team Members", () => {
    const route = read("../../routes/dashboard.assignments.tsx");
    assert.match(route, /redirect\(\{ to: "\/dashboard\/team-members"/);
    assert.doesNotMatch(route, /component:/);
  });
});
