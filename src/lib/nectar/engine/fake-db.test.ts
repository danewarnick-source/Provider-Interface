import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeDb } from "./fake-db.ts";

// The engine tests rely on this stand-in filtering like PostgREST does.
function db() {
  return new FakeDb({
    tables: {
      rows: [
        { id: "1", org: "a", status: "published", gone: null, at: "2026-10-01T00:00:00Z" },
        { id: "2", org: "a", status: "draft", gone: "2026-01-01", at: "2026-10-05T00:00:00Z" },
        { id: "3", org: "b", status: "published", gone: null, at: "2026-10-09T00:00:00Z" },
      ],
    },
  });
}

describe("FakeDb (test support)", () => {
  it("applies eq, neq, in, is null, not is null, gte and lt", async () => {
    const ids = async (q: PromiseLike<{ data: unknown }>) =>
      ((await q).data as Array<{ id: string }>).map((r) => r.id);
    const d = db();
    assert.deepEqual(await ids(d.from("rows").select("id").eq("org", "a")), ["1", "2"]);
    assert.deepEqual(await ids(d.from("rows").select("id").neq("status", "draft")), ["1", "3"]);
    assert.deepEqual(await ids(d.from("rows").select("id").in("id", ["2", "3"])), ["2", "3"]);
    assert.deepEqual(await ids(d.from("rows").select("id").is("gone", null)), ["1", "3"]);
    assert.deepEqual(await ids(d.from("rows").select("id").not("gone", "is", null)), ["2"]);
    assert.deepEqual(
      await ids(d.from("rows").select("id").gte("at", "2026-10-02").lt("at", "2026-10-09")),
      ["2"],
    );
  });

  it("orders, limits, pages, counts and returns single rows", async () => {
    const d = db();
    const sorted = await d.from("rows").select("id").order("at", { ascending: false }).limit(2);
    assert.deepEqual(sorted.data, [{ id: "3" }, { id: "2" }]);
    assert.deepEqual((await d.from("rows").select("id").order("id").range(1, 2)).data, [
      { id: "2" },
      { id: "3" },
    ]);
    assert.equal(
      (await d.from("rows").select("id", { count: "exact", head: true }).eq("org", "a")).count,
      2,
    );
    assert.deepEqual((await d.from("rows").select("id").eq("id", "9").maybeSingle()).data, null);
    assert.ok((await d.from("rows").select("id").single()).error, "single needs exactly one row");
  });

  it("inserts, updates, logs calls and fails the tables it is told to", async () => {
    const d = new FakeDb({ tables: { rows: [] }, failing: ["blocked"] });
    const inserted = await d.from("rows").insert({ name: "x" }).select("id").single();
    assert.equal(typeof (inserted.data as { id: string }).id, "string");
    await d.from("rows").update({ name: "y" }).eq("name", "x");
    assert.equal(d.tables.rows![0]!.name, "y");
    assert.ok((await d.from("blocked").select("id")).error);
    assert.deepEqual(
      d.calls.map((c) => [c.table, c.op]),
      [
        ["rows", "insert"],
        ["rows", "update"],
        ["blocked", "select"],
      ],
    );
    assert.ok((await d.rpc("missing")).error);
  });

  it("returns the changed rows when an update asks for them (N6)", async () => {
    const d = db();
    const changed = await d
      .from("rows")
      .update({ status: "archived" })
      .eq("org", "a")
      .not("gone", "is", null)
      .select("id, status")
      .maybeSingle();
    assert.deepEqual(changed.data, { id: "2", status: "archived" });
    const none = await d.from("rows").update({ status: "x" }).eq("id", "9").select("id");
    assert.deepEqual(none.data, []);
    assert.equal(d.tables.rows!.find((r) => r.id === "1")!.status, "published");
  });
});
