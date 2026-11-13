import { test } from "node:test";
import assert from "node:assert/strict";
import {
  archiveBlockedReason,
  archiveReason,
  capacityFromText,
  cleanHomePatch,
  homePatchProblems,
  homesAccess,
  visibleHomes,
  type HomeListRow,
} from "./home-setup.ts";

test("Owners and agency-wide Admins with Scheduling: Edit change homes", () => {
  assert.deepEqual(homesAccess({ level: "owner", scope: "agency", scheduling: "edit" }), {
    canView: true,
    canEdit: true,
  });
  assert.deepEqual(homesAccess({ level: "admin", scope: "agency", scheduling: "edit" }), {
    canView: true,
    canEdit: true,
  });
});

test("an assigned-scope Admin or Scheduling: View only sees homes", () => {
  assert.deepEqual(homesAccess({ level: "admin", scope: "assigned", scheduling: "edit" }), {
    canView: true,
    canEdit: false,
  });
  assert.deepEqual(homesAccess({ level: "admin", scope: "agency", scheduling: "view" }), {
    canView: true,
    canEdit: false,
  });
});

test("Team members and Admins without Scheduling don't see homes", () => {
  const none = { canView: false, canEdit: false };
  assert.deepEqual(homesAccess({ level: "staff", scope: "agency", scheduling: "edit" }), none);
  assert.deepEqual(homesAccess({ level: "admin", scope: "agency", scheduling: "off" }), none);
  assert.deepEqual(homesAccess({ level: null, scope: null, scheduling: null }), none);
});

test("a home needs a name; kind, address and capacity are checked", () => {
  assert.deepEqual(homePatchProblems({ team_name: "  " }), ["Give the home a name."]);
  assert.deepEqual(homePatchProblems({ team_name: "Maple House", team_type: "rhs_home" }), []);
  assert.deepEqual(homePatchProblems({ team_type: "castle" as never }), ["Pick the kind of home."]);
  assert.deepEqual(homePatchProblems({ capacity: 0 }), [
    "Licensed capacity is a whole number from 1 to 99, or blank.",
  ]);
  assert.deepEqual(homePatchProblems({ capacity: Number.NaN }), [
    "Licensed capacity is a whole number from 1 to 99, or blank.",
  ]);
  assert.deepEqual(homePatchProblems({ capacity: null, address: null }), []);
});

test("saved details are trimmed and a blank address is cleared", () => {
  assert.deepEqual(cleanHomePatch({ team_name: " Maple ", address: "  " }), {
    team_name: "Maple",
    address: null,
  });
  assert.deepEqual(cleanHomePatch({ capacity: 4 }), { capacity: 4 });
});

test("capacity text reads as a number, blank, or NaN", () => {
  assert.equal(capacityFromText(""), null);
  assert.equal(capacityFromText(" 4 "), 4);
  assert.ok(Number.isNaN(capacityFromText("four")));
});

test("a home with anyone living there can't be archived", () => {
  assert.equal(archiveBlockedReason(1), "Move its residents first");
  assert.equal(archiveBlockedReason(0), null);
});

test("archiving needs a reason", () => {
  assert.deepEqual(archiveReason("  "), {
    ok: false,
    error: "Say why the home is being archived.",
  });
  assert.deepEqual(archiveReason(" Closed the house "), { ok: true, value: "Closed the house" });
  assert.equal(archiveReason("x".repeat(501)).ok, false);
});

test("the list shows active homes by name, archived ones after them only when asked", () => {
  const h = (name: string, active: boolean): HomeListRow => ({
    id: name,
    name,
    kind: "rhs_home",
    leadName: null,
    residents: 0,
    active,
    archivedAt: active ? null : "2026-11-01T00:00:00Z",
  });
  const rows = [h("Oak", true), h("Birch", false), h("Maple", true)];
  assert.deepEqual(
    visibleHomes(rows, false).map((r) => r.name),
    ["Maple", "Oak"],
  );
  assert.deepEqual(
    visibleHomes(rows, true).map((r) => r.name),
    ["Maple", "Oak", "Birch"],
  );
});
