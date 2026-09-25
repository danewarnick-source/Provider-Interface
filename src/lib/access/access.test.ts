import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffOverrides, effectiveCategories, hasCategory, hasPermission } from "./can.ts";
import { CATEGORIES, CATEGORY_IDS } from "./categories.ts";
import { isAgencyAdmin, isLevelAtLeast } from "./levels.ts";
import { resolveMemberAccess } from "./member.ts";
import { ALL_PERMISSIONS, PERMISSION_KEYS } from "./permission-keys.ts";

describe("effectiveCategories", () => {
  it("gives Owners Edit on everything, including Agency settings", () => {
    const cats = effectiveCategories({ level: "owner", presetCategories: { clients: "off" } });
    assert.ok(CATEGORY_IDS.every((id) => cats[id] === "edit"));
  });

  it("layers overrides on the preset and treats missing keys as Off", () => {
    const cats = effectiveCategories({
      level: "admin",
      presetCategories: { clients: "view", scheduling: "edit" },
      overrides: { clients: "edit", scheduling: "off", bogus: "edit" },
    });
    assert.equal(cats.clients, "edit");
    assert.equal(cats.scheduling, "off");
    assert.equal(cats.billing, "off");
  });

  it("never lets a non-Owner hold Agency settings", () => {
    const cats = effectiveCategories({ level: "admin", presetCategories: { agency_settings: "edit" } });
    assert.equal(cats.agency_settings, "off");
  });

  it("denies everything without a level", () => {
    const cats = effectiveCategories({ level: null });
    assert.ok(CATEGORY_IDS.every((id) => cats[id] === "off"));
  });
});

describe("hasPermission", () => {
  const dsp = effectiveCategories({ level: "staff", presetCategories: { phone_app: "edit" } });

  it("maps legacy keys through their category minimum", () => {
    assert.equal(hasPermission(dsp, "submit_shift_notes"), true);
    assert.equal(hasPermission(dsp, "view_clients"), false);
    assert.equal(hasCategory(dsp, "phone_app", "edit"), true);
  });

  it("denies unknown and HIVE-internal keys", () => {
    const owner = effectiveCategories({ level: "owner" });
    assert.equal(hasPermission(owner, "not_a_key"), false);
    assert.equal(hasPermission(owner, "manage_all_orgs"), false);
  });

  it("maps every permission key to a real category or null", () => {
    for (const key of ALL_PERMISSIONS) {
      const rule = PERMISSION_KEYS[key];
      assert.ok(rule === null || CATEGORY_IDS.includes(rule[0]), key);
    }
  });
});

describe("diffOverrides", () => {
  it("stores only settings that differ from the preset", () => {
    const out = diffOverrides({ clients: "view", billing: "edit" }, { clients: "view", billing: "view", hrc: "off" });
    assert.deepEqual(out, { billing: "view" });
  });
});

describe("resolveMemberAccess", () => {
  it("forces Owners to whole-agency scope with no preset", () => {
    const a = resolveMemberAccess({
      access_level: "owner",
      access_scope: "self",
      access_preset_id: "p1",
      access_overrides: {},
      access_presets: { name: "DSP", categories: {}, home_page: "/employee" },
    });
    assert.equal(a.scope, "agency");
    assert.equal(a.presetId, null);
    assert.equal(a.presetHome, null);
  });

  it("falls back to team member / self for unknown values", () => {
    const a = resolveMemberAccess({
      access_level: "manager",
      access_scope: null,
      access_preset_id: null,
      access_overrides: null,
      access_presets: null,
    });
    assert.equal(a.level, "staff");
    assert.equal(a.scope, "self");
    assert.equal(a.categories.phone_app, "off");
  });
});

describe("levels", () => {
  it("ranks and matches SQL is_org_admin_or_manager", () => {
    assert.equal(isLevelAtLeast("admin", "staff"), true);
    assert.equal(isLevelAtLeast("staff", "admin"), false);
    assert.equal(isAgencyAdmin("admin", "assigned"), false);
    assert.equal(isAgencyAdmin("admin", "agency"), true);
    assert.equal(isAgencyAdmin("owner", "self"), true);
  });

  it("has explain copy for every setting a category offers", () => {
    for (const c of CATEGORIES) {
      assert.ok(c.explain.off && c.explain.edit, c.id);
      if (!c.onOff) assert.ok(c.explain.view, c.id);
    }
  });
});
