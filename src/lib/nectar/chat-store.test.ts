import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { chatKey, createChatStore } from "./chat-store.ts";

type Turn = { id: string };

describe("the Ask conversation for this visit (N6)", () => {
  it("is keyed by person and agency, and needs both", () => {
    assert.equal(chatKey("u1", "o1"), "u1:o1");
    assert.equal(chatKey(null, "o1"), null);
    assert.equal(chatKey("u1", undefined), null);
  });

  it("starts empty, adds turns, and keeps the same object until it changes", () => {
    const store = createChatStore<Turn>();
    const empty = store.get("u1:o1");
    assert.deepEqual(empty, { turns: [], pending: false });
    assert.equal(store.get("u1:o1"), empty, "stable for useSyncExternalStore");
    store.update("u1:o1", (s) => ({ turns: [...s.turns, { id: "a" }], pending: true }));
    const after = store.get("u1:o1");
    assert.deepEqual(after, { turns: [{ id: "a" }], pending: true });
    assert.equal(store.get("u1:o1"), after);
  });

  it("never shows one person's or agency's conversation to another", () => {
    const store = createChatStore<Turn>();
    store.update("u1:o1", () => ({ turns: [{ id: "a" }], pending: false }));
    assert.deepEqual(store.get("u2:o1").turns, []);
    assert.deepEqual(store.get("u1:o2").turns, []);
    // A late answer lands in the conversation it was asked in.
    store.update("u1:o2", () => ({ turns: [{ id: "b" }], pending: false }));
    store.update("u1:o1", (s) => ({ turns: [...s.turns, { id: "c" }], pending: false }));
    assert.deepEqual(store.get("u1:o1").turns, [{ id: "a" }, { id: "c" }]);
    assert.deepEqual(store.get("u1:o2").turns, [{ id: "b" }]);
  });

  it("keeps only the latest turns and conversations", () => {
    const store = createChatStore<Turn>({ maxTurns: 3, maxKeys: 2 });
    store.update("k1", () => ({
      turns: ["1", "2", "3", "4", "5"].map((id) => ({ id })),
      pending: false,
    }));
    assert.deepEqual(
      store.get("k1").turns.map((t) => t.id),
      ["3", "4", "5"],
    );
    store.update("k2", () => ({ turns: [{ id: "x" }], pending: false }));
    store.update("k3", () => ({ turns: [{ id: "y" }], pending: false }));
    assert.deepEqual(store.get("k1").turns, [], "the oldest conversation was dropped");
    assert.equal(store.get("k3").turns.length, 1);
  });

  it("tells subscribers about changes, clears, and stops telling them after unsubscribe", () => {
    const store = createChatStore<Turn>();
    let calls = 0;
    const off = store.subscribe(() => (calls += 1));
    store.update("k", () => ({ turns: [{ id: "a" }], pending: false }));
    store.clear("k");
    assert.deepEqual(store.get("k").turns, []);
    store.clear("k"); // nothing to clear: no call
    off();
    store.update("k", () => ({ turns: [], pending: false }));
    assert.equal(calls, 2);
  });

  it("keeps the conversation in memory only, never in browser storage", () => {
    for (const rel of ["./chat-store.ts", "../../components/nectar/use-nectar-chat.ts"]) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8");
      assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/, rel);
      assert.doesNotMatch(src, /console\./, rel);
    }
  });
});
