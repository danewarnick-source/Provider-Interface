import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ARCHIVED_FIELD_MESSAGE,
  CUSTOM_FIELD_ARCHIVE_CHUNK,
  FIELD_KIND_MISMATCH_MESSAGE,
  FIELD_NOT_FOUND_MESSAGE,
  assertDefinitionWritable,
  categoryForFieldKind,
  chunkIds,
  customFieldArchiveCopy,
} from "./custom-fields-archive.ts";

describe("chunkIds", () => {
  it("returns empty for no ids", () => {
    assert.deepEqual(chunkIds([]), []);
  });

  it("dedupes and drops blanks", () => {
    assert.deepEqual(chunkIds(["a", "a", "", "b"]), [["a", "b"]]);
  });

  it("splits at the chunk size", () => {
    const ids = Array.from({ length: CUSTOM_FIELD_ARCHIVE_CHUNK + 2 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, CUSTOM_FIELD_ARCHIVE_CHUNK);
    assert.deepEqual(chunks[1], ["id-80", "id-81"]);
  });
});

describe("assertDefinitionWritable", () => {
  it("needs the definition in this agency", () => {
    assert.throws(() => assertDefinitionWritable(null, "client"), { message: FIELD_NOT_FOUND_MESSAGE });
  });
  it("needs the same kind (a team member field can't be set on a client)", () => {
    assert.throws(
      () => assertDefinitionWritable({ entity_kind: "employee", archived_at: null }, "client"),
      { message: FIELD_KIND_MISMATCH_MESSAGE },
    );
  });
  it("refuses new values on an archived field", () => {
    assert.throws(
      () => assertDefinitionWritable({ entity_kind: "client", archived_at: "2026-10-01T00:00:00Z" }, "client"),
      { message: ARCHIVED_FIELD_MESSAGE },
    );
  });
  it("passes a live field of the right kind", () => {
    assert.doesNotThrow(() => assertDefinitionWritable({ entity_kind: "employee", archived_at: null }, "employee"));
  });
});

describe("categoryForFieldKind", () => {
  it("client fields use Clients, team member fields use the roster", () => {
    assert.equal(categoryForFieldKind("client"), "clients");
    assert.equal(categoryForFieldKind("employee"), "staff_roster");
  });
});

describe("customFieldArchiveCopy", () => {
  it("says values stay and the field can be restored", () => {
    const copy = customFieldArchiveCopy(["Pharmacy"]);
    assert.equal(copy.title, 'Archive "Pharmacy"?');
    assert.match(copy.body, /every client/);
    assert.match(copy.body, /stay/);
    assert.match(copy.body, /restore it/);
    assert.doesNotMatch(copy.body, /cannot be undone/);
  });

  it("names a bulk archive and caps the listed labels", () => {
    const copy = customFieldArchiveCopy(["A", "B", "C", "D", "E", "F"]);
    assert.equal(copy.title, "Archive 6 custom fields?");
    assert.match(copy.body, /"A"/);
    assert.match(copy.body, /and 1 more/);
    assert.match(copy.body, /restore them/);
  });
});

describe("client custom field archive wiring", () => {
  const panel = ["more-details-card.tsx", "more-details-parts.tsx"]
    .map((f) =>
      readFileSync(
        new URL(`../../../components/clients/profile/details/${f}`, import.meta.url),
        "utf8",
      ),
    )
    .join("\n");
  const fns = readFileSync(new URL("./custom-fields.functions.ts", import.meta.url), "utf8");

  it("selects rows, select-all, archive selected and restore on the panel", () => {
    assert.match(panel, /Select all/);
    assert.match(panel, /Archive selected/);
    assert.match(panel, /Restore field/);
    assert.match(panel, /<Checkbox/);
    assert.match(panel, /archiveCustomFieldDefinitions/);
    assert.match(panel, /restoreCustomFieldDefinition/);
    assert.match(panel, /createCustomFieldDefinition/);
    assert.match(panel, /setCustomFieldValue/);
    assert.match(panel, /AlertDialog/);
    assert.doesNotMatch(panel, /deleteCustomFieldDefinition/);
    assert.doesNotMatch(panel, /[\u{1F300}-\u{1FAFF}]/u);
  });

  it("archives instead of deleting, and every write checks scope", () => {
    assert.doesNotMatch(fns, /\.delete\(\)/);
    assert.doesNotMatch(fns, /deleteCustomFieldDefinition/);
    assert.match(fns, /archived_at: now/);
    assert.match(fns, /archived_at: null/);
    assert.match(fns, /assertCanManageClient\(/);
    assert.match(fns, /access_can_see_staff/);
    assert.match(fns, /assertDefinitionWritable\(def, data\.entityKind\)/);
  });
});
