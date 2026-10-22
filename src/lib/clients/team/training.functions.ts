// Server functions for Client-Specific Training (Stage 2a — admin build/review/publish).
// NECTAR PRESENTS verbatim — it does NOT author care guidance.
// Support strategies: training-strategies.functions.ts. Staff side:
// training-staff.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { denverYmd } from "@/lib/denver-date";
import { type GoalView } from "../plans/plans";
import { approvalContent, editSavePatch } from "../strategies/strategies-pull";
import {
  TRAINING_MED_COLUMNS,
  trainingMedItems,
  type StaffMedication,
} from "@/lib/medications/staff-meds";
import {
  type CSTItem,
  type CSTSection,
  type CSTContent,
  ContentSchema,
  ReviewQuestionSchema,
  sid,
} from "./training-content";
import {
  planGoals,
  type AnySupabase,
  adminGuard,
  getMembership,
  guardClient,
  trainingInOrg,
  assertClientInOrg,
} from "./training-guards.server";

// ── Verbatim assembler ──────────────────────────────────────────────────────
// Pulls authoritative data and renders raw values into sections.
// NO model prose, NO interventions, NO how-to.
async function assembleVerbatim(
  supabase: AnySupabase,
  orgId: string,
  clientId: string,
): Promise<CSTContent> {
  const sections: CSTSection[] = [];

  // Identity & support overview (clients core) — used by the narrative
  // prepend; not rendered as its own section anymore (name/age is covered by
  // the narrative, goals/directions get their own dedicated sections below).
  const { data: client } = await supabase
    .from("clients")
    .select("first_name, last_name, date_of_birth, special_directions")
    .eq("id", clientId)
    .maybeSingle();
  const goalViews = await planGoals(supabase, clientId).catch(() => [] as GoalView[]);

  // a. Goals & desired outcomes ─────────────────────────────────────────────
  // The plan in effect today: each goal with its supports (and their codes).
  if (goalViews.length) {
    const items: CSTItem[] = goalViews.map((g) => ({
      kind: "kv" as const,
      label: g.goal.slice(0, 200),
      pairs: g.supports.length
        ? g.supports.map((s) => ({
            label: s.our_codes.length ? `Support (${s.our_codes.join(", ")})` : "Support",
            value: [s.support_text.trim(), s.details?.trim()].filter(Boolean).join(" — ") || "—",
          }))
        : [{ label: "Supports", value: "—" }],
    }));
    sections.push({ id: sid(), title: "Goals & desired outcomes", items });
  }

  // b. Support approach & directions ────────────────────────────────────────
  if (client?.special_directions && String(client.special_directions).trim().length) {
    sections.push({
      id: sid(),
      title: "Support approach & directions",
      items: [
        { kind: "text", label: "Special directions", value: String(client.special_directions).trim() },
      ],
    });
  }

  // c. Intake & background (most recent intake form submissions — verbatim)
  const intakeHighlights: string[] = [];
  try {
    const { data: subs } = await supabase
      .from("form_submissions")
      .select("answers, submitted_at, forms(name)")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(3);
    if (subs && subs.length) {
      const items: CSTItem[] = subs.map((s: { answers: unknown; submitted_at: string; forms: { name: string } | null }) => {
        const a = (s.answers ?? {}) as Record<string, unknown>;
        const pairs = Object.entries(a)
          .filter(([, v]) => v != null && String(v).trim().length)
          .slice(0, 12)
          .map(([k, v]) => ({ label: String(k).slice(0, 80), value: String(v).slice(0, 400) }));
        for (const p of pairs.slice(0, 6)) {
          intakeHighlights.push(`${p.label}: ${p.value}`);
        }
        return {
          kind: "kv" as const,
          label: `${s.forms?.name ?? "Intake form"} (${s.submitted_at?.slice(0, 10) ?? ""})`,
          pairs,
        };
      }).filter((it: CSTItem) => (it.kind === "kv" ? it.pairs.length > 0 : true));
      if (items.length) sections.push({ id: sid(), title: "Intake & background", items });
    }
  } catch { /* table may be absent in some orgs */ }

  // d. Authorized services (factual list)
  try {
    const { data: codes } = await supabase
      .from("client_billing_codes")
      .select("service_code, unit_type, service_end_date")
      .eq("client_id", clientId);
    if (codes && codes.length) {
      const today = denverYmd();
      const active = (codes as Array<{ service_code: string; unit_type: string | null; service_end_date: string | null }>)
        .filter((c) => !c.service_end_date || c.service_end_date >= today);
      if (active.length) {
        sections.push({
          id: sid(),
          title: "Authorized services",
          items: [{
            kind: "list",
            label: "Codes",
            values: active.map((c) => c.service_code + (c.unit_type ? ` (${c.unit_type})` : "")),
          }],
        });
      }
    }
  } catch { /* ignore */ }

  // e. Medications — SAFETY-CRITICAL — exact structured facts only
  try {
    const { data: meds } = await supabase
      .from("client_medications")
      .select(TRAINING_MED_COLUMNS)
      .eq("client_id", clientId);
    const items: CSTItem[] = trainingMedItems((meds ?? []) as Partial<StaffMedication>[]);
    if (items.length) sections.push({ id: sid(), title: "Medications", items });
  } catch { /* ignore */ }

  // f. Rights & safeguards — SAFETY-CRITICAL — HRC status + restriction_summary, exact
  try {
    const { data: hrc } = await supabase
      .from("hrc_reviews")
      .select("restriction_summary, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hrc?.restriction_summary || hrc?.status) {
      const items: CSTItem[] = [];
      if (hrc.status) items.push({ kind: "text", label: "Status", value: String(hrc.status) });
      if (hrc.restriction_summary) items.push({ kind: "text", label: "Restriction summary", value: String(hrc.restriction_summary) });
      sections.push({ id: sid(), title: "Rights & safeguards", items });
    }
  } catch { /* ignore */ }

  if (!sections.length) {
    sections.push({
      id: sid(),
      title: "No authoritative data found",
      items: [{ kind: "note", label: "Status", value: "No data on file for this client yet." }],
    });
  }

  // NECTAR-composed narrative overview (prepended). Uses ONLY non-safety-critical
  // facts (identity, goals, special directions, intake highlights). NEVER touches
  // meds / behavior / rights / codes / documents — those remain exact records.
  try {
    if (client) {
      const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "This person";
      const goals: string[] = goalViews.map((g) => g.goal);
      let ageBand = "";
      if (client.date_of_birth) {
        const yrs = Math.floor((Date.now() - new Date(String(client.date_of_birth)).getTime()) / (365.25 * 24 * 3600 * 1000));
        if (yrs > 0 && yrs < 120) {
          ageBand = yrs < 18 ? "under 18" : yrs < 30 ? "in their 20s" : yrs < 40 ? "in their 30s" : yrs < 50 ? "in their 40s" : yrs < 60 ? "in their 50s" : yrs < 70 ? "in their 60s" : "70+";
        }
      }
      const facts = [
        `Name: ${fullName}`,
        ageBand ? `Age band: ${ageBand}` : "",
        client.special_directions ? `Special directions: ${String(client.special_directions)}` : "",
        goals.length ? `Plan goals:\n${goals.map((g, i) => `  ${i + 1}. ${g}`).join("\n")}` : "",
        intakeHighlights.length ? `Intake highlights:\n${intakeHighlights.slice(0, 12).map((h) => `  - ${h}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");
      const narrative = await draftTrainingNarrative(facts, orgId);
      if (narrative && narrative.trim()) {
        sections.unshift({
          id: sid(),
          title: "About this person & how to support them",
          items: [
            { kind: "note", label: "AI draft — review & edit before publishing", value: "NECTAR drafted this overview from this client's records. Review, correct, and attest before it reaches staff." },
            { kind: "text", label: "Overview", value: narrative.trim() },
          ],
        });
      }
    }
  } catch { /* never block assembly on narrative */ }

  // org scope reference (suppress unused warning)
  void orgId;
  return { sections };
}

// NECTAR composes a flowing person-centered overview narrative for the TOP of
// a person-specific training. AI-drafted only — admin must review/edit/attest
// before publishing. Returns "" on any AI failure so assembly degrades safely.
// Deliberately excludes meds, behavior protocols, and legal restrictions —
// those remain as exact structured records elsewhere in the training.
async function draftTrainingNarrative(facts: string, orgId?: string | null): Promise<string> {
  if (!facts.trim()) return "";
  try {
    const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
    const system = [
      "You are NECTAR, writing a brief, warm, professional orientation narrative for a Utah DSPD direct-support worker about to support a specific person.",
      "Using ONLY the facts provided, write 1–3 short flowing paragraphs introducing the person: who they are, what matters to them, their goals, and the general approach to supporting them.",
      "Use natural, respectful, person-centered language — not a bulleted data dump.",
      "Do NOT invent facts that are not provided.",
      "Do NOT state medications, doses, behavior protocols, or legal restrictions — those are presented separately as exact records.",
      "This is a DRAFT the agency admin will review, edit, and attest to before it reaches staff.",
      'Respond ONLY with JSON: { "narrative": "..." }. No preamble, no markdown fences.',
    ].join("\n");
    const res = await gatewayFetch({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `FACTS:\n${facts}` },
      ],
      response_format: { type: "json_object" },
    }, { orgId });
    if (!res.ok) return "";
    const body = await res.json();
    const content: string = body?.choices?.[0]?.message?.content ?? "{}";
    const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean || "{}") as { narrative?: string };
    return String(parsed.narrative ?? "").slice(0, 6000);
  } catch {
    return "";
  }
}

// ── GET current training (admin) ────────────────────────────────────────────
export const getClientSpecificTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    await assertClientInOrg(supabase, data.clientId, m.organization_id);
    await guardClient(supabase, userId, m.organization_id, data.clientId, "view");
    const { data: row, error } = await supabase
      .from("client_specific_trainings")
      .select("*")
      .eq("client_id", data.clientId)
      .eq("training_type", "person_specific")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { training: row };
  });

// ── DRAFT (or REBUILD) with NECTAR (admin) ──────────────────────────────────
// Assembles verbatim sections from authoritative client data and upserts a
// draft row (status='draft', version bumped on rebuild).
export const draftClientSpecificTrainingWithNectar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    rebuild: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    await assertClientInOrg(supabase, data.clientId, m.organization_id);
    await guardClient(supabase, userId, m.organization_id, data.clientId, "edit");

    const content = await assembleVerbatim(supabase, m.organization_id, data.clientId);

    const { data: existing } = await supabase
      .from("client_specific_trainings")
      .select("id, version")
      .eq("client_id", data.clientId)
      .eq("training_type", "person_specific")
      .maybeSingle();

    if (existing) {
      const { data: updated, error: uErr } = await supabase
        .from("client_specific_trainings")
        .update({
          content: content as unknown,
          status: "draft",
          version: (existing.version ?? 1) + (data.rebuild ? 1 : 0),
          approved_by: null,
          approved_at: null,
        })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (uErr) throw new Error(uErr.message);
      return { training: updated };
    }

    const { data: inserted, error: iErr } = await supabase
      .from("client_specific_trainings")
      .insert({
        organization_id: m.organization_id,
        client_id: data.clientId,
        training_type: "person_specific",
        title: "Client-Specific Training",
        content: content as unknown,
        status: "draft",
        version: 1,
      })
      .select("*")
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    return { training: inserted };
  });

// ── DRAFT BLANK person-specific training (admin) ────────────────────────────
// Mirrors draftSupportStrategies mode "blank" but for training_type = "person_specific".
export const draftClientSpecificTrainingBlank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    await assertClientInOrg(supabase, data.clientId, m.organization_id);
    await guardClient(supabase, userId, m.organization_id, data.clientId, "edit");

    const content: CSTContent = { sections: [
      { id: sid(), title: "Client-specific training", items: [
        { kind: "text", label: "Notes", value: "" },
      ] },
    ] };

    const { data: existing } = await supabase
      .from("client_specific_trainings")
      .select("id")
      .eq("client_id", data.clientId)
      .eq("training_type", "person_specific")
      .maybeSingle();

    if (existing) {
      const { data: updated, error: uErr } = await supabase
        .from("client_specific_trainings")
        .update({ content: content as unknown, status: "draft", approved_by: null, approved_at: null })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (uErr) throw new Error(uErr.message);
      return { training: updated };
    }

    const { data: inserted, error: iErr } = await supabase
      .from("client_specific_trainings")
      .insert({
        organization_id: m.organization_id,
        client_id: data.clientId,
        training_type: "person_specific",
        title: "Client-Specific Training",
        content: content as unknown,
        status: "draft",
        version: 1,
      })
      .select("*")
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    return { training: inserted };
  });

// Per-client Person-Centered Thinking create path is retired. Do not add a
// server fn that inserts or upserts training_type = 'person_centered'.
// Historical rows may still be read/completed by staff APIs below.

// ── ATTACH uploaded document as person-specific training (admin) ────────────
// Mirrors attachSupportStrategyDocument but for training_type = "person_specific".
export const attachClientSpecificTrainingDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    fileName: z.string().min(1).max(300),
    storagePath: z.string().min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { ok: false, documentId: null };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    await assertClientInOrg(supabase, data.clientId, m.organization_id);
    await guardClient(supabase, userId, m.organization_id, data.clientId, "edit");

    const { data: doc, error: dErr } = await supabase
      .from("client_documents")
      .insert({
        client_id: data.clientId,
        organization_id: m.organization_id,
        document_type: "person_specific_training",
        file_name: data.fileName,
        file_url: data.storagePath,
        storage_path: data.storagePath,
        uploaded_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);

    const linkContent: CSTContent = { sections: [
      { id: sid(), title: "Uploaded client-specific training", items: [
        { kind: "link", label: "Provider document", links: [{ label: data.fileName, href: null }] },
      ] },
    ] };

    const { data: existing } = await supabase
      .from("client_specific_trainings")
      .select("id")
      .eq("client_id", data.clientId)
      .eq("training_type", "person_specific")
      .maybeSingle();

    if (existing) {
      const { error: uErr } = await supabase
        .from("client_specific_trainings")
        .update({ content: linkContent as unknown, status: "draft", approved_by: null, approved_at: null })
        .eq("id", existing.id);
      if (uErr) throw new Error(uErr.message);
    } else {
      const { error: iErr } = await supabase
        .from("client_specific_trainings")
        .insert({
          organization_id: m.organization_id,
          client_id: data.clientId,
          training_type: "person_specific",
          title: "Client-Specific Training",
          content: linkContent as unknown,
          status: "draft",
          version: 1,
        });
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true, documentId: doc?.id ?? null };
  });

// ── UPDATE content/title (admin) ───────────────────────────────────────────
export const updateClientSpecificTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    content: ContentSchema.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    const row = await trainingInOrg(supabase, data.id, m.organization_id, "status, draft_content");
    await guardClient(supabase, userId, m.organization_id, row.client_id, "edit");
    // A pending draft version (pulled from a document) takes the edit; staff
    // keep the approved one. Otherwise editing a published version returns it
    // to draft (requires re-approval).
    const patch: Record<string, unknown> =
      data.content !== undefined ? editSavePatch(row, data.content) : {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.content === undefined && row.status === "published") {
      patch.status = "draft";
      patch.approved_by = null;
      patch.approved_at = null;
    }
    const { data: updated, error: uErr } = await supabase
      .from("client_specific_trainings")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    return { training: updated };
  });

// ── APPROVE & PUBLISH (admin) ──────────────────────────────────────────────
export const publishClientSpecificTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    id: z.string().uuid(),
    /** Support strategies approved with gaps: the person's reason. */
    note: z.string().trim().min(1).max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    const row = await trainingInOrg(supabase, data.id, m.organization_id, "content, draft_content, status, version");
    await guardClient(supabase, userId, m.organization_id, row.client_id, "edit");
    // A pending draft version is what gets approved (it replaces the approved one).
    const approval = approvalContent<CSTContent>(row);
    const content = (approval.content ?? { sections: [] }) as CSTContent;
    const { data: updated, error: uErr } = await supabase
      .from("client_specific_trainings")
      .update({
        ...approval.patch,
        status: "published",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        content: { ...content, approval_note: data.note } as unknown,
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    return { training: updated };
  });

// ── SAVE review questions (admin) ─────────────────────────────────────────
export const saveReviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    id: z.string().uuid(),
    review_questions: z.array(ReviewQuestionSchema),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { ok: false };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    const row = await trainingInOrg(supabase, data.id, m.organization_id, "status");
    await guardClient(supabase, userId, m.organization_id, row.client_id, "edit");
    const patch: Record<string, unknown> = { review_questions: data.review_questions };
    if (row.status === "published") { patch.status = "draft"; patch.approved_by = null; patch.approved_at = null; }
    const { error: uErr } = await supabase.from("client_specific_trainings").update(patch).eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

// ── NECTAR relevance check (staff) — fail-open ────────────────────────────
export const checkAnswerRelevance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    question: z.string().min(1).max(2000),
    answer: z.string().min(1).max(4000),
    context: z.string().max(8000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
    const system = [
      "You check whether a direct-support worker's written answer is RELEVANT to the question about a specific client.",
      "Be FORGIVING. Any genuine, on-topic attempt passes. Only fail answers that are clearly off-topic, empty filler, or unrelated to the question/client.",
      "Do NOT grade quality, grammar, or completeness. Relevance only.",
      'Respond ONLY with JSON: { "relevant": true|false, "hint": "one short sentence if not relevant, else empty" }',
    ].join("\n");
    try {
      const res = await gatewayFetch({
        messages: [
          { role: "system", content: system },
          { role: "user", content: `QUESTION: ${data.question}\n\nANSWER: ${data.answer}\n\nCLIENT CONTEXT: ${data.context ?? "(none)"}` },
        ],
        response_format: { type: "json_object" },
      });
      if (!res.ok) return { relevant: true, hint: "" };
      const body = await res.json();
      const content: string = body?.choices?.[0]?.message?.content ?? "{}";
      const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(clean || "{}") as { relevant?: boolean; hint?: string };
      if (parsed.relevant === false) return { relevant: false, hint: String(parsed.hint ?? "Try connecting your answer to the client's goal.") };
      return { relevant: true, hint: "" };
    } catch {
      return { relevant: true, hint: "" };
    }
  });
