import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { clearLegacyNectarStorage, LEGACY_NECTAR_STORAGE_KEYS } from "./browser-storage.ts";

function memoryStorage(seed: Record<string, string>) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const HELP_ROUTE = readFileSync(new URL("../../routes/dashboard.help.tsx", import.meta.url), "utf8");

describe("clearLegacyNectarStorage", () => {
  it("removes the old admin help question history", () => {
    assert.deepEqual([...LEGACY_NECTAR_STORAGE_KEYS], ["hive.nectar.helpHistory"]);
    const storage = memoryStorage({
      "hive.nectar.helpHistory": JSON.stringify(["an old question"]),
      "hive.activeOrgId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "hive.nectar.reportHistory": "[]",
    });
    clearLegacyNectarStorage(storage);
    assert.equal(storage.getItem("hive.nectar.helpHistory"), null);
    assert.equal(storage.getItem("hive.activeOrgId"), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    // Billing Nectar is out of this rebuild (Decision 12); its key is not ours to remove.
    assert.equal(storage.getItem("hive.nectar.reportHistory"), "[]");
  });

  it("is safe with no storage, outside a browser, or when storage throws", () => {
    assert.doesNotThrow(() => clearLegacyNectarStorage(null));
    assert.doesNotThrow(() => clearLegacyNectarStorage());
    const blocked = {
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    assert.doesNotThrow(() => clearLegacyNectarStorage(blocked));
  });
});

describe("admin help page storage (N1 Done when)", () => {
  it("clears the old key on load, before the admin gate decides", () => {
    const route = HELP_ROUTE.slice(HELP_ROUTE.indexOf("function HelpRoute()"));
    const cleanup = route.indexOf("useEffect(() => clearLegacyNectarStorage(), [])");
    const gate = route.indexOf("<RequireLevel");
    assert.ok(cleanup > 0 && gate > cleanup, "cleanup runs in HelpRoute, outside the gate");
  });

  it("never reads or writes browser storage, so no Nectar key exists after a question", () => {
    assert.doesNotMatch(HELP_ROUTE, /localStorage|sessionStorage/);
    assert.doesNotMatch(HELP_ROUTE, /hive\.nectar\./);
    const storage = memoryStorage({ "hive.nectar.helpHistory": "[\"q\"]" });
    clearLegacyNectarStorage(storage); // page load
    // Asking a question only updates React state on this page.
    assert.deepEqual([...storage.map.keys()].filter((key) => key.startsWith("hive.nectar.help")), []);
  });
});
