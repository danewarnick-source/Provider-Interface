import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { assertBedrockConfigured, gatewayFetch } from "@/lib/ai-bedrock.server";
import {
  emptyEditorState,
  filledIncidents,
  groupEvidence,
  manualIncidentLine,
  readEditorState,
  type SummaryEditorState,
  type SummaryEvidence,
} from "@/lib/progress-summary-doc";
import { requirementLines, summaryRequirements } from "@/lib/progress-summary-requirements";
import {
  acceptSuggestion,
  buildSuggestions,
  cleanNectarFindings,
  dismissFinding,
  fieldText,
  findingNeedsReason,
  goalField,
  keepMine,
  readReviewState,
  textFields,
  type FieldKey,
  type SummaryFinding,
  type SummaryReviewState,
} from "@/lib/progress-summary-review";
import { loadSummarySource } from "@/lib/progress-summary-source.server";

/**
 * Nectar on a periodic progress summary — the same posture as the clock-out
 * shift note: Nectar advises, the person decides.
 *
 * One action. With records in the period (approved daily logs, submitted
 * shift notes / reports, incident reports) Nectar DRAFTS: it combines what
 * the person typed with the records into one narrative per goal, general
 * and incidents. With no records it REVIEWS what was typed. Either way:
 *   - rewrites are suggestions per field (Accept / Keep mine), never written
 *     into the editor; a rewrite with a date or number found in neither the
 *     typed text nor the records is dropped, one that loses a typed date or
 *     number is flagged and cannot be accepted in one click
 *     (buildSuggestions);
 *   - Nectar's findings (wrong goal, off-goal, outside the period, missing
 *     required content, vague wording) are saved with the review; the
 *     checks that need no AI run live in the editor (summaryChecks).
 * Findings block Finalize until fixed or kept with "Keep as is"
 * (updateSummaryReview records who and when).
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

/** Nectar's per-field text from {"general","goals":{id},"incidentNotes"}. */
function proposedFields(parsed: Record<string, unknown>, fields: readonly FieldKey[]): Map<FieldKey, string> {
  const out = new Map<FieldKey, string>();
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const goals = (parsed.goals && typeof parsed.goals === "object" ? parsed.goals : {}) as Record<string, unknown>;
  for (const f of fields) {
    const id = f.startsWith("goal:") ? f.slice(5) : null;
    const t = id !== null ? str(goals[id]) : str(parsed[f]);
    if (t) out.set(f, t);
  }
  return out;
}

const NEVER_INVENT = `- NEVER invent progress, events, dates, numbers, medications, staff actions, conversations, milestones, regressions or quotes. Every date and number you write must already be in the person's text or the records.`;

const STYLE = `- Past tense, third person, professional, objective. Plain sentences: no headings, bullets, markdown or code fences.`;

export const runSummaryNectar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        summaryId: z.string().uuid(),
        /** The editor's fields as the person has them now (typed, unsaved text included). */
        editor: z
          .record(z.string(), z.unknown())
          .refine((v) => JSON.stringify(v).length <= 200_000, "Summary is too long."),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ mode: "draft" | "review"; review: SummaryReviewState; rejected: number }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again.");
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const editor = readEditorState(data.editor) ?? emptyEditorState();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: row, error: rErr } = await sb
      .from("client_progress_summaries")
      .select("id, client_id, period_start, period_end, service_codes, summary_kind, include_goal_progress, status, draft_source")
      .eq("id", data.summaryId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) throw new Error("Summary not found");
    if (row.summary_kind !== "narrative") throw new Error("Financial statements are not reviewed by Nectar.");
    if (row.status === "finalized") throw new Error("This summary is finalized.");

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
    const manual = filledIncidents(editor.incidents);
    const fields = textFields(goals.map((g) => g.id));
    const current = new Map<FieldKey, string>(fields.map((f) => [f, fieldText(editor, f)]));
    const mode: "draft" | "review" = source.evidence.length > 0 ? "draft" : "review";
    const reqs = summaryRequirements(services);
    const cites = new Map(reqs.items.map((r) => [r.id, r.cite]));
    const goalIds = new Set(goals.map((g) => g.id));
    const records = [
      ...source.evidence.map((e) => `${e.date} ${e.text}`),
      ...goals.flatMap((g) => [g.goal, ...g.supports.flatMap((s) => [s.support, s.details])]),
      ...manual.map(manualIncidentLine),
    ];
    const firstName = client.first_name?.trim() || "the person";
    const typedAny = [...current.values()].some((t) => t.trim()) || manual.length > 0;
    const prior = readReviewState((row.draft_source ?? {}).review);
    const now = new Date().toISOString();

    const typedBlock = (map: ReadonlyMap<FieldKey, string>) =>
      [
        `GENERAL NOTES (field "general"):\n${clip(map.get("general") ?? "", 6000) || "(empty)"}`,
        ...goals.map((g) =>
          [
            `GOAL [${g.id}] (field "goal:${g.id}"): ${g.goal}`,
            ...g.supports.map((x) => `  Support: ${clip(x.support, 300)}${x.details ? ` — details: ${clip(x.details, 300)}` : ""}`),
            `  Progress text: ${clip(map.get(goalField(g.id)) ?? "", 3000) || "(empty)"}`,
          ].join("\n"),
        ),
        `INCIDENT NOTES (field "incidentNotes"):\n${clip(map.get("incidentNotes") ?? "", 3000) || "(empty)"}`,
      ].join("\n\n");

    const header = `PERSON: ${client.first_name} ${client.last_name}
SERVICES: ${services.join(", ") || "(none)"}
PERIOD: ${row.period_start} to ${row.period_end} (${reqs.cadence ?? "quarterly"} summary)`;

    // ── Draft: typed text + records → one narrative per field ──
    let suggestionsFrom = current;
    let proposed = new Map<FieldKey, string>();
    if (mode === "draft") {
      const system = `You are NECTAR, writing a Utah DSPD ${reqs.cadence ?? "quarterly"} progress summary for the state Support Coordinator, from what the admin typed and the period's records.

RULES:
- Combine the admin's text and the records into ONE well-written narrative per field. Keep EVERY fact the admin typed (same dates, numbers and names), including plans for next period.
- Put each fact under the goal it is about. Text in the general notes that is about a goal moves to that goal. The general notes keep: services provided, ${firstName}'s status and response to services, notable events, and anything not about one goal.
- Never write the same sentence twice, in one field or across fields.
${NEVER_INVENT}
${STYLE} Use ${firstName}'s first name naturally.
- Output STRICT JSON only: {"general":"…","goals":{"<goal id>":"…"},"incidentNotes":"…"}. Use "" for a field with nothing to say. Only goal ids listed below.`;
      const user = `${header}

WHAT THE ADMIN TYPED
${typedBlock(current)}

RECORDS THIS PERIOD
${goals.map((g) => `For goal [${g.id}] (${grouped.byGoal[g.id]?.length ?? 0}):\n${evidenceBlock(grouped.byGoal[g.id] ?? [])}`).join("\n\n")}
Not tied to a goal (${grouped.general.length}):
${evidenceBlock(grouped.general)}
Incident reports (${grouped.incidents.length}):
${evidenceBlock(grouped.incidents, 400)}
Incidents entered by the admin (${manual.length}):
${manual.length ? manual.map((m) => `- ${manualIncidentLine(m)}`).join("\n") : "(none)"}`;
      proposed = proposedFields(parseJson(await callAI(system, user, data.organizationId)), fields);
    }

    // ── Review: placement, relevance, period, required contents, wording ──
    const reviewSystem = `You are NECTAR, reviewing a Utah DSPD ${reqs.cadence ?? "quarterly"} progress summary before an admin finalizes it. You advise; the admin decides.

Check each field and report findings:
- "misplaced": text in the general notes (or under the wrong goal) that is about a goal — set "moveTo" to that goal id.
- "off_goal": goal text not related to that goal or its supports.
- "out_of_period": events described as outside ${row.period_start} to ${row.period_end} without a written date (e.g. "last summer").
- "missing_required": a required item below that the summary does not cover — set "requirement" to its id.
- "vague": subjective or non-objective wording (e.g. "did good", "was fine", "had a great quarter") — suggest what observable detail to add, without inventing it.
Each finding: {"field":"general"|"goal:<id>"|"incidentNotes","kind":"…","quote":"exact words from that field, or empty","message":"one short plain sentence","suggestion":"optional short fix","moveTo":"<goal id> or omit","requirement":"<id> or omit"}.

REQUIRED CONTENTS (DHHS91172):
${requirementLines(reqs.items).join("\n") || "(none)"}

Also return "rewrites": for a field that is in the wrong place or hard to read, the field rewritten using ONLY the admin's own words and facts — move goal text from the general notes into the goal, reword for clarity, keep every fact, add nothing. Omit fields that need no change.
${NEVER_INVENT}
${STYLE}
- Output STRICT JSON only: {"findings":[…],"rewrites":{"general":"…","goals":{"<goal id>":"…"},"incidentNotes":"…"}}.`;

    let findings: SummaryFinding[] = [];
    let rejected = 0;
    let suggestions: SummaryReviewState["suggestions"] = [];
    if (mode === "draft") {
      const built = buildSuggestions({ current, proposed, records, order: fields });
      suggestions = built.suggestions;
      rejected = built.rejected.length;
      const after = new Map(current);
      for (const s of suggestions) after.set(s.field, s.text);
      suggestionsFrom = after;
    }
    const reviewText = [...suggestionsFrom.values()].some((t) => t.trim());
    if (reviewText) {
      const parsed = parseJson(
        await callAI(reviewSystem, `${header}\n\nTHE SUMMARY\n${typedBlock(suggestionsFrom)}`, data.organizationId),
      );
      const pending = new Set(suggestions.map((s) => s.field));
      findings = cleanNectarFindings(parsed.findings, suggestionsFrom, goalIds, cites).map((f) =>
        pending.has(f.field) ? { ...f, onSuggestion: true } : f,
      );
      if (mode === "review") {
        const rewrites = (parsed.rewrites && typeof parsed.rewrites === "object" ? parsed.rewrites : {}) as Record<string, unknown>;
        const built = buildSuggestions({
          current,
          proposed: proposedFields(rewrites, fields),
          records,
          order: fields,
        });
        suggestions = built.suggestions;
        rejected = built.rejected.length;
      }
    }

    const review: SummaryReviewState = {
      mode,
      reviewedAt: now,
      findings,
      suggestions,
      dismissals: prior.dismissals,
    };
    const status = suggestions.length ? "draft" : typedAny ? "in_review" : mode === "review" ? "no_source" : row.status;
    const { error } = await sb
      .from("client_progress_summaries")
      .update({
        draft_source: {
          ...(row.draft_source ?? {}),
          editor,
          review,
          no_source: mode === "review",
          checked_at: now,
          evidence_count: source.evidence.length,
          incident_ids: grouped.incidents.map((i) => i.id),
          plan_id: source.planId,
          services,
          sources_checked: ["daily_logs(approved)", "evv_timesheets(shift notes)", "shift_reports(submitted)", "incident_reports"],
        },
        status,
        plan_id: source.planId,
      })
      .eq("id", row.id)
      .neq("status", "finalized");
    if (error) throw new Error(error.message);
    return { mode, review, rejected };
  });

const fieldKey = z.string().regex(/^(general|incidentNotes|goal:.+|incident:.+)$/) as unknown as z.ZodType<FieldKey>;

/** Accept / Keep mine on a suggestion, or "Keep as is" on a finding (who and when recorded). */
export const updateSummaryReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        summaryId: z.string().uuid(),
        op: z.discriminatedUnion("op", [
          z.object({ op: z.literal("accept"), field: fieldKey }),
          z.object({ op: z.literal("keep"), field: fieldKey }),
          z.object({ op: z.literal("dismiss"), key: z.string().min(1).max(400), reason: z.string().max(500).nullable() }),
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
    const { data: row, error: rErr } = await sb
      .from("client_progress_summaries")
      .select("id, status, draft_source")
      .eq("id", data.summaryId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) throw new Error("Summary not found");
    if (row.status === "finalized") throw new Error("This summary is finalized.");
    const draftSource = (row.draft_source ?? {}) as Record<string, unknown>;
    let review = readReviewState(draftSource.review);
    const patch: Record<string, unknown> = {};
    const now = new Date().toISOString();

    if (data.op.op === "accept") {
      const editor = readEditorState(draftSource.editor) ?? emptyEditorState();
      review = acceptSuggestion(editor, review, data.op.field).review;
      patch.drafted_at = now;
      patch.drafted_by = userId;
    } else if (data.op.op === "keep") {
      review = keepMine(review, data.op.field);
    } else {
      const { data: me } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      const byName = [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() || null;
      review = dismissFinding(
        review,
        { key: data.op.key, needsReason: findingNeedsReason(data.op.key) },
        { by: userId, byName, at: now },
        data.op.reason,
      );
    }
    const { error } = await sb
      .from("client_progress_summaries")
      .update({ ...patch, draft_source: { ...draftSource, review } })
      .eq("id", row.id)
      .neq("status", "finalized");
    if (error) throw new Error(error.message);
    return { review };
  });
