import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeDb } from "./fake-db.ts";
import { aiSettingRefusal, DEFAULT_NECTAR_SETTINGS, NECTAR_AI_FEATURES } from "./guard.ts";
import {
  AI_FEATURE_TEXT,
  applySettingsPatch,
  featureToggles,
  nectarOnLabel,
  saveSettings,
  SettingsInput,
} from "./settings.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("AI settings (N6, Decision 10)", () => {
  it("lists the four features with one line each, as in the demo", () => {
    assert.deepEqual(
      NECTAR_AI_FEATURES.map((k) => AI_FEATURE_TEXT[k].label),
      ["Ask", "Shift note help", "PCSP reading", "Summary drafts"],
    );
    for (const k of NECTAR_AI_FEATURES) {
      assert.ok(AI_FEATURE_TEXT[k].help.endsWith("."), k);
      assert.doesNotMatch(AI_FEATURE_TEXT[k].help, /\bstaff\b/, "says team members");
    }
    assert.equal(nectarOnLabel("True North"), "Nectar is on for True North");
    assert.equal(nectarOnLabel(null), "Nectar is on for your agency");
  });

  it("applies only true/false values for known settings", () => {
    const off = applySettingsPatch(DEFAULT_NECTAR_SETTINGS, { ask: false });
    assert.deepEqual(off, { ...DEFAULT_NECTAR_SETTINGS, ask: false });
    const ignored = applySettingsPatch(DEFAULT_NECTAR_SETTINGS, {
      enabled: "no",
      billing: false,
    } as never);
    assert.deepEqual(ignored, DEFAULT_NECTAR_SETTINGS);
  });

  it("Ask works only while Nectar and Ask are both on; features lock while Nectar is off", () => {
    // The guard askNectar and getAskStatus use reads the settings saved here.
    const askOff = applySettingsPatch(DEFAULT_NECTAR_SETTINGS, { ask: false });
    const nectarOff = applySettingsPatch(DEFAULT_NECTAR_SETTINGS, { enabled: false });
    assert.equal(aiSettingRefusal(DEFAULT_NECTAR_SETTINGS, "ask"), null);
    assert.equal(aiSettingRefusal(askOff, "ask"), "Ask is turned off for your agency.");
    assert.equal(aiSettingRefusal(nectarOff, "ask"), "Nectar is turned off for your agency.");
    const locked = featureToggles({ ...DEFAULT_NECTAR_SETTINGS, enabled: false });
    assert.ok(locked.every((f) => !f.on && f.disabled));
    const open = featureToggles({ ...DEFAULT_NECTAR_SETTINGS, note_help: false });
    assert.deepEqual(
      open.map((f) => [f.key, f.on, f.disabled]),
      [
        ["ask", true, false],
        ["note_help", false, false],
        ["pcsp_reading", true, false],
        ["summary_drafts", true, false],
      ],
    );
  });

  it("needs a change and a real agency id", () => {
    assert.throws(() => SettingsInput.parse({ organizationId: ORG }), /Choose a setting/);
    assert.throws(() => SettingsInput.parse({ organizationId: "x", ask: false }));
    assert.deepEqual(SettingsInput.parse({ organizationId: ORG, enabled: false }), {
      organizationId: ORG,
      enabled: false,
    });
  });

  it("saves to organizations.nectar_settings for this agency, keeping other stored keys", async () => {
    const d = new FakeDb({
      tables: {
        organizations: [
          { id: ORG, nectar_settings: { ...DEFAULT_NECTAR_SETTINGS, rollout: "pilot" } },
          { id: "other", nectar_settings: DEFAULT_NECTAR_SETTINGS },
        ],
      },
    });
    const saved = await saveSettings(d.client, ORG, { ask: false });
    assert.deepEqual(saved, { ...DEFAULT_NECTAR_SETTINGS, ask: false });
    assert.deepEqual(d.tables.organizations![0]!.nectar_settings, {
      ...DEFAULT_NECTAR_SETTINGS,
      ask: false,
      rollout: "pilot",
    });
    assert.deepEqual(d.tables.organizations![1]!.nectar_settings, DEFAULT_NECTAR_SETTINGS);
    const update = d.callsTo("organizations").find((c) => c.op === "update")!;
    assert.deepEqual(update.filters, [["eq", "id", ORG]]);
  });

  it("a stored value that isn't settings counts as all on before the change", async () => {
    const d = new FakeDb({ tables: { organizations: [{ id: ORG, nectar_settings: null }] } });
    const saved = await saveSettings(d.client, ORG, { enabled: false });
    assert.deepEqual(saved, { ...DEFAULT_NECTAR_SETTINGS, enabled: false });
  });

  it("says so when the save is refused (no row back, as RLS does for a non-owner)", async () => {
    const missing = new FakeDb({ tables: { organizations: [] } });
    await assert.rejects(saveSettings(missing.client, ORG, { ask: false }), /Could not save/);
    const failing = new FakeDb({ failing: ["organizations"] });
    await assert.rejects(saveSettings(failing.client, ORG, { ask: false }), /Could not save/);
  });
});
