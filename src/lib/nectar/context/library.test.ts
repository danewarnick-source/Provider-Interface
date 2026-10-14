import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminCaller,
  agencyDb,
  DOC,
  ORG,
  OTHER_STAFF,
  staffCaller,
} from "../engine/ask-fixtures.ts";
import { libraryDocsFor, loadLibraryDocs, type LibraryRow } from "./library.ts";

function row(id: string, extra: Partial<LibraryRow> = {}): LibraryRow {
  return {
    id,
    title: id,
    version: 1,
    library_group: "agency",
    library_status: "published",
    superseded_by: null,
    archived_at: null,
    audience_all: true,
    policy_assigned_users: [],
    document_type: "policy",
    authoritative_kind: "provider_policy",
    ...extra,
  };
}

describe("library documents Nectar may answer from (Decisions 2, 5, 7)", () => {
  const rows = [
    row("for-all"),
    row("for-me", { audience_all: false, policy_assigned_users: [staffCaller.userId] }),
    row("for-someone-else", { audience_all: false, policy_assigned_users: [OTHER_STAFF] }),
    row("nobody-checked", { audience_all: false, policy_assigned_users: [] }),
    row("draft", { library_status: "draft" }),
    row("archived", { library_status: "archived", archived_at: "2026-09-01" }),
    row("replaced", { superseded_by: "newer" }),
    row("contract", { library_group: "reference", document_type: "contract" }),
    row("provider-contract", {
      library_group: "reference",
      authoritative_kind: "provider_contract",
    }),
    row("budget", { document_type: "1056_budget" }),
    row("not-library", { library_group: null }),
  ];
  const ids = (docs: Array<{ id: string }>) => docs.map((d) => d.id);

  it("a team member gets only current published documents meant for them, never contracts or billing", () => {
    assert.deepEqual(ids(libraryDocsFor(rows, staffCaller)), ["for-all", "for-me"]);
  });

  it("an agency-wide admin in the admin view gets every current published document", () => {
    assert.deepEqual(ids(libraryDocsFor(rows, adminCaller)), [
      "for-all",
      "for-me",
      "for-someone-else",
      "nobody-checked",
      "contract",
      "provider-contract",
      "budget",
    ]);
  });

  it("the admin view counts only for an agency-wide admin; anyone else gets their own documents", () => {
    assert.deepEqual(
      ids(libraryDocsFor(rows, { ...adminCaller, agencyAdmin: false, userId: staffCaller.userId })),
      ["for-all", "for-me"],
    );
    assert.deepEqual(ids(libraryDocsFor(rows, { ...staffCaller, agencyAdmin: true })), [
      "for-all",
      "for-me",
    ]);
  });

  it("reads the caller's agency's published, current company documents", async () => {
    const db = agencyDb();
    const docs = await loadLibraryDocs(db.client, staffCaller);
    assert.deepEqual(ids(docs), [DOC.forAll]);
    assert.deepEqual(docs[0], {
      id: DOC.forAll,
      title: "Medication Policy",
      version: 1,
      group: "agency",
    });
    assert.deepEqual(db.callsTo("nectar_documents")[0]!.filters, [
      ["eq", "organization_id", ORG],
      ["eq", "owner_kind", "company"],
      ["eq", "library_status", "published"],
      ["is", "superseded_by", null],
      ["not.is", "library_group", null],
    ]);
    await assert.rejects(
      loadLibraryDocs(agencyDb({ failing: ["nectar_documents"] }).client, staffCaller),
      /Could not load/,
    );
  });
});
