import test from "node:test";
import assert from "node:assert/strict";
import { approvalHome, canApprove, homesOfShifts } from "./needs-approvers.ts";

const maple = approvalHome(
  { id: "maple", team_name: "Maple House", team_type: "rhs_home", manager_id: "lead" },
  null,
);
const cedarOwner = approvalHome(
  { id: "cedar", team_name: "Cedar House", team_type: "rhs_home", manager_id: "lead" },
  { swap_approval: "owner", timeoff_approval: "lead" },
);
const lead = { userId: "lead", isOwner: false };
const owner = { userId: "rosa", isOwner: true };

test("the owner can approve anything, even with no home", () => {
  assert.deepEqual(canApprove("swap", owner, []), { ok: true });
  assert.deepEqual(canApprove("timeoff", owner, [cedarOwner]), { ok: true });
});

test("defaults: swaps by the lead, time off by the owner", () => {
  assert.deepEqual(canApprove("swap", lead, [maple]), { ok: true });
  const t = canApprove("timeoff", lead, [maple]);
  assert.equal(t.ok, false);
  assert.match(!t.ok ? t.reason : "", /At Maple House, only the owner approves time off/);
});

test("a home's own setting wins over the default", () => {
  assert.equal(canApprove("swap", lead, [cedarOwner]).ok, false);
  assert.deepEqual(canApprove("timeoff", lead, [cedarOwner]), { ok: true });
});

test("someone who isn't that home's lead can't approve", () => {
  const r = canApprove("swap", { userId: "ava", isOwner: false }, [maple]);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : "", /Only Maple House's lead or the owner approves swaps/);
});

test("the lead must lead every home the request touches; no home means the owner", () => {
  const other = approvalHome(
    { id: "oak", team_name: "Oak", team_type: "rhs_home", manager_id: "else" },
    { swap_approval: "lead" },
  );
  assert.equal(canApprove("swap", lead, [maple, other]).ok, false);
  assert.equal(canApprove("swap", lead, []).ok, false);
});

test("a host home's host is not an approver", () => {
  const host = approvalHome(
    { id: "h", team_name: "Harper", team_type: "host_home", manager_id: "lead" },
    { swap_approval: "lead" },
  );
  assert.equal(host.leadId, null);
  assert.equal(canApprove("swap", lead, [host]).ok, false);
});

test("homesOfShifts: the shift's home, else its client's", () => {
  const homes = new Map([
    ["maple", maple],
    ["cedar", cedarOwner],
  ]);
  const clientHome = new Map<string, string | null>([["c1", "cedar"]]);
  const got = homesOfShifts(
    [
      { team_id: "maple", client_id: null },
      { team_id: null, client_id: "c1" },
      { team_id: null, client_id: "nowhere" },
    ],
    clientHome,
    homes,
  );
  assert.deepEqual(
    got.map((h) => h.id),
    ["maple", "cedar"],
  );
});
