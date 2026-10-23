// Server functions for the Support Strategies training: Nectar drafts bullets
// per PCSP support, or an admin uploads a document. Drafts only; an admin
// reviews, edits and approves.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  agencySupports,
  buildStrategySections,
  carryForward,
  supportsToDraft,
  type StrategySupport,
} from "../strategies/support-strategies";
import { formatBullets } from "../strategies/strategy-rules";
import {
  STRATEGY_SYSTEM_PROMPT,
  parseStrategyReply,
  strategyUserPrompt,
  type StrategyReply,
} from "../strategies/strategy-prompt";
import { type CSTSection, type CSTContent, sid } from "./training-content";
import {
  planGoals,
  type AnySupabase,
  adminGuard,
  getMembership,
  guardClient,
  assertClientInOrg,
} from "./training-guards.server";

// ── Support Strategies ─────────────────────────────────────────────────────
// One row per client (training_type='support_strategies'). Admin-authored:
// stub from PCSP goals (NECTAR verbatim), blank, or uploaded provider doc.

// NECTAR drafts 4–6 bullet points per PCSP support paid to the agency
// (strategy-prompt.ts holds the prompt, contract rules and the check). An
// AI-drafted starting point only — the agency admin MUST review, edit and
// approve. NECTAR never auto-publishes; status stays "draft". Supports whose
// bullets fail the check are retried once, then left blank and reported.
async function askNectarForStrategies(supports: StrategySupport[], orgId?: string | null): Promise<StrategyReply> {
  try {
    const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
    const res = await gatewayFetch({
      messages: [
        { role: "system", content: STRATEGY_SYSTEM_PROMPT },
        { role: "user", content: strategyUserPrompt(supports) },
      ],
      response_format: { type: "json_object" },
    }, { orgId });
    if (!res.ok) return parseStrategyReply("", supports);
    const body = await res.json();
    return parseStrategyReply(String(body?.choices?.[0]?.message?.content ?? ""), supports);
  } catch {
    return parseStrategyReply("", supports);
  }
}

async function draftStrategyBullets(
  supports: StrategySupport[],
  orgId?: string | null,
): Promise<{ drafts: Map<string, string>; missed: string[] }> {
  if (!supports.length) return { drafts: new Map(), missed: [] };
  const first = await askNectarForStrategies(supports, orgId);
  const retry = first.failed.length
    ? await askNectarForStrategies(first.failed.map((f) => f.support), orgId)
    : null;
  const drafts = new Map<string, string>();
  for (const [id, bullets] of [...first.drafts, ...(retry?.drafts ?? [])]) {
    drafts.set(id, formatBullets(bullets));
  }
  const missed = (retry?.failed ?? []).map((f) => f.support.support || "Support");
  return { drafts, missed };
}

/**
 * One section per support paid to the agency (support-strategies.ts). Edited
 * sections are kept (with `carry`, a new plan year: every written strategy
 * whose support carried over); with `nectar`, the others needing a strategy
 * get a fresh Nectar draft. `missed`: supports Nectar could not draft.
 */
async function assembleSupportStrategyStubs(
  supabase: AnySupabase,
  orgId: string,
  clientId: string,
  existing: CSTSection[],
  opts: { nectar: boolean; carry: boolean },
): Promise<{ content: CSTContent; missed: string[] }> {
  const supports = agencySupports(await planGoals(supabase, clientId));
  const kept = opts.carry ? carryForward(supports, existing) : existing.filter((x) => x.edited);
  const toDraft = opts.nectar ? supportsToDraft(supports, kept) : [];
  const { drafts, missed } = await draftStrategyBullets(toDraft, orgId);
  return { content: { sections: buildStrategySections(supports, kept, drafts) }, missed };
}

export const getSupportStrategiesTraining = createServerFn({ method: "GET" })
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
      .eq("training_type", "support_strategies")
      .maybeSingle();
    if (error) throw new Error(error.message);
    let approverName: string | null = null;
    if (row?.approved_by) {
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", row.approved_by)
        .maybeSingle();
      approverName = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || null;
    }
    return { training: row, approverName };
  });

export const draftSupportStrategies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    /** "missing": a new plan year; carried-over strategies stay, the rest are drafted. */
    mode: z.enum(["nectar", "blank", "rebuild", "missing"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null, nectarMissed: [] as string[] };
    const m = await getMembership(supabase, userId, data.organizationId);
    adminGuard(m.access_level);
    await assertClientInOrg(supabase, data.clientId, m.organization_id);
    await guardClient(supabase, userId, m.organization_id, data.clientId, "edit");

    const { data: current } = await supabase
      .from("client_specific_trainings")
      .select("content, draft_content")
      .eq("client_id", data.clientId)
      .eq("training_type", "support_strategies")
      .maybeSingle();
    // Edited strategies are kept from what the editor shows (a pending draft version first).
    const sections = ((current?.draft_content ?? current?.content) as CSTContent | undefined)?.sections ?? [];
    const { content, missed } = await assembleSupportStrategyStubs(
      supabase, m.organization_id, data.clientId, sections,
      { nectar: data.mode !== "blank", carry: data.mode === "missing" },
    );

    const { data: existing } = await supabase
      .from("client_specific_trainings")
      .select("id, version")
      .eq("client_id", data.clientId)
      .eq("training_type", "support_strategies")
      .maybeSingle();

    if (existing) {
      const { data: updated, error: uErr } = await supabase
        .from("client_specific_trainings")
        .update({
          content: content as unknown,
          draft_content: null,
          status: "draft",
          version: (existing.version ?? 1) + (data.mode === "rebuild" || data.mode === "missing" ? 1 : 0),
          approved_by: null,
          approved_at: null,
        })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (uErr) throw new Error(uErr.message);
      return { training: updated, nectarMissed: missed };
    }

    const { data: inserted, error: iErr } = await supabase
      .from("client_specific_trainings")
      .insert({
        organization_id: m.organization_id,
        client_id: data.clientId,
        training_type: "support_strategies",
        title: "Support Strategies",
        attestation_statement: "I have personally reviewed the support strategies for this client. I understand the instructions for each goal and will implement them as written while supporting this client.",
        content: content as unknown,
        status: "draft",
        version: 1,
      })
      .select("*")
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    return { training: inserted, nectarMissed: missed };
  });

export const attachSupportStrategyDocument = createServerFn({ method: "POST" })
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
        document_type: "support_strategy",
        file_name: data.fileName,
        file_url: data.storagePath,
        storage_path: data.storagePath,
        uploaded_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);

    const linkContent: CSTContent = { sections: [
      { id: sid(), title: "Uploaded support strategy", items: [
        { kind: "link", label: "Provider document", links: [{ label: data.fileName, href: null }] },
      ] },
    ], ...(doc?.id ? { source_document_id: doc.id as string } : {}) };

    const { data: existing } = await supabase
      .from("client_specific_trainings")
      .select("id")
      .eq("client_id", data.clientId)
      .eq("training_type", "support_strategies")
      .maybeSingle();

    if (existing) {
      const { error: uErr } = await supabase
        .from("client_specific_trainings")
        .update({ content: linkContent as unknown, draft_content: null, status: "draft", approved_by: null, approved_at: null })
        .eq("id", existing.id);
      if (uErr) throw new Error(uErr.message);
    } else {
      const { error: iErr } = await supabase
        .from("client_specific_trainings")
        .insert({
          organization_id: m.organization_id,
          client_id: data.clientId,
          training_type: "support_strategies",
          title: "Support Strategies",
          attestation_statement: "I have personally reviewed the support strategies for this client. I understand the instructions for each goal and will implement them as written while supporting this client.",
          content: linkContent as unknown,
          status: "draft",
          version: 1,
        });
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true, documentId: doc?.id ?? null };
  });
