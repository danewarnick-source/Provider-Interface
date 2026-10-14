import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { effectiveCategories } from "../access/can.ts";
import { CATEGORY_BY_ID, categoryChoices } from "../access/categories.ts";
import {
  canDeletePeople,
  deleteReasonText,
  hasServiceHistory,
  historyBlockedMessage,
  historySummary,
  nameConfirmed,
  parseHistory,
} from "./delete-rules.ts";

const EMPTY = {
  shifts: 0,
  punches: 0,
  notes: 0,
  daily_logs: 0,
  med_passes: 0,
  billing: 0,
  signed_documents: 0,
  summaries: 0,
};

describe("history check", () => {
  it("allows delete only when every kind of record is zero", () => {
    assert.equal(hasServiceHistory(parseHistory(EMPTY)), false);
    for (const key of Object.keys(EMPTY)) {
      assert.equal(hasServiceHistory(parseHistory({ ...EMPTY, [key]: 1 })), true, key);
    }
  });

  it("fails closed on a missing or unreadable count", () => {
    assert.equal(hasServiceHistory(parseHistory(null)), true);
    const { shifts: _drop, ...noShifts } = EMPTY;
    assert.equal(hasServiceHistory(parseHistory(noShifts)), true);
    assert.equal(hasServiceHistory(parseHistory({ ...EMPTY, punches: "x" })), true);
  });

  it("reads counts that come back as strings", () => {
    assert.equal(parseHistory({ ...EMPTY, shifts: "3" }).shifts, 3);
  });

  it("summarizes only the kinds that exist, singular and plural", () => {
    const h = parseHistory({ ...EMPTY, shifts: 3, daily_logs: 1 });
    assert.equal(historySummary(h), "3 shifts, 1 daily log");
  });

  it("points clients to Discharge and team members to Deactivate", () => {
    assert.match(
      historyBlockedMessage("client", "Pat Example"),
      /^Pat Example has service records.*Use Discharge/,
    );
    assert.match(
      historyBlockedMessage("member", "Sam Sample"),
      /Use Deactivate to end their employment/,
    );
  });
});

describe("Delete people permission", () => {
  it("owners have it by default", () => {
    assert.equal(canDeletePeople(effectiveCategories({ level: "owner" })), true);
  });

  it("admins don't, unless a preset or override turns it on", () => {
    const admin = effectiveCategories({ level: "admin", presetCategories: { clients: "edit" } });
    assert.equal(canDeletePeople(admin), false);
    const granted = effectiveCategories({
      level: "admin",
      presetCategories: { clients: "edit" },
      overrides: { delete_people: "edit" },
    });
    assert.equal(canDeletePeople(granted), true);
  });

  it("is an On/Off setting that isn't owner-only", () => {
    const cat = CATEGORY_BY_ID.delete_people;
    assert.deepEqual(categoryChoices(cat), ["off", "edit"]);
    assert.notEqual(cat.ownerOnly, true);
  });

  it("is checked on the server before the delete runs", () => {
    const fn = readFileSync(new URL("./delete.functions.ts", import.meta.url), "utf8");
    assert.match(fn, /"delete_people", "edit"/);
    assert.match(fn, /soft_delete_person/);
    assert.match(fn, /restore_deleted_person/);
  });
});

describe("name confirmation", () => {
  it("matches the full name ignoring case and extra spaces", () => {
    assert.equal(nameConfirmed("  pat   EXAMPLE ", "Pat Example"), true);
  });

  it("refuses a partial, different or empty name", () => {
    assert.equal(nameConfirmed("Pat", "Pat Example"), false);
    assert.equal(nameConfirmed("Pat Exampel", "Pat Example"), false);
    assert.equal(nameConfirmed("", ""), false);
  });
});

describe("delete reason", () => {
  it("uses the chip, or the Other text", () => {
    assert.equal(deleteReasonText("Duplicate", ""), "Duplicate");
    assert.equal(deleteReasonText("other", "  Test person "), "Test person");
    assert.equal(deleteReasonText("other", "  "), null);
    assert.equal(deleteReasonText("", ""), null);
  });
});

describe("no hard deletes of people", () => {
  const root = new URL("../../", import.meta.url).pathname;

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return files(p);
      return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
    });
  }

  it("the MCP table_write tool (and its delete operation) is gone", () => {
    assert.equal(existsSync(join(root, "lib/mcp")), false);
    const hit = files(root).find((f) => /table_write/.test(readFileSync(f, "utf8")));
    assert.equal(hit, undefined);
  });

  it("nothing calls .delete() on clients or organization_members", () => {
    const re = /from\(\s*["'](clients|organization_members)["']\s*\)\s*\.delete\(/;
    const hit = files(root).find((f) => re.test(readFileSync(f, "utf8")));
    assert.equal(hit, undefined);
  });
});
