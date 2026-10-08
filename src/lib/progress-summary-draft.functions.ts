import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { assertBedrockConfigured, gatewayFetch } from "@/lib/ai-bedrock.server";
import { MONTHLY_SUMMARY_REQUIRED_FIELDS } from "@/lib/progress-summaries";
import {
  filledIncidents,
  groupEvidence,
  manualIncidentLine,
  mergeEditorDraft,
  personText,
  readEditorState,
  type SummaryEditorState,
  type SummaryEvidence,
} from "@/lib/progress-summary-doc";
import { loadSummarySource } from "@/lib/progress-summary-source.server";

/**
 * Nectar drafter for periodic progress summaries, on the same Bedrock gateway
 * path as draftIncidentNarrative, with the same NEVER-FABRICATE contract.
 *
 * Works field by field from the editor as the person has it now: each goal
 * with evidence (approved daily logs / submitted shift notes that addressed
 * it), the general summary, and incidents (incident reports plus the ones
 * typed in). A field with no evidence is never sent and stays as typed; a
 * field with evidence keeps the person's text and gets Nectar's evidence-based
 * text after it (mergeEditorDraft). Nothing is ever blanked out.
 */

async function callAI(system: string, user: string, orgId?: string | null): Promise<string> {
  assertBedrockConfigured();
  const res = await gatewayFetch({
    model: "bedrock",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  }, { orgId });
  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI workspace credits exhausted. Please add credits.");
  if (!res.ok) throw new Error(`AI error (${res.status}).`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}


const clip = (s: string, n: number) => truncate(s.replace(/\s+/g, " ").trim(), n);

function evidenceBlock(list: readonly SummaryEvidence[], n = 600): string {
  return list.length
    ? list.map((e) => `- [${e.date}] ${e.who ?? e.kind}${e.code ? ` (${e.code})` : ""}: ${clip(e.text, n)}`).join("\n")
    : "(none)";
}

/**
 * Drafts the summary from the period's evidence and returns the editor merged
 * with Nectar's text. Saves the merged fields with the Nectar provenance; the
 * editor's autosave then saves the document text.
 */
export const draftProgressSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        summaryId: z.string().uuid(),
        /** The editor's fields as the person has them now (typed, unsaved text included). */
        editor: z.record(z.string(), z.unknown()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ status: "draft" | "no_source"; editor: SummaryEditorState }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again.");
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const editor = readEditorState(data.editor);
    if (!editor) throw new Error("Nothing to draft.");

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
    if (row.summary_kind !== "narrative") throw new Error("Financial-statement rows are not drafted by Nectar.");
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
    const has = {
      goals: Object.fromEntries(goals.map((g) => [g.id, (grouped.byGoal[g.id] ?? []).length > 0])),
      general: source.evidence.length > 0,
      incidents: grouped.incidents.length > 0 || manual.length > 0,
    };
    const priorSource = (row.draft_source ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();

    if (!has.general && !has.incidents) {
      // Nothing to draft from: the editor stays exactly as typed.
      const typed = !!(editor.general.trim() || editor.incidentNotes.trim() || Object.values(editor.goals).some((t) => t.trim()));
      const { error } = await sb
        .from("client_progress_summaries")
        .update({
          status: typed ? "in_review" : "no_source",
          draft_source: {
            ...priorSource,
            editor,
            no_source: true,
            checked_at: now,
            sources_checked: ["daily_logs(approved)", "evv_timesheets(shift notes)", "shift_reports(submitted)", "incident_reports"],
          },
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      return { status: "no_source", editor };
    }

    const firstName = client.first_name?.trim() || "the person";
    const extraFieldGuidance = [...new Set(services.flatMap((c) => MONTHLY_SUMMARY_REQUIRED_FIELDS[c] ?? []))];
    const draftGoals = goals.filter((g) => has.goals[g.id]);
    const typed = (field: string, last: string) => personText(field, last) || "(nothing yet)";

    const system = `You are NECTAR, a Utah DSPD periodic progress-summary drafter for a record sent to the state Support Coordinator.

ABSOLUTE RULES:
- Write ONLY what the evidence below supports. NEVER invent progress, events, dates, medications, staff actions, conversations, milestones, regressions or quotes.
- Each field shows what the person already wrote. Do NOT repeat, reword or contradict it — write only the sentences the evidence ADDS. If the evidence adds nothing, return "" for that field.
- Do not invent or guess service codes.
- Past tense, third person, professional, objective. Use ${firstName}'s first name naturally. Plain sentences: no headings, bullets, markdown or code fences.
- Output STRICT JSON only: {"general":"<2–4 sentences or empty>","goals":{"<goal id>":"<1–3 sentences or empty>"},"incidentNotes":"<1–3 sentences or empty>"}. Only include goal ids listed below.${
      extraFieldGuidance.length
        ? `
- For "general", also cover each of these where the evidence supports it: ${extraFieldGuidance.join("; ")}.`
        : ""
    }`;

    const goalsBlock = draftGoals.length
      ? draftGoals
          .map((g) =>
            [
              `GOAL [${g.id}]: ${g.goal}`,
              ...g.supports.map((x) => `  Support: ${clip(x.support, 300)}${x.details ? ` — details: ${clip(x.details, 300)}` : ""}`),
              `  Person already wrote: ${typed(editor.goals[g.id] ?? "", editor.nectar.goals[g.id] ?? "")}`,
              `  Evidence (${grouped.byGoal[g.id].length}):`,
              evidenceBlock(grouped.byGoal[g.id]),
            ].join("\n"),
          )
          .join("\n\n")
      : "(no goal has evidence this period — return an empty goals object)";

    const incidentsBlock = has.incidents
      ? [
          `Incident reports (${grouped.incidents.length}):`,
          evidenceBlock(grouped.incidents, 400),
          `Entered by the admin (${manual.length}):`,
          manual.length ? manual.map((m) => `- ${manualIncidentLine(m)}`).join("\n") : "(none)",
          `Person already wrote: ${typed(editor.incidentNotes, editor.nectar.incidentNotes)}`,
        ].join("\n")
      : "(no incidents — return an empty incidentNotes)";

    const user = `PERSON: ${client.first_name} ${client.last_name}
SERVICES: ${services.join(", ") || "(none)"}
DATE RANGE: ${row.period_start} to ${row.period_end}

GENERAL SUMMARY
Person already wrote: ${typed(editor.general, editor.nectar.general)}
Evidence not tied to a goal (${grouped.general.length}):
${evidenceBlock(grouped.general)}
Evidence counts this period: ${source.evidence.filter((e) => e.kind !== "incident").length} logs/shift notes, ${grouped.incidents.length} incident reports.

GOALS
${goalsBlock}

INCIDENTS
${incidentsBlock}`;

    const raw = await callAI(system, user, data.organizationId);
    let parsed: { general?: unknown; goals?: unknown; incidentNotes?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          /* ignore */
        }
      }
    }
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const goalTexts =
      parsed.goals && typeof parsed.goals === "object"
        ? Object.fromEntries(
            Object.entries(parsed.goals as Record<string, unknown>).filter(([id]) => has.goals[id]).map(([id, v]) => [id, str(v)]),
          )
        : {};
    if (!str(parsed.general).trim() && !str(parsed.incidentNotes).trim() && !Object.values(goalTexts).some((t) => t.trim())) {
      throw new Error("Nectar could not draft from this period's documentation — your text is unchanged.");
    }
    const merged = mergeEditorDraft(
      editor,
      { general: str(parsed.general), incidentNotes: str(parsed.incidentNotes), goals: goalTexts },
      has,
    );

    const { error } = await sb
      .from("client_progress_summaries")
      .update({
        draft_source: {
          ...priorSource,
          editor: merged,
          no_source: false,
          generated_at: now,
          evidence_count: source.evidence.length,
          incident_ids: grouped.incidents.map((i) => i.id),
          plan_id: source.planId,
          goals_drafted: draftGoals.map((g) => g.id),
          services,
        },
        drafted_at: now,
        drafted_by: userId,
        status: "draft",
        plan_id: source.planId,
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { status: "draft", editor: merged };
  });
