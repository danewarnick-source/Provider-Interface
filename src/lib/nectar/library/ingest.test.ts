import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  INGEST_FORBIDDEN_MESSAGE,
  isKnowledgeUpload,
  runIngest,
  shouldAutofillClient,
  storageObjectPath,
  textSource,
  type IngestDeps,
  type IngestInput,
} from "./ingest.ts";
import type { ParsedDocument } from "./extracted-fields.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PARENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DOC_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type Member = { level: "owner" | "admin" | "staff"; scope: "agency" | "assigned" | "self" };

function fakeDeps(opts: { member?: Member | "none"; parsed?: ParsedDocument; parseThrows?: boolean; parentVersion?: number | null; text?: string }) {
  const calls: string[] = [];
  const inserted: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const fieldRows: unknown[][] = [];
  const autofills: Array<{ clientId: string; fields: unknown[] }> = [];
  const deps: IngestDeps<{ id: string }> = {
    requireMember: async () => {
      calls.push("requireMember");
      if (opts.member === "none") throw new Error("Not a member of this organization");
      return opts.member ?? { level: "admin", scope: "agency" };
    },
    upload: async (path) => void calls.push(`upload:${path}`),
    parentVersion: async () => {
      calls.push("parentVersion");
      return opts.parentVersion === undefined ? 1 : opts.parentVersion;
    },
    markNotCurrent: async (id) => void calls.push(`markNotCurrent:${id}`),
    uploader: async () => ({ id: USER, name: "Test Admin" }),
    insertDocument: async (row) => {
      calls.push("insertDocument");
      inserted.push(row);
      return { id: DOC_ID };
    },
    updateDocument: async (_id, patch) => void updates.push(patch),
    readText: async (source) => {
      calls.push(`readText:${source}`);
      return opts.text ?? "Policy text.";
    },
    parseFields: async () => {
      calls.push("parseFields");
      if (opts.parseThrows) throw new Error("model down");
      return opts.parsed ?? { fields: [] };
    },
    insertFields: async (rows) => void fieldRows.push(rows),
    autofillClient: async (clientId, fields) => {
      autofills.push({ clientId, fields });
      return { autofilled: ["first_name"], suggested: ["diagnosis"] };
    },
    newId: () => "uuid-1",
    now: () => "2026-10-13T00:00:00.000Z",
  };
  return { deps, calls, inserted, updates, fieldRows, autofills };
}

function input(overrides: Partial<IngestInput> = {}): IngestInput {
  return {
    organizationId: ORG,
    ownerKind: "company",
    documentType: "other",
    title: "Agency policy",
    fileName: "policy file.pdf",
    mimeType: "application/pdf",
    fileBase64: Buffer.from("%PDF-1.4 test").toString("base64"),
    tags: [],
    autoParse: true,
    ...overrides,
  };
}

describe("ingest guard (N1: refused before anything is written to storage)", () => {
  for (const member of [
    { level: "staff", scope: "self" },
    { level: "staff", scope: "agency" },
    { level: "admin", scope: "assigned" },
  ] as Member[]) {
    it(`refuses a ${member.level} with ${member.scope} scope`, async () => {
      const { deps, calls, inserted } = fakeDeps({ member });
      await assert.rejects(runIngest(input(), deps), { message: INGEST_FORBIDDEN_MESSAGE });
      assert.deepEqual(calls, ["requireMember"]);
      assert.equal(inserted.length, 0);
    });
  }

  it("refuses a non-member before touching storage", async () => {
    const { deps, calls } = fakeDeps({ member: "none" });
    await assert.rejects(runIngest(input(), deps), /Not a member/);
    assert.deepEqual(calls, ["requireMember"]);
  });

  it("lets an owner (any scope) and an agency-wide admin upload", async () => {
    for (const member of [{ level: "owner", scope: "self" }, { level: "admin", scope: "agency" }] as Member[]) {
      const { deps, calls } = fakeDeps({ member });
      await runIngest(input(), deps);
      assert.equal(calls[0], "requireMember");
      assert.equal(calls[1], `upload:${ORG}/uuid-1-policy_file.pdf`);
    }
  });
});

describe("Knowledge base uploads (company / state)", () => {
  for (const ownerKind of ["company", "state"] as const) {
    it(`${ownerKind}: keeps the text, runs no client-field extraction, carries no client id`, async () => {
      const { deps, calls, inserted, updates, fieldRows, autofills } = fakeDeps({});
      const result = await runIngest(input({ ownerKind, clientId: CLIENT, documentType: "pcsp" }), deps);
      assert.ok(!calls.includes("parseFields"));
      assert.equal(fieldRows.length, 0);
      assert.equal(autofills.length, 0);
      assert.equal(inserted[0].client_id, null);
      assert.deepEqual(updates, [
        { parse_status: "parsed", parsed_at: "2026-10-13T00:00:00.000Z", raw_text: "Policy text.", parse_error: null },
      ]);
      assert.deepEqual(result, { document: { id: DOC_ID }, extracted: [] });
    });
  }

  it("a file with no readable text is marked no_text, not parsed (N3)", async () => {
    const { deps, updates } = fakeDeps({ text: "  \n " });
    await runIngest(input({ ownerKind: "company" }), deps);
    assert.equal(updates[0]?.parse_status, "no_text");
  });
});

describe("client path (unchanged apart from where autofill may run)", () => {
  const parsed: ParsedDocument = {
    document_type: "pcsp",
    fiscal_year: "FY27",
    fields: [{ field_key: "first_name", value_text: "Test", value_bool: true, value_array: ["a"] }],
  };

  it("a client-profile upload parses, stores fields and autofills the client", async () => {
    const { deps, inserted, updates, fieldRows, autofills } = fakeDeps({ parsed });
    const result = await runIngest(
      input({ ownerKind: "client", clientId: CLIENT, documentType: "pcsp", fileName: "plan.txt", mimeType: "text/plain" }),
      deps,
    );
    assert.equal(inserted[0].client_id, CLIENT);
    assert.equal(inserted[0].uploaded_by, USER);
    assert.equal(fieldRows.length, 1);
    assert.deepEqual((fieldRows[0][0] as { value_json: unknown }).value_json, { bool: true, array: ["a"] });
    assert.deepEqual(autofills.map((a) => a.clientId), [CLIENT]);
    assert.equal(updates[0].fiscal_year, "FY27");
    assert.equal(updates[0].parse_error, null);
    assert.deepEqual(result.autofilled, ["first_name"]);
    assert.deepEqual(result.suggested, ["diagnosis"]);
  });

  it("no autofill without a client id, for other owner kinds, or for other document types", async () => {
    for (const overrides of [
      { ownerKind: "client" as const, clientId: null, documentType: "pcsp" as const },
      { ownerKind: "staff" as const, clientId: CLIENT, documentType: "pcsp" as const },
      { ownerKind: "client" as const, clientId: CLIENT, documentType: "certification" as const },
    ]) {
      const { deps, autofills } = fakeDeps({ parsed: { ...parsed, document_type: overrides.documentType } });
      await runIngest(input(overrides), deps);
      assert.equal(autofills.length, 0, JSON.stringify(overrides));
    }
  });

  it("keeps a new version chain, skips unreadable formats and records parse failures", async () => {
    const chain = fakeDeps({ parentVersion: 3 });
    await runIngest(input({ ownerKind: "client", parentDocumentId: PARENT }), chain.deps);
    assert.ok(chain.calls.includes(`markNotCurrent:${PARENT}`));
    assert.equal(chain.inserted[0].version, 4);

    const image = fakeDeps({});
    await runIngest(input({ ownerKind: "client", fileName: "scan.png", mimeType: "image/png" }), image.deps);
    assert.deepEqual(image.updates, [{ parse_status: "skipped", parse_error: "OCR not yet enabled for this format" }]);

    const broken = fakeDeps({ parseThrows: true });
    const result = await runIngest(input({ ownerKind: "client" }), broken.deps);
    assert.equal(result.parseError, "model down");
    assert.deepEqual(broken.updates, [{ parse_status: "failed", parse_error: "model down" }]);

    const noParse = fakeDeps({});
    await runIngest(input({ autoParse: false }), noParse.deps);
    assert.ok(!noParse.calls.some((c) => c.startsWith("readText")));
    assert.equal(noParse.inserted[0].parse_status, "skipped");
  });
});

describe("ingest helpers", () => {
  it("classify uploads and files", () => {
    assert.equal(isKnowledgeUpload("company"), true);
    assert.equal(isKnowledgeUpload("state"), true);
    assert.equal(isKnowledgeUpload("client"), false);
    assert.equal(shouldAutofillClient("client", CLIENT, "1056_budget"), true);
    assert.equal(shouldAutofillClient("company", CLIENT, "pcsp"), false);
    assert.equal(storageObjectPath(ORG, "a b/c.pdf", "x"), `${ORG}/x-a_b_c.pdf`);
    assert.equal(textSource(null, "notes.MD"), "text");
    assert.equal(textSource("application/pdf", "x"), "pdf");
    assert.equal(textSource("image/jpeg", "x.jpg"), null);
  });

  it("ingest.server.ts checks membership on the request's client and uploads to the nectar-documents bucket", () => {
    const src = readFileSync(new URL("./ingest.server.ts", import.meta.url), "utf8");
    assert.match(src, /requireMember: \(\) => requireOrgMembership\(supabase, userId, organizationId\)/);
    assert.match(src, /const BUCKET = "nectar-documents";/);
  });
});
