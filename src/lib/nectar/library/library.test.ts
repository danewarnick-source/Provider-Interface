import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authoritativeKindForGroup,
  chainRootId,
  currentVersions,
  defaultReviewDue,
  groupLibrary,
  isPastReview,
  libraryGroupForKind,
  looksCut,
  normalizeDraftText,
  parseStatusLabel,
  typedTextFileName,
} from "./library.ts";

const row = (
  id: string,
  group: string | null,
  status: string,
  title: string,
  superseded: string | null = null,
) => ({
  id,
  title,
  library_group: group,
  library_status: status,
  superseded_by: superseded,
  version: 1,
  created_at: "2026-10-01T00:00:00Z",
});

describe("library groups and the type mapping fix", () => {
  it("files a Policy / procedure upload under Agency policies, not as an unlabeled 'other'", () => {
    assert.equal(libraryGroupForKind("provider_policy"), "agency");
    assert.equal(libraryGroupForKind("tool_template"), "procedures");
    for (const kind of [
      "other",
      "provider_contract",
      "dhs_requirement",
      "state_sow",
      null,
      undefined,
    ]) {
      assert.equal(libraryGroupForKind(kind), "reference", String(kind));
    }
    assert.equal(authoritativeKindForGroup("agency"), "provider_policy");
    assert.equal(libraryGroupForKind(authoritativeKindForGroup("procedures")), "procedures");
  });

  it("lists the four groups in order, current versions only, archived last", () => {
    const groups = groupLibrary([
      row("a2", "agency", "published", "Zeta Policy"),
      row("a1", "agency", "archived", "Alpha Policy"),
      row("a0", "agency", "published", "Beta Policy", "a2"),
      row("r1", "reference", "draft", "SSA FAQ"),
      row("c1", null, "draft", "Client PCSP"),
    ]);
    assert.deepEqual(
      groups.map((g) => g.label),
      ["Agency policies", "Procedures and forms", "State rules", "Reference"],
    );
    assert.deepEqual(
      groups[0]!.documents.map((d) => d.id),
      ["a2", "a1"],
    );
    assert.deepEqual(
      groups[3]!.documents.map((d) => d.id),
      ["r1"],
    );
    assert.equal(
      currentVersions([row("c1", null, "draft", "x")]).length,
      0,
      "documents outside the library are not listed",
    );
  });
});

describe("statuses, dates and versions", () => {
  it("shows a file with no readable text as such, not as parsed", () => {
    assert.equal(parseStatusLabel("no_text"), "No readable text");
    assert.equal(parseStatusLabel("parsed"), "Parsed");
    assert.equal(parseStatusLabel("failed"), "Could not read the file");
  });

  it("sets the next review one year after publishing and flags it once passed", () => {
    assert.equal(defaultReviewDue("2026-10-13"), "2027-10-13");
    assert.equal(defaultReviewDue("2028-02-29"), "2029-03-01");
    assert.equal(isPastReview("2026-10-12", "2026-10-13"), true);
    assert.equal(isPastReview("2026-10-13", "2026-10-13"), false);
    assert.equal(isPastReview(null, "2026-10-13"), false);
  });

  it("points every version at the first version's id", () => {
    assert.equal(chainRootId({ id: "v1", parent_document_id: null }), "v1");
    assert.equal(chainRootId({ id: "v3", parent_document_id: "v1" }), "v1");
  });

  it("tidies typed text and names its file", () => {
    assert.equal(normalizeDraftText("Purpose  \r\n\r\n\r\n\r\nText\t \n"), "Purpose\n\nText");
    assert.equal(typedTextFileName("Grievance Policy (2026)"), "Grievance_Policy_2026.txt");
    assert.equal(typedTextFileName("///"), "document.txt");
  });

  it("spots text cut at the old 50,000-character limit", () => {
    assert.equal(looksCut("x".repeat(50_000)), true);
    assert.equal(looksCut("x".repeat(259_223)), false);
    assert.equal(looksCut(null), false);
  });
});
