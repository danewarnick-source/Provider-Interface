import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { homeKind, homeKindLabel, hostOfClient, hostState, leadLabel, type HomeForHost } from "./home-kind.ts";

const homes = new Map<string, HomeForHost>([
  ["harper", { id: "harper", team_type: "host_home", manager_id: "host-1" }],
  ["empty-host", { id: "empty-host", team_type: "host_home", manager_id: null }],
  ["maple", { id: "maple", team_type: "rhs_home", manager_id: "lead-1" }],
]);

describe("home kind", () => {
  it("reads team_type, and anything unknown is Other", () => {
    assert.equal(homeKind("host_home"), "host_home");
    assert.equal(homeKind("group_home"), "other");
    assert.equal(homeKind(null), "other");
    assert.equal(homeKindLabel("rhs_home"), "Group home (RHS)");
  });

  it("calls the lead Host only on a host home", () => {
    assert.equal(leadLabel("host_home"), "Host");
    assert.equal(leadLabel("rhs_home"), "Lead");
    assert.equal(leadLabel(undefined), "Lead");
  });
});

describe("a client's host is the lead of their host home", () => {
  it("returns the host home's lead", () => {
    assert.equal(hostOfClient({ team_id: "harper" }, homes), "host-1");
    assert.equal(hostState({ team_id: "harper" }, homes), "has_host");
  });

  it("a group home's lead is not a host", () => {
    assert.equal(hostOfClient({ team_id: "maple" }, homes), null);
    assert.equal(hostState({ team_id: "maple" }, homes), "not_host_home");
  });

  it("a host home with no lead has no host yet", () => {
    assert.equal(hostOfClient({ team_id: "empty-host" }, homes), null);
    assert.equal(hostState({ team_id: "empty-host" }, homes), "no_host");
  });

  it("no home, or a home that isn't loaded, means no host", () => {
    assert.equal(hostOfClient({ team_id: null }, homes), null);
    assert.equal(hostState({ team_id: null }, homes), "no_home");
    assert.equal(hostOfClient({ team_id: "gone" }, homes), null);
  });
});
