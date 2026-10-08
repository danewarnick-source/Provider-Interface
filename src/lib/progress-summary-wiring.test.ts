// Source checks for the progress summary server side: drafting never blanks
// the summary, autosave keeps the editor's fields and never touches a
// finalized summary, finalize keeps the finalized document, and the evidence
// comes from approved logs, submitted shift notes and incident reports.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("Nectar draft (progress-summary-draft.functions.ts)", () => {
  const src = read("./progress-summary-draft.functions.ts");
  it("drafts from the editor as typed and merges, never writing empty text over it", () => {
    assert.match(src, /editor: z\.record/);
    assert.match(src, /mergeEditorDraft\(/);
    assert.doesNotMatch(
      src,
      /draft_content/,
      "the draft never writes draft_content (autosave does)",
    );
    assert.doesNotMatch(src, /goalId/, "no per-goal drafting");
  });
  it("with no evidence it saves the editor unchanged and never calls Nectar", () => {
    const guard = src.indexOf("if (!has.general && !has.incidents)");
    const ai = src.indexOf("await callAI(system");
    assert.ok(guard > 0 && guard < ai, "the no-evidence return comes before the Nectar call");
    assert.match(src.slice(guard, ai), /editor,\n[\s\S]*return \{ status: "no_source", editor \}/);
  });
  it("refuses a finalized summary", () => {
    assert.match(src, /row\.status === "finalized"/);
  });
});

describe("autosave and finalize (progress-summaries.functions.ts)", () => {
  const src = read("./progress-summaries.functions.ts");
  const save = src.slice(
    src.indexOf("export const saveSummaryDraft"),
    src.indexOf("export const finalizeSummary"),
  );
  const fin = src.slice(src.indexOf("export const finalizeSummary"));
  it("saves the text and the editor's fields, never on a finalized summary", () => {
    assert.match(save, /editor: editorInput/);
    assert.match(save, /editor: readEditorState\(data\.editor\)/);
    assert.match(save, /\.neq\("status", "finalized"\)/);
  });
  it("finalize keeps the finalized document for its PDF", () => {
    assert.match(fin, /final_doc: data\.doc/);
  });
  it("the editor loads saved fields, or reads an older text draft back into fields", () => {
    assert.match(src, /readEditorState\(draftSource\.editor\) \?\?\s+editorFromLegacyText/);
  });
});

describe("evidence (progress-summary-source.server.ts)", () => {
  const src = read("./progress-summary-source.server.ts");
  it("approved logs, submitted (not denied) shift notes, submitted shift reports, incidents involving the client", () => {
    assert.match(src, /from\("daily_logs"\)[\s\S]*?\.eq\("status", "approved"\)/);
    assert.match(
      src,
      /from\("evv_timesheets"\)[\s\S]*?clock_out_timestamp", "is", null\)[\s\S]*?\.is\("denied_at", null\)/,
    );
    assert.match(src, /from\("shift_reports"\)[\s\S]*?submitted_at", "is", null\)/);
    assert.match(src, /incidentInvolvesClientOr\(row\.client_id\)/);
  });
  it("names come from profiles in a separate query (no embed)", () => {
    assert.match(src, /from\("profiles"\)\s*\.select\("id, first_name, last_name"\)/);
    assert.doesNotMatch(src, /organization_members/);
  });
});
