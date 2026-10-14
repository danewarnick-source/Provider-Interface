import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_DELETED_MESSAGE,
  CLIENT_DISCHARGED_MESSAGE,
  CLIENT_NOT_DELETED_MESSAGE,
  CLIENT_NOT_FOUND_MESSAGE,
  CLIENT_OUT_OF_SCOPE_MESSAGE,
  MANAGE_CLIENT_ACTIONS,
  NO_PERMISSION_MESSAGE,
  categoryForClientAction,
  friendlyGuardError,
  runManageClientGuard,
  type ManageClientAction,
  type ManageClientGuardDeps,
} from "./guards.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const ORG = "33333333-3333-4333-8333-333333333333";
const OTHER_ORG = "44444444-4444-4444-8444-444444444444";
const CLIENT = "22222222-2222-4222-8222-222222222222";

function fakeDeps(opts: {
  scope?: "agency" | "assigned" | "self";
  categoryError?: string;
  clientOrg?: string | null;
  canSee?: boolean;
  discharged?: boolean;
  deleted?: boolean;
  level?: "owner" | "admin" | "staff";
}) {
  const calls = {
    requireCategory: [] as Array<[string, string]>,
    loadClient: 0,
    canSeeClient: 0,
  };
  const deps: ManageClientGuardDeps = {
    requireCategory: async (category, min) => {
      calls.requireCategory.push([category, min]);
      if (opts.categoryError) throw new Error(opts.categoryError);
      return { level: opts.level ?? "admin", scope: opts.scope ?? "agency" };
    },
    loadClient: async () => {
      calls.loadClient++;
      const org = opts.clientOrg === undefined ? ORG : opts.clientOrg;
      return org
        ? { organizationId: org, discharged: opts.discharged ?? false, deleted: opts.deleted ?? false }
        : null;
    },
    canSeeClient: async () => {
      calls.canSeeClient++;
      return opts.canSee ?? true;
    },
  };
  return { deps, calls };
}

const run = (
  action: ManageClientAction,
  deps: ManageClientGuardDeps,
  clientId: string | null = CLIENT,
) => runManageClientGuard({ actorId: ACTOR, organizationId: ORG, clientId, action }, deps);

describe("categoryForClientAction", () => {
  const expected: Record<ManageClientAction, [string, string]> = {
    view: ["clients", "view"],
    edit: ["clients", "edit"],
    create: ["clients", "edit"],
    discharge: ["clients", "edit"],
    import: ["clients", "edit"],
    view_medical: ["client_medical", "view"],
    edit_medical: ["client_medical", "edit"],
    edit_billing: ["billing", "edit"],
    view_hrc: ["hrc", "view"],
    edit_hrc: ["hrc", "edit"],
    edit_funds: ["billing", "edit"],
    edit_loans: ["loans", "edit"],
    restore: ["delete_people", "edit"],
  };
  for (const action of MANAGE_CLIENT_ACTIONS) {
    it(`${action} → ${expected[action].join(":")}`, () => {
      const r = categoryForClientAction(action);
      assert.deepEqual([r.category, r.min], expected[action]);
    });
  }
});

describe("runManageClientGuard", () => {
  it("checks the action's category first", async () => {
    const { deps, calls } = fakeDeps({});
    await run("edit_billing", deps);
    assert.deepEqual(calls.requireCategory, [["billing", "edit"]]);
  });

  it("stops before any lookup when the category is missing", async () => {
    const { deps, calls } = fakeDeps({ categoryError: "Forbidden: requires edit on clients" });
    await assert.rejects(run("edit", deps), /Forbidden/);
    assert.equal(calls.loadClient, 0);
    assert.equal(calls.canSeeClient, 0);
  });

  it("rejects a client from another organization", async () => {
    const { deps } = fakeDeps({ clientOrg: OTHER_ORG });
    await assert.rejects(run("edit", deps), new RegExp(CLIENT_NOT_FOUND_MESSAGE));
  });

  it("rejects a missing client", async () => {
    const { deps } = fakeDeps({ clientOrg: null });
    await assert.rejects(run("view", deps), new RegExp(CLIENT_NOT_FOUND_MESSAGE));
  });

  it("agency scope skips the visibility check", async () => {
    const { deps, calls } = fakeDeps({ scope: "agency", canSee: false });
    await run("edit", deps);
    assert.equal(calls.canSeeClient, 0);
  });

  it("assigned scope must be able to see the client", async () => {
    const { deps } = fakeDeps({ scope: "assigned", canSee: false });
    await assert.rejects(run("edit", deps), new RegExp(CLIENT_OUT_OF_SCOPE_MESSAGE));
  });

  it("assigned scope passes when the client is assigned", async () => {
    const { deps, calls } = fakeDeps({ scope: "assigned", canSee: true });
    await run("edit_medical", deps);
    assert.equal(calls.canSeeClient, 1);
  });

  it("a discharged client is read-only", async () => {
    const { deps } = fakeDeps({ discharged: true });
    for (const action of ["edit", "edit_medical", "edit_billing", "edit_funds"] as const) {
      await assert.rejects(run(action, deps), new RegExp(CLIENT_DISCHARGED_MESSAGE.slice(0, 30)));
    }
  });

  it("a discharged client can still be viewed, and discharged or reactivated", async () => {
    const { deps } = fakeDeps({ discharged: true });
    await run("view", deps);
    await run("view_medical", deps);
    await run("view_hrc", deps);
    await run("discharge", deps);
  });

  it("CS3: a scoped admin can't set fields, pins, loans or HRC on a client outside their scope", async () => {
    for (const action of ["edit", "edit_loans", "edit_hrc", "edit_medical", "view_hrc"] as const) {
      const { deps } = fakeDeps({ scope: "assigned", canSee: false });
      await assert.rejects(run(action, deps), new RegExp(CLIENT_OUT_OF_SCOPE_MESSAGE), action);
    }
  });

  it("CS3: a client in another agency is refused", async () => {
    const { deps } = fakeDeps({ clientOrg: OTHER_ORG });
    await assert.rejects(run("edit_loans", deps), new RegExp(CLIENT_NOT_FOUND_MESSAGE));
  });

  it("a deleted client rejects every action, even for an Owner", async () => {
    const { deps } = fakeDeps({ deleted: true, level: "owner" });
    for (const action of MANAGE_CLIENT_ACTIONS.filter((a) => a !== "restore")) {
      await assert.rejects(run(action, deps), new RegExp(CLIENT_DELETED_MESSAGE.slice(0, 25)), action);
    }
  });

  it("only an Owner can restore a deleted client", async () => {
    await run("restore", fakeDeps({ deleted: true, level: "owner" }).deps);
    await assert.rejects(
      run("restore", fakeDeps({ deleted: true, level: "admin" }).deps),
      new RegExp(CLIENT_DELETED_MESSAGE.slice(0, 25)),
    );
  });

  it("restore is refused for a client who isn't deleted", async () => {
    await assert.rejects(
      run("restore", fakeDeps({ level: "owner" }).deps),
      new RegExp(CLIENT_NOT_DELETED_MESSAGE),
    );
  });

  it("no client (create) checks only the category", async () => {
    const { deps, calls } = fakeDeps({ scope: "assigned" });
    await run("create", deps, null);
    assert.equal(calls.loadClient, 0);
    assert.equal(calls.canSeeClient, 0);
  });
});

describe("friendlyGuardError", () => {
  it("turns Forbidden into plain English", () => {
    assert.equal(
      friendlyGuardError(new Error("Forbidden: requires edit on clients")).message,
      NO_PERMISSION_MESSAGE,
    );
  });
  it("keeps other messages", () => {
    assert.equal(
      friendlyGuardError(new Error(CLIENT_NOT_FOUND_MESSAGE)).message,
      CLIENT_NOT_FOUND_MESSAGE,
    );
  });
});
