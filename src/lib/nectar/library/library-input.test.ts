import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AudienceInput,
  CreateDraftInput,
  NewVersionInput,
  SaveDraftInput,
  StaffRecordInput,
  UploadUrlInput,
} from "./library-input.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const upload = {
  path: `${ORG}/library/x-a.pdf`,
  fileName: "a.pdf",
  mimeType: "application/pdf",
  sizeBytes: 10,
};

describe("library server function inputs (N3)", () => {
  it("a new document has a name, an agency group, and typed text or a file (not both)", () => {
    const base = { organizationId: ORG, title: "Grievance Policy", group: "agency" };
    assert.equal(CreateDraftInput.safeParse({ ...base, text: "Purpose\n\nText" }).success, true);
    assert.equal(CreateDraftInput.safeParse({ ...base, upload }).success, true);
    assert.equal(CreateDraftInput.safeParse(base).success, false);
    assert.equal(CreateDraftInput.safeParse({ ...base, text: "x", upload }).success, false);
    assert.equal(CreateDraftInput.safeParse({ ...base, text: "   " }).success, false);
    assert.equal(CreateDraftInput.safeParse({ ...base, title: " ", text: "x" }).success, false);
    assert.equal(
      CreateDraftInput.safeParse({ ...base, group: "state", text: "x" }).success,
      false,
      "state rules come from PI",
    );
    assert.equal(
      CreateDraftInput.safeParse({ ...base, text: "x", reviewDue: "10/13/2027" }).success,
      false,
    );
  });

  it("saving a draft may change any field; a new version needs new text or a new file", () => {
    assert.equal(
      SaveDraftInput.safeParse({ organizationId: ORG, documentId: DOC, ownerName: null }).success,
      true,
    );
    assert.equal(
      SaveDraftInput.safeParse({ organizationId: ORG, documentId: DOC, text: "a", upload }).success,
      false,
    );
    assert.equal(
      NewVersionInput.safeParse({ organizationId: ORG, documentId: DOC }).success,
      false,
    );
    assert.equal(
      NewVersionInput.safeParse({ organizationId: ORG, documentId: DOC, upload }).success,
      true,
    );
  });

  it("who it's for takes the two options; a record is for one person or yourself", () => {
    assert.deepEqual(
      AudienceInput.parse({ organizationId: ORG, documentId: DOC, audienceAll: true }).userIds,
      [],
    );
    assert.equal(
      AudienceInput.safeParse({
        organizationId: ORG,
        documentId: DOC,
        audienceAll: false,
        userIds: ["x"],
      }).success,
      false,
    );
    assert.equal(StaffRecordInput.safeParse({ organizationId: ORG }).success, true);
  });

  it("an upload URL is for a file up to 25 MB", () => {
    assert.equal(
      UploadUrlInput.safeParse({ organizationId: ORG, fileName: "a.pdf", sizeBytes: 1 }).success,
      true,
    );
    assert.equal(
      UploadUrlInput.safeParse({
        organizationId: ORG,
        fileName: "a.pdf",
        sizeBytes: 26 * 1024 * 1024,
      }).success,
      false,
    );
  });
});
