import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeCodesForClient,
  activeCodesForClients,
  isActiveCodeRow,
  loadActiveCodes,
  loadActiveCodesAsService,
} from "./codes.ts";

const NOW = new Date(2026, 9, 6, 12); // Oct 6 2026, local

const rows = [
  { client_id: "a", service_code: "sln", service_end_date: null },
  { client_id: "a", service_code: "HHS", service_end_date: "2026-12-31" },
  { client_id: "a", service_code: "DSI", service_end_date: "2026-10-06" }, // ends today → closed
  { client_id: "a", service_code: " SLN ", service_end_date: null }, // duplicate
  { client_id: "b", service_code: "SEI", service_end_date: "2026-01-01" }, // ended
  { client_id: "c", service_code: "", service_end_date: null }, // blank
];

describe("isActiveCodeRow", () => {
  it("is open with no end date or an end date after today", () => {
    assert.equal(isActiveCodeRow({ service_end_date: null }, "2026-10-06"), true);
    assert.equal(isActiveCodeRow({ service_end_date: "2026-10-07" }, "2026-10-06"), true);
    assert.equal(isActiveCodeRow({ service_end_date: "2026-10-06" }, "2026-10-06"), false);
  });
});

describe("activeCodesForClient", () => {
  it("returns sorted, upper-cased, distinct active codes", () => {
    assert.deepEqual(activeCodesForClient(rows, "a", NOW), ["HHS", "SLN"]);
  });
  it("returns [] when every authorization has ended or none exist", () => {
    assert.deepEqual(activeCodesForClient(rows, "b", NOW), []);
    assert.deepEqual(activeCodesForClient(rows, "zzz", NOW), []);
  });
});

describe("activeCodesForClients", () => {
  it("maps every client with an active code", () => {
    const m = activeCodesForClients(rows, NOW);
    assert.deepEqual(m.get("a"), ["HHS", "SLN"]);
    assert.equal(m.has("b"), false);
    assert.deepEqual(m.get("c"), []);
  });
});

describe("loadActiveCodes", () => {
  it("calls client_active_codes once and fills missing clients with []", async () => {
    const calls: unknown[] = [];
    const sb = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push([fn, args]);
        return {
          data: [
            { client_id: "a", service_code: "SLN", service_end_date: null },
            { client_id: "a", service_code: "DSI", service_end_date: "2000-01-01" },
          ],
          error: null,
        };
      },
    };
    const m = await loadActiveCodes(sb, ["a", "x", "a"]);
    assert.deepEqual(m.get("a"), ["SLN"]);
    assert.deepEqual(m.get("x"), []);
    assert.deepEqual(calls, [["client_active_codes", { _client_ids: ["a", "x"] }]]);
  });
  it("skips the call for an empty client list", async () => {
    const m = await loadActiveCodes({ rpc: () => { throw new Error("no call"); } }, []);
    assert.equal(m.size, 0);
  });
  it("throws the database error", async () => {
    const sb = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    await assert.rejects(loadActiveCodes(sb, ["a"]), /boom/);
  });
});

describe("loadActiveCodesAsService", () => {
  it("reads client_billing_codes for the clients and keeps only active codes", async () => {
    const calls: string[] = [];
    const q = {
      select: (c: string) => (calls.push(`select ${c}`), q),
      in: (k: string, v: string[]) => (calls.push(`in ${k}=${v.join(",")}`), q),
      then: (res: (v: unknown) => unknown) =>
        res({
          data: [
            { client_id: "a", service_code: "hhs", service_end_date: null },
            { client_id: "a", service_code: "SEI", service_end_date: "2001-01-01" },
          ],
          error: null,
        }),
    };
    const m = await loadActiveCodesAsService({ from: (t: string) => (calls.push(`from ${t}`), q) }, ["a", "b"]);
    assert.deepEqual(m.get("a"), ["HHS"]);
    assert.deepEqual(m.get("b"), []);
    assert.deepEqual(calls, ["from client_billing_codes", "select client_id, service_code, service_end_date", "in client_id=a,b"]);
  });
});
