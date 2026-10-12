// Add client → "Start from their PCSP". The browser uploads the PDF once to
// the org's new-client folder; readPcspForNewClient reads it (saving nothing
// but the no-PHI read log); addClientFromPcsp then saves the client, the PCSP
// document, the reviewed plan (confirm-write.ts, the same writer as Upload
// PCSP in Plans) and files it in the Client file, in one save.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { addClientFormSchema, formProblems } from "./create";
import { createClientFromForm, type AddClientResult } from "./create.server";
import { proposeCarryOver } from "./pcsp/carry-over";
import { confirmProblems } from "./pcsp/confirm-plan";
import { applyReviewedPcsp, type ConfirmResult } from "./pcsp/confirm-write";
import { fileCurrentPcsp, insertPcspDocument } from "./pcsp/file-pcsp.server";
import type { PcspRead, PcspReadResult } from "./pcsp/import.functions";
import { readUploadedPcsp } from "./pcsp/read-pdf.server";
import { inFolder, newClientPcspFolder, type FiledOutcome } from "./pcsp/read-report";
import { reviewedPcspSchema } from "./pcsp/review-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

async function guard(context: { supabase?: unknown; userId?: string | null }, organizationId: string) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const sb = context.supabase as Sb;
  await assertCanManageClient({ supabase: sb, actorId: context.userId, organizationId, action: "create" });
  return { sb, userId: context.userId };
}

const upload = {
  organizationId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(1024),
};

/** Read an uploaded PCSP for Add client. Saves nothing but the read log. */
export const readPcspForNewClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(upload).parse(d))
  .handler(async ({ data, context }): Promise<PcspReadResult> => {
    const { sb, userId } = await guard(context, data.organizationId);
    const res = await readUploadedPcsp(sb, {
      organizationId: data.organizationId,
      userId,
      source: "new_client",
      storagePath: data.storagePath,
      prefix: newClientPcspFolder(data.organizationId),
    });
    if (!res.ok) return res;
    const read: PcspRead = {
      documentId: "",
      fileName: data.fileName,
      storagePath: data.storagePath,
      parse: res.parse,
      carry: proposeCarryOver(res.parse.goals.map((g) => g.goal), [], res.parse.lastYearGoals),
      currentPlan: null,
      nectarSections: res.nectarSections,
      agencyName: res.agencyName,
    };
    return { ok: true, read };
  });

export type AddFromPcspResult =
  | Exclude<AddClientResult, { status: "created" }>
  | {
      status: "created";
      id: string;
      pinFound: boolean;
      /** The plan was saved, or why not (the client is saved either way). */
      plan: { ok: true; saved: ConfirmResult; filed: FiledOutcome } | { ok: false; message: string };
    };

/** Save the client and their reviewed PCSP in one go. */
export const addClientFromPcsp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...upload, form: addClientFormSchema, review: reviewedPcspSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AddFromPcspResult> => {
    const { organizationId, form, review, fileName, storagePath } = data;
    const { sb, userId } = await guard(context, organizationId);
    if (!inFolder(storagePath, newClientPcspFolder(organizationId)))
      return { status: "invalid", problems: ["the PCSP upload (upload it again)"] };
    // Everything is checked before the first write. If the plan still can't be
    // saved, the client is kept and the reason comes back (no hard deletes).
    const problems = [...formProblems(form), ...confirmProblems(review)];
    if (problems.length) return { status: "invalid", problems };

    const created = await createClientFromForm(sb, userId, organizationId, form);
    if (created.status !== "created") return created;
    const clientId = created.id;
    try {
      const documentId = await insertPcspDocument(sb, {
        organizationId, clientId, userId, fileName, storagePath,
        sizeBytes: null, start: review.plan.start, end: review.plan.end,
      });
      const saved = await applyReviewedPcsp(sb, {
        organizationId, clientId, userId, documentId, review, now: new Date().toISOString(),
      });
      const filed = await fileCurrentPcsp(sb, {
        organizationId, clientId, userId, fileName, storagePath, start: review.plan.start, end: review.plan.end,
      });
      return { ...created, plan: { ok: true, saved, filed } };
    } catch (e) {
      return { ...created, plan: { ok: false, message: e instanceof Error ? e.message : String(e) } };
    }
  });
