import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClientFileCards, type ClientFileFacts } from "./file.ts";
import { documentExpiresOn, requiredDocuments, suggestedExpiry } from "./file-required.ts";

const now = new Date("2026-09-10T12:00:00");

function facts(overrides: Partial<ClientFileFacts> = {}): ClientFileFacts {
  return {
    codes: ["HHS", "DSI"],
    photoPath: null,
    photoTakenOn: null,
    isOwnGuardian: true,
    grievanceOk: false,
    planEndDate: null,
    docs: [],
    belongingsOn: null,
    supportStrategiesOk: false,
    supportStrategiesDueAt: null,
    housemateOnFile: false,
    housemateDueAt: null,
    summaries: [],
    hasPbaAccount: false,
    ...overrides,
  };
}

const byKey = (rows: ReturnType<typeof requiredDocuments>) => new Map(rows.map((r) => [r.key, r]));

describe("requiredDocuments", () => {
  it("lists the documents the client's codes need, missing until uploaded", () => {
    const rows = byKey(requiredDocuments("c1", facts(), now));
    for (const key of ["1056", "grievance", "medical_exam", "dental_exam", "room_board"]) {
      assert.equal(rows.get(key)?.status, "missing", key);
      assert.ok(rows.get(key)?.docType, key);
    }
    assert.equal(rows.has("lease"), false);
    assert.equal(rows.has("guardian"), false);
    assert.equal(rows.get("photograph")?.docType, null);
    assert.ok(rows.get("photograph")?.href?.includes("section=profile"));
  });

  it("needs guardian papers only when the client isn't their own guardian", () => {
    assert.ok(byKey(requiredDocuments("c1", facts({ isOwnGuardian: false }), now)).has("guardian"));
  });

  it("uses the document's own expiry date", () => {
    const docs = [
      {
        id: "d1",
        document_type: "medical_exam",
        uploaded_at: "2026-01-05T00:00:00Z",
        expires_on: "2026-09-12",
        file_name: "exam.pdf",
      },
      {
        id: "d2",
        document_type: "dental_exam",
        uploaded_at: "2026-01-05T00:00:00Z",
        expires_on: "2026-09-01",
      },
      { id: "d3", document_type: "room_board_agreement", uploaded_at: "2026-01-05T00:00:00Z" },
    ];
    const rows = byKey(requiredDocuments("c1", facts({ docs }), now));
    assert.equal(rows.get("medical_exam")?.status, "due_soon");
    assert.equal(rows.get("medical_exam")?.dueOn, "2026-09-12");
    assert.equal(rows.get("medical_exam")?.current?.id, "d1");
    assert.equal(rows.get("dental_exam")?.status, "missing");
    assert.equal(rows.get("room_board")?.status, "on_file");
    assert.equal(rows.get("room_board")?.dueOn, null);
  });

  it("expires yearly documents a year after upload when no date was set", () => {
    assert.equal(
      documentExpiresOn(
        { document_type: "medical_exam", uploaded_at: "2025-09-01T10:00:00Z" },
        true,
      ),
      "2026-08-31",
    );
    assert.equal(
      documentExpiresOn({ document_type: "lease", uploaded_at: "2025-09-01T10:00:00Z" }, false),
      null,
    );
    assert.equal(suggestedExpiry("dental_exam", "2026-09-10"), "2027-09-09");
    assert.equal(suggestedExpiry("guardian", "2026-09-10"), null);
  });

  it("shows the newest upload and counts the grievance acknowledgment", () => {
    const docs = [
      { id: "old", document_type: "1056_budget", uploaded_at: "2025-07-01T00:00:00Z" },
      { id: "new", document_type: "1056_budget", uploaded_at: "2026-07-01T00:00:00Z" },
    ];
    const rows = byKey(requiredDocuments("c1", facts({ docs, grievanceOk: true }), now));
    assert.equal(rows.get("1056")?.current?.id, "new");
    assert.equal(rows.get("grievance")?.status, "on_file");
  });
});

describe("expired documents stop counting on the file cards", () => {
  it("drops an expired exam from the clinical/legal card", () => {
    const exam = (type: string, expires_on: string | null) => ({
      document_type: type,
      expires_on,
      uploaded_at: "2026-01-01T00:00:00Z",
    });
    const ok = buildClientFileCards(
      "c1",
      facts({ docs: [exam("medical_exam", null), exam("dental_exam", null)] }),
      now,
    );
    assert.equal(ok.find((c) => c.key === "clinical_legal")?.status, "on_file");
    const expired = buildClientFileCards(
      "c1",
      facts({ docs: [exam("medical_exam", "2026-09-01"), exam("dental_exam", null)] }),
      now,
    );
    assert.equal(expired.find((c) => c.key === "clinical_legal")?.status, "missing");
  });
});
