import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLibraryPathForOrg,
  LIBRARY_BUCKET,
  LIBRARY_MAX_BYTES,
  libraryFileKind,
  libraryObjectPath,
  parseOutcome,
  uploadProblem,
} from "./uploads.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Knowledge base uploads (N3)", () => {
  it("go to the nectar-documents bucket under the agency's library folder", () => {
    assert.equal(LIBRARY_BUCKET, "nectar-documents");
    const path = libraryObjectPath(ORG, "Grievance Policy (v2).pdf", "id-1");
    assert.equal(path, `${ORG}/library/id-1-Grievance_Policy__v2_.pdf`);
    assert.equal(isLibraryPathForOrg(path, ORG), true);
  });

  it("accept back only a path from this agency's library folder", () => {
    assert.equal(isLibraryPathForOrg(`${OTHER}/library/id-1-a.pdf`, ORG), false);
    assert.equal(isLibraryPathForOrg(`${ORG}/library/`, ORG), false);
    assert.equal(isLibraryPathForOrg(`${ORG}/library/../${OTHER}/x.pdf`, ORG), false);
    assert.equal(isLibraryPathForOrg(`${ORG}/other/x.pdf`, ORG), false);
  });

  it("take PDF, Word and text files up to 25 MB", () => {
    assert.equal(uploadProblem({ fileName: "a.pdf", sizeBytes: 10 }), null);
    assert.equal(uploadProblem({ fileName: "a.DOCX", sizeBytes: 10 }), null);
    assert.equal(uploadProblem({ fileName: "a.txt", sizeBytes: 10 }), null);
    assert.match(uploadProblem({ fileName: "a.png", sizeBytes: 10 }) ?? "", /PDF, Word or text/);
    assert.match(
      uploadProblem({ fileName: "a.pdf", sizeBytes: LIBRARY_MAX_BYTES + 1 }) ?? "",
      /25 MB/,
    );
  });

  it("know how to read each kind; an old .doc keeps its file with no text", () => {
    assert.equal(libraryFileKind("a.pdf", null), "pdf");
    assert.equal(libraryFileKind("a.docx", null), "docx");
    assert.equal(libraryFileKind("a.md", null), "text");
    assert.equal(libraryFileKind("blob", "application/pdf"), "pdf");
    assert.equal(libraryFileKind("a.doc", "application/msword"), null);
  });

  it("mark a file with no readable text as no_text, not parsed", () => {
    assert.deepEqual(parseOutcome("  \n\u0000 "), { raw_text: "", parse_status: "no_text" });
    assert.deepEqual(parseOutcome(" Purpose\nText "), {
      raw_text: "Purpose\nText",
      parse_status: "parsed",
    });
  });
});
