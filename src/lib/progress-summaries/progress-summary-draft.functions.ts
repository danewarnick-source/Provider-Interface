// Server functions for Nectar on a progress summary: draft one box or all boxes,
// and run or update the review. Advisory only; never blocks Finalize.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { assertBedrockConfigured, gatewayFetch } from "@/lib/ai-bedrock.server";
import { emptyEditorState, readEditorState, type SummaryEditorState } from "@/lib/progress-summaries/progress-summary-doc";
import { clip, parseJson, planDraft } from "@/lib/progress-summaries/progress-summary-draft-prompt";
import { summaryRequirements } from "@/lib/progress-summaries/progress-summary-requirements";
import {
  dismissKey,
  fieldText,
  goalsNeedingAreaCheck,
  readReviewState,
  textFields,
  type BoxDraft,
  type DraftFailure,
  type FieldKey,
  type SummaryReviewState,
} from "@/lib/progress-summaries/progress-summary-review";
import { loadSummarySource } from "@/lib/progress-summaries/progress-summary-source.server";

/**
 * Nectar on a periodic progress summary: a helper, never a gate. Nectar
 * advises, the person decides, and nothing here blocks Finalize.
 *
 *  - draftSummaryBoxes: "Draft with Nectar" on one box, or "Draft all
 *    boxes". Each box is drafted alone as a summary of the whole period
 *    (by theme and trend; no dates, names or note-by-note retelling) using
 *    only what is in that box plus its records: a goal's shift notes and
 *    daily logs, the period's incident reports and admin-added incidents
 *    for the incident box, every note in the period for the general
 *    notes. The prompt and the fact checks are planDraft
 *    (progress-summary-draft-prompt.ts). The drafts go back to the editor,
 *    which writes each into its box with an Undo (the autosave saves it).
 *    A draft that fails the fact checks comes back as a failure and the box
 *    is left unchanged.
 *  - runSummaryNectar: the optional "Review with Nectar". Goal progress is
 *    checked in code (goalCovered); only a goal with zero overlap is put to
 *    Nectar, as one yes/no question, and only a "no" shows a reminder.
 *    The reminder wording is fixed in code.
 *  - updateSummaryReview: hide a reminder with the x. The hidden keys are
 *    saved with the review.
 */

async function callAI(system: string, user: string, orgId?: string | null): Promise<string> {
  assertBedrockConfigured();
  const res = await gatewayFetch(
    {
      model: "bedrock",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    { orgId },
  );
  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI workspace credits exhausted. Please add credits.");
  if (!res.ok) throw new Error(`AI error (${res.status}).`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

const editorInput = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v).length <= 200_000, "Summary is too long.");

const fieldKey = z.string().regex(/^(general|incidentNotes|goal:.+)$/) as unknown as z.ZodType<FieldKey>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadRow(sb: any, organizationId: string, summaryId: string) {
  const { data: row, error } = await sb
    .from("client_progress_summaries")
    .select("id, client_id, period_start, period_end, service_codes, summary_kind, include_goal_progress, status, draft_source")
    .eq("id", summaryId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Summary not found");
  if (row.summary_kind !== "narrative") throw new Error("Financial statements are not reviewed by Nectar.");
  if (row.status === "finalized") throw new Error("This summary is finalized.");
  return row;
}

async function saveReview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  row: { id: string; draft_source: unknown },
  patch: Record<string, unknown>,
  editor: SummaryEditorState | null,
  review: SummaryReviewState,
  extra: Record<string, unknown> = {},
) {
  const { error } = await sb
    .from("client_progress_summaries")
    .update({
      ...patch,
      draft_source: {
        ...((row.draft_source ?? {}) as Record<string, unknown>),
        ...(editor ? { editor } : {}),
        review,
        ...extra,
      },
    })
    .eq("id", row.id)
    .neq("status", "finalized");
  if (error) throw new Error(error.message);
}

/** Draft one box, or every box listed: each draft, or why it wasn't used. */
export const draftSummaryBoxes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        summaryId: z.string().uuid(),
        /** The editor's boxes as the person has them now (typed, unsaved text included). */
        editor: editorInput,
        fields: z.array(fieldKey).min(1).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{
    review: SummaryReviewState;
    drafts: BoxDraft[];
    failed: DraftFailure[];
    skipped: number;
  }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again.");
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const editor = readEditorState(data.editor) ?? emptyEditorState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const row = await loadRow(sb, data.organizationId, data.summaryId);

    const { data: client } = await supabase
      .from("clients")
      .select("first_name, last_name")
      .eq("id", row.client_id)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");

    const source = await loadSummarySource(sb, data.organizationId, row);
    const services = ((row.service_codes ?? []) as string[]).map((c) => c.toUpperCase());
    const goals = row.include_goal_progress ? source.goals : [];
    const plan = planDraft({
      editor,
      goals,
      evidence: source.evidence,
      fields: data.fields,
      person: { firstName: client.first_name, lastName: client.last_name },
      services,
      cadence: summaryRequirements(services).cadence ?? null,
    });

    const prior = readReviewState((row.draft_source ?? {}).review);
    const now = new Date().toISOString();
    let drafts: BoxDraft[] = [];
    let failed: DraftFailure[] = [];
    if (plan.boxes.length) {
      ({ drafts, failed } = plan.check(await callAI(plan.system, plan.user, data.organizationId)));
    }

    const review: SummaryReviewState = { ...prior, reviewedAt: now };
    const typedAny = textFields(goals.map((g) => g.id)).some((f) => fieldText(editor, f).trim());
    const status = drafts.length ? "draft" : typedAny ? "in_review" : row.status;
    const patch: Record<string, unknown> = { status, plan_id: source.planId };
    if (drafts.length) {
      patch.drafted_at = now;
      patch.drafted_by = userId;
    }
    await saveReview(sb, row, patch, editor, review, {
      checked_at: now,
      evidence_count: source.evidence.length,
      incident_ids: plan.incidentIds,
      plan_id: source.planId,
      services,
      sources_checked: ["daily_logs(approved)", "evv_timesheets(shift notes)", "shift_reports(submitted)", "incident_reports"],
    });
    return { review, drafts, failed, skipped: plan.skipped };
  });

/**
 * "Review with Nectar" (optional). Goals whose progress shares nothing with
 * the goal (decided in code) get one yes/no question each; a "no" shows a
 * fixed reminder. Anything else Nectar says is ignored.
 */
export const runSummaryNectar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ organizationId: z.string().uuid(), summaryId: z.string().uuid(), editor: editorInput }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ review: SummaryReviewState; asked: number; flagged: number }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again.");
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const editor = readEditorState(data.editor) ?? emptyEditorState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const row = await loadRow(sb, data.organizationId, data.summaryId);
    const { data: client } = await supabase
      .from("clients")
      .select("first_name")
      .eq("id", row.client_id)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    const source = await loadSummarySource(sb, data.organizationId, row);
    const goals = row.include_goal_progress ? source.goals : [];
    const check = goalsNeedingAreaCheck(
      {
        serviceCodes: row.service_codes ?? [],
        summaryKind: row.summary_kind,
        includeGoalProgress: !!row.include_goal_progress,
        goals,
        firstName: client?.first_name ?? undefined,
      },
      editor,
    );
    const system = `You answer one narrow yes/no question for a Utah DSPD progress summary. Output STRICT JSON only: {"same_area":"yes"} or {"same_area":"no"}. Answer "yes" if any of the text is in the same general area as the goal; "no" only if none of it is. Write nothing else.`;
    const answers = await Promise.all(
      check.map(async (g) => {
        const text = (editor.goals[g.id] ?? "").trim();
        const supports = (g.supports ?? []).map((x) => x.support).filter(Boolean);
        const user = `Goal: ${g.goal}${supports.length ? `\nSupports: ${supports.join("; ")}` : ""}\n\nText written under the goal:\n${clip(text, 3000)}\n\nIs any of this text the same general area as the goal?`;
        const ans = String(parseJson(await callAI(system, user, data.organizationId)).same_area ?? "")
          .trim()
          .toLowerCase();
        return { id: g.id, text, no: ans === "no" };
      }),
    );
    const offArea: Record<string, string> = {};
    for (const a of answers) if (a.no) offArea[a.id] = a.text;
    const prior = readReviewState((row.draft_source ?? {}).review);
    const review: SummaryReviewState = { ...prior, reviewedAt: new Date().toISOString(), offArea };
    await saveReview(sb, row, {}, editor, review);
    return { review, asked: check.length, flagged: Object.keys(offArea).length };
  });

/** Hide a reminder with the x. Blocks nothing. */
export const updateSummaryReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        summaryId: z.string().uuid(),
        op: z.object({ op: z.literal("dismiss"), key: z.string().min(1).max(400) }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ review: SummaryReviewState }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again.");
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const row = await loadRow(sb, data.organizationId, data.summaryId);
    const prior = readReviewState((row.draft_source ?? {}).review);
    const review = dismissKey(prior, data.op.key);
    await saveReview(sb, row, {}, null, review);
    return { review };
  });
