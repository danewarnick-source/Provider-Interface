import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  aiSettingRefusal,
  checkNectarCaller,
  DEFAULT_NECTAR_SETTINGS,
  isNectarOff,
  nectarOrgIdsFrom,
  nectarSettingsFrom,
  NECTAR_AI_FEATURES,
  NECTAR_REFUSAL_MESSAGE,
  type NectarCallerDeps,
} from "./guard.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function fakeDeps(opts: { memberOf?: string[]; nectarOn?: string[]; settings?: Record<string, unknown> }) {
  const calls = { active: [] as string[], nectar: [] as string[][], settings: [] as string[] };
  const deps: NectarCallerDeps = {
    loadActiveOrgIds: async (userId) => {
      calls.active.push(userId);
      return opts.memberOf ?? [];
    },
    loadNectarOrgIds: async (orgIds) => {
      calls.nectar.push(orgIds);
      return orgIds.filter((id) => (opts.nectarOn ?? []).includes(id));
    },
    loadNectarSettings: async (orgId) => {
      calls.settings.push(orgId);
      return opts.settings?.[orgId];
    },
  };
  return { deps, calls };
}

describe("checkNectarCaller", () => {
  it("refuses a signed-out caller without reading anything", async () => {
    for (const userId of [null, undefined, ""]) {
      const { deps, calls } = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A] });
      const check = await checkNectarCaller(userId, deps);
      assert.deepEqual(check, {
        ok: false,
        reason: "signed_out",
        message: NECTAR_REFUSAL_MESSAGE.signed_out,
      });
      assert.equal(calls.active.length, 0);
    }
  });

  it("refuses a non-member before checking the feature", async () => {
    const { deps, calls } = fakeDeps({ memberOf: [], nectarOn: [ORG_A] });
    const check = await checkNectarCaller(USER, deps);
    assert.equal(check.ok, false);
    assert.equal(!check.ok && check.reason, "not_member");
    assert.deepEqual(calls.active, [USER]);
    assert.equal(calls.nectar.length, 0);
  });

  it("refuses when Nectar is off for every agency the caller belongs to", async () => {
    const { deps } = fakeDeps({ memberOf: [ORG_A, ORG_B], nectarOn: [] });
    const check = await checkNectarCaller(USER, deps);
    assert.equal(!check.ok && check.reason, "feature_off");
    assert.equal(!check.ok && check.message, "Nectar is turned off for your agency.");
  });

  it("returns the agency the call is rate-limited under", async () => {
    const { deps } = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A] });
    assert.deepEqual(await checkNectarCaller(USER, deps), { ok: true, orgId: ORG_A });
  });

  it("picks the first agency with Nectar on, in a stable order", async () => {
    const { deps } = fakeDeps({ memberOf: [ORG_C, ORG_A, ORG_B, ORG_A], nectarOn: [ORG_C, ORG_B] });
    assert.deepEqual(await checkNectarCaller(USER, deps), { ok: true, orgId: ORG_B });
  });

  it("with an explicit agency, requires membership and Nectar in that agency", async () => {
    const notMember = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A, ORG_B] });
    const refused = await checkNectarCaller(USER, notMember.deps, { orgId: ORG_B });
    assert.equal(!refused.ok && refused.reason, "not_member");
    assert.equal(notMember.calls.nectar.length, 0);

    const off = fakeDeps({ memberOf: [ORG_A, ORG_B], nectarOn: [ORG_A] });
    const offCheck = await checkNectarCaller(USER, off.deps, { orgId: ORG_B });
    assert.equal(!offCheck.ok && offCheck.reason, "feature_off");
    assert.deepEqual(off.calls.nectar, [[ORG_B]]);

    const on = fakeDeps({ memberOf: [ORG_A, ORG_B], nectarOn: [ORG_A, ORG_B] });
    assert.deepEqual(await checkNectarCaller(USER, on.deps, { orgId: ORG_B }), {
      ok: true,
      orgId: ORG_B,
    });
  });
});

describe("AI settings (N3)", () => {
  it("reads missing, non-object or non-boolean settings as on", () => {
    assert.deepEqual(nectarSettingsFrom(undefined), DEFAULT_NECTAR_SETTINGS);
    assert.deepEqual(nectarSettingsFrom([]), DEFAULT_NECTAR_SETTINGS);
    assert.deepEqual(nectarSettingsFrom({ ask: "no", note_help: false }), { ...DEFAULT_NECTAR_SETTINGS, note_help: false });
    assert.deepEqual([...NECTAR_AI_FEATURES], ["ask", "note_help", "pcsp_reading", "summary_drafts"]);
  });

  it("refuses a feature when Nectar or that feature is off", () => {
    assert.equal(aiSettingRefusal(DEFAULT_NECTAR_SETTINGS, "ask"), null);
    assert.equal(aiSettingRefusal({ ...DEFAULT_NECTAR_SETTINGS, enabled: false }, "ask"), "Nectar is turned off for your agency.");
    assert.equal(aiSettingRefusal({ ...DEFAULT_NECTAR_SETTINGS, ask: false }, "ask"), "Ask is turned off for your agency.");
    assert.equal(aiSettingRefusal({ ...DEFAULT_NECTAR_SETTINGS, ask: false }, "note_help"), null);
  });

  it("checks the settings of the agency the call runs under, only for an AI call", async () => {
    const settings = { [ORG_A]: { note_help: false } };
    const noted = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A], settings });
    const refused = await checkNectarCaller(USER, noted.deps, { feature: "note_help" });
    assert.deepEqual(refused, { ok: false, reason: "setting_off", message: "Shift note help is turned off for your agency." });
    assert.equal(isNectarOff(refused), true);
    assert.deepEqual(noted.calls.settings, [ORG_A]);

    const library = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A], settings: { [ORG_A]: { enabled: false } } });
    assert.deepEqual(await checkNectarCaller(USER, library.deps, { orgId: ORG_A, feature: null }), { ok: true, orgId: ORG_A });
    assert.equal(library.calls.settings.length, 0, "no model call, no settings read");

    const signedOut = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A] });
    const out = await checkNectarCaller(null, signedOut.deps, { feature: "ask" });
    assert.equal(isNectarOff(out), false, "a signed-out caller is not 'Nectar off'");
  });

  it("leaves current agencies unchanged: every setting defaults to on", async () => {
    const { deps } = fakeDeps({ memberOf: [ORG_A], nectarOn: [ORG_A] });
    for (const feature of NECTAR_AI_FEATURES) {
      assert.deepEqual(await checkNectarCaller(USER, deps, { feature }), { ok: true, orgId: ORG_A });
    }
  });
});

describe("nectarOrgIdsFrom", () => {
  it("lets an agency's own setting win over the registry default", () => {
    const overrides = [
      { organization_id: ORG_A, enabled: true },
      { organization_id: ORG_B, enabled: false },
    ];
    assert.deepEqual(nectarOrgIdsFrom([ORG_A, ORG_B, ORG_C], false, overrides), [ORG_A]);
    assert.deepEqual(nectarOrgIdsFrom([ORG_A, ORG_B, ORG_C], true, overrides), [ORG_A, ORG_C]);
  });

  it("fails closed when the default or the setting is missing", () => {
    assert.deepEqual(nectarOrgIdsFrom([ORG_A], null, []), []);
    assert.deepEqual(nectarOrgIdsFrom([ORG_A], undefined, []), []);
    assert.deepEqual(nectarOrgIdsFrom([ORG_A], true, [{ organization_id: ORG_A, enabled: null }]), []);
  });
});

describe("guard.server.ts wiring", () => {
  const src = readFileSync(new URL("./guard.server.ts", import.meta.url), "utf8");

  it("reads only the caller's active memberships", () => {
    assert.match(src, /\.from\("organization_members"\)[\s\S]*?\.eq\("user_id", userId\)[\s\S]*?\.eq\("active", true\)/);
  });

  it("reads the one `nectar` feature key from the registry and the agency settings", () => {
    assert.match(src, /\.from\("feature_registry"\)[\s\S]*?\.eq\("feature_key", NECTAR_FEATURE_KEY\)/);
    assert.match(src, /\.from\("organization_features"\)[\s\S]*?\.eq\("feature_key", NECTAR_FEATURE_KEY\)/);
    assert.doesNotMatch(src, /nectar_infusion/);
  });

  it("refuses when the request has no signed-in user", () => {
    assert.match(src, /if \(!supabase \|\| !userId\) return Promise\.resolve\(nectarRefusal\("signed_out"\)\)/);
  });

  it("reads the agency's AI settings from organizations.nectar_settings, and every caller names its feature (N3)", () => {
    assert.match(src, /\.from\("organizations"\)[\s\S]*?\.select\("nectar_settings"\)[\s\S]*?\.eq\("id", orgId\)/);
    assert.match(src, /export type NectarGuardOptions = \{ orgId\?: string; feature: NectarAiFeature \| null \};/);
  });
});
