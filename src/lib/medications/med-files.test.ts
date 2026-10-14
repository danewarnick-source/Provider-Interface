import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_MEDICATION_FILE_BYTES,
  isClientMedicationFile,
  medicationFileLabel,
  medicationFilePath,
  medicationFileProblem,
  safeFileName,
} from "./med-files.ts";

const org = "11111111-1111-1111-1111-111111111111";
const client = "22222222-2222-2222-2222-222222222222";
const id = "33333333-3333-3333-3333-333333333333";

describe("med-files", () => {
  it("builds a path under the agency and client", () => {
    const path = medicationFilePath({
      orgId: org,
      clientId: client,
      kind: "label",
      id,
      fileName: "My bottle (1).jpg",
    });
    assert.equal(path, `${org}/${client}/medications/label-${id}-My-bottle-1-.jpg`);
    assert.ok(isClientMedicationFile(path, org, client));
    assert.equal(medicationFileLabel(path), "My-bottle-1-.jpg");
  });

  it("cleans file names", () => {
    assert.equal(safeFileName("../../etc/passwd"), "etc-passwd");
    assert.equal(safeFileName("///"), "file");
  });

  it("refuses paths outside this client's medication folder", () => {
    assert.ok(!isClientMedicationFile(`${org}/other/medications/x.pdf`, org, client));
    assert.ok(!isClientMedicationFile(`${org}/${client}/medications/`, org, client));
    assert.ok(!isClientMedicationFile(`${org}/${client}/medications/a/../../x.pdf`, org, client));
    assert.ok(!isClientMedicationFile(`${org}/${client}/x.pdf`, org, client));
  });

  it("checks type and size", () => {
    assert.equal(medicationFileProblem("image/jpeg", 1000), null);
    assert.equal(medicationFileProblem("application/pdf", 1000), null);
    assert.match(medicationFileProblem("text/html", 1000) ?? "", /photo/);
    assert.match(medicationFileProblem("image/png", MAX_MEDICATION_FILE_BYTES + 1) ?? "", /10 MB/);
    assert.match(medicationFileProblem("image/png", 0) ?? "", /empty/);
  });
});

describe("med-files.functions.ts wiring", () => {
  const src = readFileSync(new URL("./med-files.functions.ts", import.meta.url), "utf8");
  const fns: Array<[string, string]> = [
    ["uploadMedicationFile", "edit_medical"],
    ["openMedicationFile", "view_medical"],
    ["printMedicationList", "view_medical"],
  ];

  it("guards every function before it touches storage or data", () => {
    for (const [name, action] of fns) {
      assert.match(src, new RegExp(`export const ${name} = createServerFn`));
      const body = src.slice(src.indexOf(`export const ${name}`)).split("export const ")[1];
      assert.ok(
        body.includes(`guardClient(context, db, data.clientId, "${action}")`),
        `${name} uses ${action}`,
      );
    }
    assert.equal(src.match(/requireSupabaseAuth\]/g)?.length, fns.length);
    assert.match(src, /assertCanManageClient\(/);
  });

  it("checks the file belongs to the client before signing a link", () => {
    const body = src.slice(src.indexOf("export const openMedicationFile"));
    assert.ok(body.indexOf("isClientMedicationFile") < body.indexOf("createSignedUrl"));
    assert.doesNotMatch(src, /\.remove\(|\.delete\(/);
  });
});
