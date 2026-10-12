// Upload PCSP in Plans: the browser uploads the PDF to the client's pcsp
// folder → readPcsp reads it (plain code), saves it as a 'pcsp' client
// document and returns the parse for review (or the plain reason it couldn't)
// → confirmPcsp writes the review and files the PCSP in the Client file.
// Both need clients:edit for this client (assertCanManageClient).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "../guards.server";
import { proposeCarryOver, type CarryOver } from "./carry-over";
import type { FallbackSection } from "./nectar-fallback";
import { fileCurrentPcsp, insertPcspDocument } from "./file-pcsp.server";
import { readUploadedPcsp } from "./read-pdf.server";
import { pcspFolder, type FiledOutcome } from "./read-report";
import type { PcspResult } from "./parser-shared";
import { applyReviewedPcsp, type ConfirmResult } from "./confirm-write";
import { reviewedPcspSchema } from "./review-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };

export interface PcspRead {
  documentId: string;
  fileName: string;
  /** Where the uploaded PDF is stored (client-documents). */
  storagePath: string;
  parse: PcspResult;
  carry: CarryOver;
  currentPlan: { id: string; start_date: string | null; end_date: string | null } | null;
  /** Sections Nectar read because they didn't match the usual layout. */
  nectarSections: FallbackSection[];
  /** The agency's legal name, for "No purchased services for …". */
  agencyName: string;
}

export type PcspReadResult = { ok: true; read: PcspRead } | { ok: false; message: string };

export const readPcsp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...scope, fileName: z.string().min(1).max(255), storagePath: z.string().min(1).max(1024) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PcspReadResult> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });

    const res = await readUploadedPcsp(sb, {
      organizationId, userId, source: "plans", storagePath: data.storagePath, prefix: pcspFolder(organizationId, clientId),
    });
    if (!res.ok) return res;
    const { parse, nectarSections, agencyName } = res;

    // The PDF is kept in the client's documents even if the review is cancelled.
    const documentId = await insertPcspDocument(sb, {
      organizationId, clientId, userId, fileName: data.fileName, storagePath: data.storagePath,
      sizeBytes: res.sizeBytes, start: parse.plan.start, end: parse.plan.end,
    });

    const { data: plan } = await sb
      .from("client_plans").select("id, start_date, end_date").eq("client_id", clientId).eq("status", "current").maybeSingle();
    const currentPlan = (plan as PcspRead["currentPlan"]) ?? null;
    let currentGoals: { id: string; goal_text: string }[] = [];
    if (currentPlan) {
      const { data: g } = await sb.from("client_goals").select("id, goal_text").eq("plan_id", currentPlan.id).eq("status", "active").eq("kind", "goal");
      currentGoals = (g ?? []) as typeof currentGoals;
    }
    const carry = proposeCarryOver(parse.goals.map((g) => g.goal), currentGoals, parse.lastYearGoals);
    return {
      ok: true,
      read: { documentId, fileName: data.fileName, storagePath: data.storagePath, parse, carry, currentPlan, nectarSections, agencyName },
    };
  });

export type PcspSaved = ConfirmResult & { filed: FiledOutcome };

/** Write the reviewed PCSP (confirm-write.ts), then file it as the client's current PCSP. */
export const confirmPcsp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, parseId: z.string().uuid(), edits: reviewedPcspSchema }).parse(d))
  .handler(async ({ data, context }): Promise<PcspSaved> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    const saved = await applyReviewedPcsp(sb, {
      organizationId, clientId, userId, documentId: data.parseId, review: data.edits, now: new Date().toISOString(),
    });
    const { data: doc } = await sb
      .from("client_documents").select("file_name, storage_path").eq("id", data.parseId).maybeSingle();
    const d = (doc ?? {}) as { file_name?: string | null; storage_path?: string | null };
    const filed: FiledOutcome = d.storage_path
      ? await fileCurrentPcsp(sb, {
          organizationId, clientId, userId, fileName: d.file_name || "PCSP.pdf", storagePath: d.storage_path,
          start: data.edits.plan.start, end: data.edits.plan.end,
        })
      : "no_file_row";
    return { ...saved, filed };
  });
