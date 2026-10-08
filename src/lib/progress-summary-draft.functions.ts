import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { assertBedrockConfigured, gatewayFetch } from "@/lib/ai-bedrock.server";
import {
  emptyEditorState,
  groupEvidence,
  readEditorState,
  type SummaryEditorState,
  type SummaryEvidence,
} from "@/lib/progress-summary-doc";
import { summaryRequirements } from "@/lib/progress-summary-requirements";
import {
  buildSuggestions,
  dismissKey,
  fieldGoalId,
  fieldText,
  goalsNeedingAreaCheck,
  readReviewState,
  takeSuggestion,
  textFields,
  type FieldKey,
  type SummaryReviewState,
} from "@/lib/progress-summary-review";
import { loadSummarySource } from "@/lib/progress-summary-source.server";

/**
 * Nectar on a periodic progress summary: a helper, never a gate. Nectar
 * advises, the person decides, and nothing here blocks Finalize.
 *
 *  - draftSummaryBoxes: "Draft with Nectar" on one box, or "Draft all
 *    boxes". Each box is rewritten alone into clean prose using only what
 *    is in that box (plus that goal's records). Rewrites are suggestions
 *    (Accept / x), never written into the editor; a rewrite with a date or
 *    number that is not in its box or its goal's records is dropped, one
 *    that loses a typed date or number cannot be accepted in one click, and
 *    repeated sentences are removed (buildSuggestions).
 *  - runSummaryNectar: the optional "Review with Nectar". Goal progress is
 *    checked in code (goalCovered); only a goal with zero overlap is put to
 *    Nectar, as one yes/no question, and only a "no" shows a reminder.
 *    The reminder wording is fixed in code.
 *  - updateSummaryReview: Accept a suggestion, or hide a reminder / card
 *    with the x. The hidden keys are saved with the review.
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

function parseJson(raw: string): Record<string, unknown> {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return tryParse(raw) ?? tryParse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "") ?? {};
}


const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

function evidenceBlock(list: readonly SummaryEvidence[], n = 600): string {
  return list.length
    ? list
        .map((e) => `- [${e.date}] ${e.who ?? e.kind}${e.code ? ` (${e.code})` : ""}: ${clip(e.text, n)}`)
        .join("\n")
    : "(none)";
}

/** Nectar's per-box text from {"general","goals":{id},"incidentNotes"}. */
function proposedFields(parsed: Record<string, unknown>, fields: readonly FieldKey[]): Map<FieldKey, string> {
  const out = new Map<FieldKey, string>();
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const goals = (parsed.goals && typeof parsed.goals === "object" ? parsed.goals : {}) as Record<string, unknown>;
  for (const f of fields) {
    const id = fieldGoalId(f);
    const t = id !== null ? str(goals[id]) : str(parsed[f]);
    if (t) out.set(f, t);
  }
  return out;
}

const NEVER_INVENT = `- NEVER add facts. No new events, activities, dates, numbers, names, medications, staff actions, conversations, milestones, regressions or quotes. Every date and number you write must already be in that box's text or that goal's records.`;

const STYLE = `- Past tense, third person, professional, objective. Plain sentences in short organized paragraphs: no headings, bullets, markdown or code fences.`;

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

/** Draft one box, or every box listed: a suggestion per box, shown with Accept and an x. */
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
  .handler(async ({ data, context }): Promise<{ review: SummaryReviewState; rejected: number; skipped: number }> => {
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
    const grouped = groupEvidence(goals, source.evidence);
    const known = new Set<FieldKey>(textFields(goals.map((g) => g.id)));
    const recordsFor = (f: FieldKey): string[] => {
      const id = fieldGoalId(f);
      return id === null ? [] : (grouped.byGoal[id] ?? []).map((e) => `${e.date} ${e.text}`);
    };
    // A box is drafted when it has text (a goal box with only records is drafted from them).
    const wanted = [...new Set(data.fields)].filter((f) => known.has(f));
    const boxes = wanted.filter((f) => fieldText(editor, f).trim() || recordsFor(f).length > 0);
    const skipped = data.fields.length - boxes.length;

    const prior = readReviewState((row.draft_source ?? {}).review);
    const now = new Date().toISOString();
    let suggestions = prior.suggestions;
    let rejected = 0;

    if (boxes.length) {
      const reqs = summaryRequirements(services);
      const firstName = client.first_name?.trim() || "the person";
      const goalOf = (f: FieldKey) => goals.find((g) => g.id === fieldGoalId(f));
      const boxBlock = boxes
        .map((f) => {
          const g = goalOf(f);
          const text = clip(fieldText(editor, f), 6000) || "(empty)";
          if (g) {
            return `BOX "${f}" — progress on the goal: ${g.goal}
  Text: ${text}
  Records for this goal:
${evidenceBlock(grouped.byGoal[g.id] ?? []).replace(/^/gm, "  ")}`;
          }
          return `BOX "${f}" — ${f === "general" ? "general notes" : "incident notes"}
  Text: ${text}`;
        })
        .join("\n\n");
      const system = `You are NECTAR, helping an admin tidy boxes of a Utah DSPD ${reqs.cadence ?? "quarterly"} progress summary. You advise; the admin decides.

RULES:
- Rewrite EACH box on its own into clean, professional, organized prose, using only what is in that box (and, for a goal box, that goal's records listed under it).
- You may make reasonable inferences the way shift-note coaching does: group related items, connect cause and effect that the text already implies, use clearer wording. Keep EVERY fact written (same dates, numbers and names), including plans for next period.
- Do NOT move text from one box to another. Do not write about other boxes.
- Never write the same sentence twice.
${NEVER_INVENT}
${STYLE} Use ${firstName}'s first name naturally.
- Output STRICT JSON only: {"general":"…","goals":{"<goal id>":"…"},"incidentNotes":"…"}. Include only the boxes listed below; a goal's id is the part of the box name after "goal:".`;
      const user = `PERSON: ${client.first_name} ${client.last_name}\nSERVICES: ${services.join(", ") || "(none)"}\n\n${boxBlock}`;
      const proposed = proposedFields(parseJson(await callAI(system, user, data.organizationId)), boxes);
      const current = new Map<FieldKey, string>([...known].map((f) => [f, fieldText(editor, f)]));
      const built = buildSuggestions({
        current,
        proposed,
        extra: recordsFor,
        order: textFields(goals.map((g) => g.id)),
      });
      rejected = built.rejected.length;
      const redone = new Set(boxes);
      suggestions = [...prior.suggestions.filter((s) => !redone.has(s.field)), ...built.suggestions];
    }

    const review: SummaryReviewState = { ...prior, reviewedAt: now, suggestions };
    const typedAny = [...known].some((f) => fieldText(editor, f).trim());
    const status = suggestions.length ? "draft" : typedAny ? "in_review" : row.status;
    await saveReview(sb, row, { status, plan_id: source.planId }, editor, review, {
      checked_at: now,
      evidence_count: source.evidence.length,
      incident_ids: grouped.incidents.map((i) => i.id),
      plan_id: source.planId,
      services,
      sources_checked: ["daily_logs(approved)", "evv_timesheets(shift notes)", "shift_reports(submitted)", "incident_reports"],
    });
    return { review, rejected, skipped };
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

/** Accept a suggestion, or hide a reminder or suggestion card with the x. Neither blocks anything. */
export const updateSummaryReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        summaryId: z.string().uuid(),
        op: z.discriminatedUnion("op", [
          z.object({ op: z.literal("accept"), field: fieldKey }),
          z.object({ op: z.literal("dismiss"), key: z.string().min(1).max(400) }),
        ]),
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
    const patch: Record<string, unknown> = {};
    let review: SummaryReviewState;
    if (data.op.op === "accept") {
      review = takeSuggestion(prior, data.op.field);
      patch.drafted_at = new Date().toISOString();
      patch.drafted_by = userId;
    } else {
      review = dismissKey(prior, data.op.key);
    }
    await saveReview(sb, row, patch, null, review);
    return { review };
  });
