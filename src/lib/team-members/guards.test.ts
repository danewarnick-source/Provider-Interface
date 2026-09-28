import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MANAGE_MEMBER_ACTIONS,
  OUT_OF_SCOPE_MESSAGE,
  OWNER_ONLY_MESSAGE,
  SELF_ACTION_MESSAGE,
  TARGET_NOT_FOUND_MESSAGE,
  categoryForAction,
  isSelfBlockedAction,
  runManageMemberGuard,
  type ManageMemberAction,
  type ManageMemberGuardDeps,
} from "./guards.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";

type Calls = { requireCategory: Array<[string, string]>; canSeeStaff: string[]; loadTargetLevel: string[] };

/** Fake data sources. Every call is recorded so tests can assert what ran and what didn't. */
function fakeDeps(opts: {
  actor?: { level: "owner" | "admin" | "staff"; scope: "agency" | "assigned" | "self" };
  categoryError?: string;
  canSee?: boolean;
  targetLevel?: string | null;
}): { deps: ManageMemberGuardDeps; calls: Calls } {
  const calls: Calls = { requireCategory: [], canSeeStaff: [], loadTargetLevel: [] };
  const deps: ManageMemberGuardDeps = {
    requireCategory: async (category, min) => {
      calls.requireCategory.push([category, min]);
      if (opts.categoryError) throw new Error(opts.categoryError);
      return opts.actor ?? { level: "admin", scope: "agency" };
    },
    canSeeStaff: async (id) => {
      calls.canSeeStaff.push(id);
      return opts.canSee ?? true;
    },
    loadTargetLevel: async (id) => {
      calls.loadTargetLevel.push(id);
      return opts.targetLevel === undefined ? "staff" : opts.targetLevel;
    },
  };
  return { deps, calls };
}

const run = (action: ManageMemberAction, deps: ManageMemberGuardDeps, targetUserId: string | null = TARGET) =>
  runManageMemberGuard({ actorId: ACTOR, targetUserId, action }, deps);

describe("rule (a): each action needs Edit on the right category", () => {
  it("edit_profile and edit_caseload need staff_roster; everything else needs staff_hiring", () => {
    assert.deepEqual(categoryForAction("edit_profile"), { category: "staff_roster", min: "edit" });
    assert.deepEqual(categoryForAction("edit_caseload"), { category: "staff_roster", min: "edit" });
    for (const action of ["deactivate", "reactivate", "reset_password", "invite"] as const) {
      assert.deepEqual(categoryForAction(action), { category: "staff_hiring", min: "edit" }, action);
    }
    assert.equal(MANAGE_MEMBER_ACTIONS.length, 6);
  });

  it("asks requireCategory for exactly that category at Edit", async () => {
    for (const action of MANAGE_MEMBER_ACTIONS) {
      const { deps, calls } = fakeDeps({});
      await run(action, deps);
      assert.deepEqual(calls.requireCategory, [[categoryForAction(action).category, "edit"]], action);
    }
  });

  it("an Admin whose Hire & deactivate is Off or View gets requireCategory's clear error, before anything else runs", async () => {
    const { deps, calls } = fakeDeps({ categoryError: "Forbidden: requires edit on staff_hiring" });
    await assert.rejects(() => run("deactivate", deps), /Forbidden: requires edit on staff_hiring/);
    assert.deepEqual(calls.canSeeStaff, []);
    assert.deepEqual(calls.loadTargetLevel, []);
  });
});

describe("rule (b): a non-agency-scope actor must be able to see the target", () => {
  it("assigned scope + access_can_see_staff false → blocked", async () => {
    const { deps, calls } = fakeDeps({ actor: { level: "admin", scope: "assigned" }, canSee: false });
    await assert.rejects(() => run("deactivate", deps), new RegExp(OUT_OF_SCOPE_MESSAGE));
    assert.deepEqual(calls.canSeeStaff, [TARGET]);
  });

  it("assigned scope + access_can_see_staff true → allowed", async () => {
    const { deps } = fakeDeps({ actor: { level: "admin", scope: "assigned" }, canSee: true });
    await assert.doesNotReject(() => run("reactivate", deps));
  });

  it("agency scope never consults access_can_see_staff", async () => {
    const { deps, calls } = fakeDeps({ actor: { level: "admin", scope: "agency" }, canSee: false });
    await assert.doesNotReject(() => run("reactivate", deps));
    assert.deepEqual(calls.canSeeStaff, []);
  });
});

describe("rule (c): only an Owner may act on an Owner", () => {
  it("Admin → Owner target is refused with the exact message", async () => {
    const { deps } = fakeDeps({ actor: { level: "admin", scope: "agency" }, targetLevel: "owner" });
    await assert.rejects(() => run("reset_password", deps), new Error(OWNER_ONLY_MESSAGE));
    await assert.rejects(() => run("deactivate", deps), new Error(OWNER_ONLY_MESSAGE));
  });

  it("Owner → Owner target is allowed", async () => {
    const { deps } = fakeDeps({ actor: { level: "owner", scope: "agency" }, targetLevel: "owner" });
    await assert.doesNotReject(() => run("reset_password", deps));
  });

  it("a target with no membership row is reported, not silently allowed", async () => {
    const { deps } = fakeDeps({ targetLevel: null });
    await assert.rejects(() => run("deactivate", deps), new Error(TARGET_NOT_FOUND_MESSAGE));
  });
});

describe("rule (d): nobody deactivates or resets their own account", () => {
  it("deactivate and reset_password on yourself are refused with the exact message", async () => {
    assert.equal(isSelfBlockedAction("deactivate"), true);
    assert.equal(isSelfBlockedAction("reset_password"), true);
    for (const action of ["deactivate", "reset_password"] as const) {
      const { deps } = fakeDeps({ actor: { level: "owner", scope: "agency" }, targetLevel: "owner" });
      await assert.rejects(() => run(action, deps, ACTOR), new Error(SELF_ACTION_MESSAGE), action);
    }
  });

  it("other actions on yourself are not blocked by this rule", async () => {
    for (const action of ["reactivate", "edit_profile", "edit_caseload", "invite"] as const) {
      assert.equal(isSelfBlockedAction(action), false);
      const { deps } = fakeDeps({ actor: { level: "owner", scope: "agency" }, targetLevel: "owner" });
      await assert.doesNotReject(() => run(action, deps, ACTOR), action);
    }
  });
});

describe("no target yet (e.g. inviting a new email)", () => {
  it("runs only rule (a)", async () => {
    const { deps, calls } = fakeDeps({ actor: { level: "admin", scope: "assigned" }, canSee: false });
    await assert.doesNotReject(() => run("invite", deps, null));
    assert.deepEqual(calls.requireCategory, [["staff_hiring", "edit"]]);
    assert.deepEqual(calls.canSeeStaff, []);
    assert.deepEqual(calls.loadTargetLevel, []);
  });
});

describe("wiring locks — the real callers use the guard, and nothing hard-deletes a person", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
  // The removed hard-delete server fn, split so `grep -rn <its name> src` stays empty.
  const HARD_DELETE_FN = /delete[E]ntity/;

  it("guards.server.ts wires requireCategory, access_can_see_staff and access_level — never role", () => {
    const src = read("./guards.server.ts");
    assert.match(src, /requireCategory\(/);
    assert.match(src, /rpc\("access_can_see_staff"/);
    assert.match(src, /\.select\("access_level"\)/);
    assert.doesNotMatch(src, /select\([^)]*\brole\b/);
    assert.match(src, /export async function assertCanManageMember/);
  });

  it("lifecycle.functions.ts: the hard-delete fn and assertManager are gone; archive/restore go through the guard", () => {
    const src = read("../lifecycle.functions.ts");
    assert.doesNotMatch(src, HARD_DELETE_FN);
    assert.doesNotMatch(src, /assertManager/);
    assert.doesNotMatch(src, /auth\.admin\.deleteUser/);
    assert.doesNotMatch(src, /from\("profiles"\)\s*\.delete\(/);
    assert.match(src, /action: "deactivate"/);
    assert.match(src, /action: "reactivate"/);
    assert.match(src, /assertCanManageMember/);
    assert.doesNotMatch(src, /select\([^)]*\brole\b/);
  });

  it("employees.functions.ts: adminResetEmployeePassword goes through the guard as reset_password", () => {
    const src = read("../employees.functions.ts");
    const fn = src.slice(src.indexOf("export const adminResetEmployeePassword"));
    const body = fn.slice(0, fn.indexOf("/* ----"));
    assert.match(body, /assertCanManageMember\(/);
    assert.match(body, /action: "reset_password"/);
    assert.doesNotMatch(body, /assertOrgManager\(/);
  });

  it("the roster route and the e2e mocks no longer reference the hard-delete fn", () => {
    assert.doesNotMatch(read("../../routes/dashboard.employees.index.tsx"), HARD_DELETE_FN);
    assert.doesNotMatch(read("../../../e2e/helpers/mock-hive.ts"), HARD_DELETE_FN);
    assert.doesNotMatch(read("../../../e2e/helpers/mock-hive-1056.ts"), HARD_DELETE_FN);
  });
});
