import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { isRedirect } from "@tanstack/react-router";
import {
  isReservedCreateId,
  isRouteUuid,
  redirectUnlessUuidParam,
  ROUTE_UUID_RE,
} from "./route-uuid.ts";

const SAMPLE_UUID = "7fabcf5d-f826-487f-8730-8b0c3f1969bb";

describe("route UUID params", () => {
  it("accepts a real UUID and rejects the create-page literal new", () => {
    assert.equal(isRouteUuid(SAMPLE_UUID), true);
    assert.equal(ROUTE_UUID_RE.test(SAMPLE_UUID), true);
    assert.equal(isRouteUuid("new"), false);
    assert.equal(isRouteUuid("create"), false);
    assert.equal(isRouteUuid(""), false);
    assert.equal(isRouteUuid(null), false);
    assert.equal(isReservedCreateId("new"), true);
    assert.equal(isReservedCreateId("NEW"), true);
    assert.equal(isReservedCreateId(SAMPLE_UUID), false);
  });

  it("UUID client and staff routes redirect new before a uuid cast", () => {
    const files = [
      "../routes/dashboard.clients.$clientId.tsx",
      "../routes/dashboard.client-intake.$clientId.tsx",
      "../routes/dashboard.workspace.$clientId.tsx",
      "../routes/dashboard.hhs-hub.$clientId.tsx",
      "../routes/dashboard.billing.$clientId.tsx",
      "../routes/dashboard.client-training.$clientId.tsx",
      "../routes/dashboard.behavior-support.$clientId.tsx",
      "../routes/dashboard.team-members.$staffId.tsx",
      "../routes/dashboard.hive-exec.$orgId.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
      assert.match(src, /redirectUnlessUuidParam/, `${rel} must parse the id before UUID queries`);
      assert.match(src, /createTo:/, `${rel} must send reserved create ids to a /new path`);
    }
  });

  it("emergency-contact queries and saves skip the literal new", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../components/clients/profile-tab.tsx", import.meta.url)),
      "utf8",
    );
    assert.match(src, /enabled: !!orgId && isRouteUuid\(clientId\)/);
    assert.match(src, /client_emergency_contacts/);
    assert.match(src, /const rowId = isRouteUuid\(c\.id\) \? c\.id : undefined/);
    assert.match(src, /Save the client before adding emergency contacts/);
    assert.match(src, /Add contact/);
  });

  it("keeps a distinct /new create path for clients and staff", () => {
    const clientsNew = readFileSync(
      fileURLToPath(new URL("../routes/dashboard.clients.new.tsx", import.meta.url)),
      "utf8",
    );
    const staffNew = readFileSync(
      fileURLToPath(new URL("../routes/dashboard.employees.new.tsx", import.meta.url)),
      "utf8",
    );
    assert.match(clientsNew, /createFileRoute\("\/dashboard\/clients\/new"\)/);
    assert.match(clientsNew, /startWithAddOpen/);
    assert.match(staffNew, /createFileRoute\("\/dashboard\/employees\/new"\)/);
    assert.match(staffNew, /to: "\/dashboard\/team-members"/);
    assert.match(staffNew, /add: 1/);
    const staffProfile = readFileSync(
      fileURLToPath(new URL("../routes/dashboard.team-members.$staffId.tsx", import.meta.url)),
      "utf8",
    );
    assert.match(staffProfile, /createSearch: \{ add: 1 \}/);
  });

  it("sends the create placeholder to the roster with the add flag", () => {
    let thrown: unknown;
    try {
      redirectUnlessUuidParam("new", {
        createTo: "/dashboard/team-members",
        createSearch: { add: 1 },
        fallbackTo: "/dashboard/team-members",
      });
    } catch (e) {
      thrown = e;
    }
    assert.ok(isRedirect(thrown));
    assert.equal((thrown as { options: { to: string } }).options.to, "/dashboard/team-members");
    assert.deepEqual((thrown as { options: { search: unknown } }).options.search, { add: 1 });
    assert.doesNotThrow(() =>
      redirectUnlessUuidParam(SAMPLE_UUID, { createTo: "/x", fallbackTo: "/y" }),
    );
  });
});
