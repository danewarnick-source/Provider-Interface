// Source checks for the progress summary server side: drafting never blanks
// the summary, autosave keeps the editor's fields and never touches a
// finalized summary, finalize keeps the finalized document, and the evidence
// comes from approved logs, submitted shift notes and incident reports.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FINALIZE_COLUMNS } from "./progress-summary-reopen.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("Nectar helper (progress-summary-draft.functions.ts)", () => {
  const src = read("./progress-summary-draft.functions.ts");
  it("drafts per box as validated suggestions, never written into the editor", () => {
    assert.match(src, /export const draftSummaryBoxes/);
    assert.match(src, /buildSuggestions\(/);
    assert.match(src, /extra: recordsFor/, "only that goal's records");
    assert.doesNotMatch(src, /draft_content/, "Nectar never writes draft_content (autosave does)");
    const run = src.slice(src.indexOf("export const draftSummaryBoxes"), src.indexOf("export const runSummaryNectar"));
    assert.match(run, /saveReview\(sb, row, \{ status, plan_id: source\.planId \}, editor, review/);
  });
  it("Review with Nectar only asks yes/no for goals with zero overlap, and only a 'no' counts", () => {
    assert.match(src, /goalsNeedingAreaCheck\(/);
    assert.match(src, /same_area/);
    assert.match(src, /ans === "no"/);
  });
  it("hiding is saved with the review; there is no Keep as is, reason or who/when", () => {
    assert.match(src, /dismissKey\(prior, data\.op\.key\)/);
    assert.doesNotMatch(src, /dismissFinding|byName|Keep as is|reason:/);
    assert.match(src, /row\.status === "finalized"/);
  });
  it("nothing from the old gate is left", () => {
    assert.doesNotMatch(src, /off_goal|misplaced|moveTo|out_of_period|"vague"|linkSuggestions|cleanNectarFindings/);
  });
});

describe("the editor never blocks (summary-editor.tsx, use-summary-editor.ts)", () => {
  const editor = read("../components/summaries/summary-editor.tsx");
  const hook = read("../components/summaries/use-summary-editor.ts");
  it("no 'resolve before Finalize' message or toast, no auto-draft on open", () => {
    assert.doesNotMatch(editor, /to resolve before Finalize|Resolve \$\{/);
    assert.doesNotMatch(hook, /openFindings|finalizeBlockers|autoDrafted/);
  });
  it("Finalize asks first when a goal is blank, then goes on", () => {
    assert.match(editor, /blank\.length \? setConfirmBlank\(true\) : setShowFinalize\(true\)/);
    assert.match(editor, /BlankGoalsDialog/);
  });
  it("Draft all boxes and per-box drafting are in the editor", () => {
    assert.match(editor, /Draft all boxes/);
    assert.match(read("../components/summaries/summary-review-panel.tsx"), /Draft with Nectar/);
  });
  it("the finalize dialog attests the summary, not the Nectar draft", () => {
    const d = read("../components/summaries/finalize-dialog.tsx");
    assert.match(d, /I reviewed this summary and take responsibility for it/);
    assert.doesNotMatch(d, /Nectar draft/);
  });
  it("the empty-records message shows once, not per goal", () => {
    assert.doesNotMatch(read("../components/summaries/summary-document.tsx"), /NO_EVIDENCE_TEXT|No approved daily logs/);
    assert.equal((editor.match(/No approved daily logs, shift notes or incidents this period/g) ?? []).length, 1);
  });
});

describe("Support Coordinator reminder (use-deadlines.tsx, NotificationBell.tsx)", () => {
  it("is built from scSendReminder and reaches the bell every day, not only on fire days", () => {
    assert.match(read("../hooks/use-deadlines.tsx"), /scSendReminder\(s, denverYmd\(now\)\)/);
    assert.match(read("../components/NotificationBell.tsx"), /i\.scReminder \|\| \(fireDay && i\.cadenceReminder\)/);
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
  it("finalize is refused before the period's last day and for nothing else", () => {
    assert.match(fin, /await assertCanFinalize\(/);
    assert.match(src, /if \(!canFinalizeSummary\(row\.period_end\)\) throw new Error\(finalizeOpensMessage/);
    assert.doesNotMatch(src, /finalizeBlockers|openFindings|readReviewState\(\(row\.draft_source/);
    assert.match(fin, /take responsibility for it/);
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

describe("saving the editor (use-summary-editor.ts, summary-editor.tsx)", () => {
  const hook = read("../components/summaries/use-summary-editor.ts");
  const ui = read("../components/summaries/summary-editor.tsx");
  it("loads the saved copy on every open, never a cached bundle", () => {
    assert.match(hook, /refetchOnMount: "always"/);
    assert.match(hook, /if \(!b \|\| !fresh \|\| editor\) return;/);
    assert.match(hook, /invalidateQueries\(\{ queryKey: \["summary", summaryId\] \}\)/);
  });
  it("has a Save button between View & download and Finalize, plus a leave warning", () => {
    const view = ui.indexOf("View &amp; download");
    const saveBtn = ui.indexOf('data-testid="summary-save"');
    const fin = ui.indexOf('data-testid="summary-finalize"');
    assert.ok(view > 0 && view < saveBtn && saveBtn < fin, String([view, saveBtn, fin]));
    assert.match(ui, /onClick=\{\(\) => void save\(\)\}/);
    assert.match(hook, /addEventListener\("beforeunload"/);
  });
});
