// Source checks for the progress summary server side: drafting never blanks
// the summary, autosave keeps the editor's fields and never touches a
// finalized summary, finalize keeps the finalized document, and the evidence
// comes from approved logs, submitted shift notes and incident reports.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FINALIZE_COLUMNS } from "./progress-summary-reopen.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("Nectar draft / review (progress-summary-draft.functions.ts)", () => {
  const src = read("./progress-summary-draft.functions.ts");
  it("drafts when the period has records, reviews what was typed when it has none — no early exit", () => {
    assert.match(src, /source\.evidence\.length > 0 \? "draft" : "review"/);
    assert.doesNotMatch(src, /your text is unchanged/);
    assert.doesNotMatch(src, /mergeEditorDraft/);
  });
  it("rewrites are validated suggestions, never written into the editor", () => {
    assert.match(src, /buildSuggestions\(/);
    assert.doesNotMatch(src, /draft_content/, "Nectar never writes draft_content (autosave does)");
    const run = src.slice(src.indexOf("export const runSummaryNectar"), src.indexOf("export const updateSummaryReview"));
    assert.match(run, /editor,\n\s+review,/, "the editor is saved as typed alongside the review");
  });
  it("Keep as is records who and when, and refuses a finalized summary", () => {
    assert.match(src, /dismissFinding\(/);
    assert.match(src, /by: userId, byName, at: now/);
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
  it("finalize is refused before the period's last day and while a finding is open", () => {
    assert.match(fin, /await assertCanFinalize\(/);
    assert.match(src, /if \(!canFinalizeSummary\(row\.period_end\)\) throw new Error\(finalizeOpensMessage/);
    assert.match(src, /finalizeBlockers\(/);
  });
  it("reopen keeps the finalized copy and clears every finalize column through reopenPatch", () => {
    const re = src.slice(src.indexOf("export const reopenSummary"));
    assert.match(re, /requireOrgMembership\(supabase, userId, data\.organizationId, "admin"\)/);
    assert.match(re, /select\(`status, draft_source, \$\{FINALIZE_COLUMNS\.join/);
    assert.match(re, /reopenPatch\(/);
    assert.doesNotMatch(re, /\.delete\(/);
  });
  it("finalize and the attestations only write columns reopen clears", () => {
    const writers = [
      "export const markSummaryCompleted",
      "export const attestSummaryUpiEntered",
      "export const attestSummarySentToSc",
      "export const finalizeSummary",
    ].map((start) => {
      const from = src.indexOf(start);
      assert.ok(from > 0, start);
      return src.slice(from, src.indexOf("\nexport const", from + 1));
    });
    const keys = new Set<string>();
    for (const w of writers) {
      for (const m of w.matchAll(/\b([a-z_]+(?:_at|_by|_by_name|_content)):/g)) keys.add(m[1]);
    }
    keys.delete("updated_at");
    assert.ok(keys.size >= 10);
    for (const k of keys) {
      assert.ok(FINALIZE_COLUMNS.includes(k as (typeof FINALIZE_COLUMNS)[number]), `reopen must clear ${k}`);
    }
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
  it("team members: every active member assigned to the client, joined in JS", () => {
    assert.match(src, /from\("staff_assignments"\)\s*\.select\("staff_id"\)/);
    assert.match(src, /from\("organization_members"\)\s*\.select\("user_id, active, deleted_at, end_date"\)/);
    assert.match(src, /assignedTeamMemberNames\(/);
    assert.doesNotMatch(src, /organization_members\([^)]*profiles|profiles\([^)]*organization_members/);
  });
  it("names come from profiles in a separate query (no embed)", () => {
    assert.match(src, /from\("profiles"\)\s*\.select\("id, first_name, last_name"\)/);
  });
});
