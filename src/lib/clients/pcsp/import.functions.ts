// Upload a USTEPS PCSP → read it (plain code) → review → confirm.
// readPcsp saves only the PDF (a 'pcsp' client document) and returns the
// parse for review; nothing else is written until confirmPcsp. Both need
// clients:edit for this client (assertCanManageClient).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchTenantIdentity } from "@/lib/service-classification";
import { assertCanManageClient } from "../guards.server";
import { assertRowsChanged } from "../writes";
import { pdfToLayout, type UnpdfLike } from "./layout";
import { readPcspPages } from "./parser";
import { proposeCarryOver, type CarryOver } from "./carry-over";
import { applyFallback, fallbackMessages, NECTAR_FALLBACK_FLAG, sectionsNeedingHelp, type FallbackSection } from "./nectar-fallback";
import type { PcspResult } from "./parser-shared";
import { applyReviewedPcsp, type ConfirmResult } from "./confirm-write";
import { reviewedPcspSchema } from "./review-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const MAX_BYTES = 15 * 1024 * 1024;
const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };

export interface PcspRead {
  documentId: string;
  fileName: string;
  parse: PcspResult;
  carry: CarryOver;
  currentPlan: { id: string; start_date: string | null; end_date: string | null } | null;
  /** Sections Nectar read because they didn't match the usual layout. */
  nectarSections: FallbackSection[];
}

/** The org's flag (off by default) — on only when both Nectar and the fallback are switched on. */
async function nectarFallbackOn(sb: Sb, organizationId: string): Promise<boolean> {
  const { data } = await sb
    .from("organization_features").select("feature_key, enabled")
    .eq("organization_id", organizationId).in("feature_key", ["nectar", NECTAR_FALLBACK_FLAG]);
  const on = new Map(((data ?? []) as { feature_key: string; enabled: boolean }[]).map((r) => [r.feature_key, r.enabled]));
  return on.get("nectar") === true && on.get(NECTAR_FALLBACK_FLAG) === true;
}

async function runNectarFallback(
  parse: PcspResult, sections: ReturnType<typeof readPcspPages>["sections"], agencyName: string, orgId: string,
): Promise<FallbackSection[]> {
  const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
  const used: FallbackSection[] = [];
  for (const s of sectionsNeedingHelp(sections, parse)) {
    let reply: unknown = null;
    try {
      const res = await gatewayFetch({ messages: fallbackMessages(s.name, s.text), response_format: { type: "json_object" } }, { orgId });
      if (res.ok) {
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body.choices?.[0]?.message?.content ?? "{}";
        reply = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim() || "{}");
      }
    } catch {
      reply = null;
    }
    applyFallback(parse, s.name, reply, s.text, agencyName);
    used.push(s.name);
  }
  return used;
}

export const readPcsp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...scope, fileName: z.string().min(1).max(255), fileBase64: z.string().min(10).max(21_000_000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PcspRead> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });

    const bytes = Uint8Array.from(Buffer.from(data.fileBase64, "base64"));
    if (bytes.byteLength > MAX_BYTES) throw new Error("This PDF is over 15 MB. Upload a smaller copy.");
    if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") throw new Error("Upload the PCSP as a PDF printed from USTEPS.");

    const unpdf = (await import("unpdf")) as unknown as UnpdfLike;
    const pages = await pdfToLayout(bytes.slice(), unpdf);
    if (!pages.some((p) => p.lines.length)) throw new Error("No text was found in this PDF (is it a scan?). Enter the plan by hand.");

    const { data: org, error: orgErr } = await sb.from("organizations").select("name, legal_name").eq("id", organizationId).maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    const agencyName = (org as { legal_name?: string | null; name?: string } | null)?.legal_name || (org as { name?: string } | null)?.name || "";
    const tenant = await fetchTenantIdentity(sb, organizationId);
    const { result: parse, sections } = readPcspPages(pages, { agencyName, agencyCodes: tenant.codesHeld });
    const nectarSections = (await nectarFallbackOn(sb, organizationId))
      ? await runNectarFallback(parse, sections, agencyName, organizationId)
      : [];

    // Save the PDF (kept in the client's file even if the review is cancelled).
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${organizationId}/${clientId}/pcsp/${Date.now()}_${safe}`;
    const up = await sb.storage.from("client-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
    const dated = parse.plan.start && parse.plan.end;
    const { data: docRows, error: docErr } = await sb.from("client_documents").insert({
      organization_id: organizationId, client_id: clientId, document_type: "pcsp", file_name: data.fileName,
      file_url: path, storage_path: path, file_size_bytes: bytes.byteLength, uploaded_by: userId,
      ...(dated ? { effective_from: parse.plan.start, effective_to: parse.plan.end, effective_to_mode: "fixed_date", date_source: "from_document" } : {}),
    }).select("id");
    if (docErr) throw new Error(docErr.message);
    const documentId = (assertRowsChanged(docRows as unknown[])[0] as { id: string }).id;

    const { data: plan } = await sb
      .from("client_plans").select("id, start_date, end_date").eq("client_id", clientId).eq("status", "current").maybeSingle();
    const currentPlan = (plan as PcspRead["currentPlan"]) ?? null;
    let currentGoals: { id: string; goal_text: string }[] = [];
    if (currentPlan) {
      const { data: g } = await sb.from("client_goals").select("id, goal_text").eq("plan_id", currentPlan.id).eq("status", "active");
      currentGoals = (g ?? []) as typeof currentGoals;
    }
    const carry = proposeCarryOver(parse.goals.map((g) => g.goal), currentGoals, parse.lastYearGoals);
    return { documentId, fileName: data.fileName, parse, carry, currentPlan, nectarSections };
  });

/** Write the reviewed PCSP: new current plan, goals/supports, authorizations, must-knows, about-me, contacts. */
export const confirmPcsp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, parseId: z.string().uuid(), edits: reviewedPcspSchema }).parse(d))
  .handler(async ({ data, context }): Promise<ConfirmResult> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    return applyReviewedPcsp(sb, {
      organizationId, clientId, userId, documentId: data.parseId, review: data.edits, now: new Date().toISOString(),
    });
  });
