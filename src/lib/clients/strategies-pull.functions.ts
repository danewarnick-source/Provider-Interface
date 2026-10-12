// "Pull strategies from this document" (strategies card, uploaded document):
// Nectar copies the strategies already written in the uploaded strategies
// document under each current PCSP support paid to the agency. Every bullet
// is checked against the document text (strategies-pull.ts) and dropped when
// not found. The result is a marked Nectar draft (status draft, approval
// cleared) an admin reviews and approves; the uploaded file stays the
// official copy (content.source_document_id). Editors only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askNectarJson } from "./client-doc-texts.server";
import { todayYmd } from "./dates";
import { activeGoalViewsOn } from "./plans";
import { loadPlanBundle } from "./plans-load";
import { PULL_SYSTEM_PROMPT, parsePullReply, pullUserPrompt } from "./strategies-pull";
import { editableClient, uploadedStrategiesDoc } from "./strategy-sends.functions";
import { formatBullets } from "./strategy-rules";
import { agencySupports, buildStrategySections, supportNeedsStrategy } from "./support-strategies";
import type { CSTContent } from "./training.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export const pullStrategiesFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ copied: number; blank: string[] }> => {
    const sb = context.supabase as AnySupabase;
    const client = await editableClient(sb, context.userId as string, data.clientId);
    const { data: training, error } = await sb
      .from("client_specific_trainings")
      .select("id, content, version")
      .eq("client_id", client.id)
      .eq("training_type", "support_strategies")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const doc = training
      ? await uploadedStrategiesDoc(sb, client.id, training.content as CSTContent | null)
      : null;
    if (!training || !doc) throw new Error("Upload the strategies document first.");

    const supports = agencySupports(
      activeGoalViewsOn(await loadPlanBundle(sb, client.id), todayYmd()),
    );
    const needed = supports.filter(supportNeedsStrategy);
    if (!needed.length) throw new Error("No support in the current plan year needs a strategy.");

    const dl = await sb.storage.from("client-documents").download(doc.storage_path);
    if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "The uploaded file wasn't found.");
    const { extractTextFromUpload } = await import("@/lib/document-text.server");
    const text = await extractTextFromUpload(
      Buffer.from(await (dl.data as Blob).arrayBuffer()),
      doc.file_name,
      (dl.data as Blob).type,
    );
    if (text.trim().length < 20) {
      throw new Error("Nectar couldn't read this document's text (a scan?). Write the strategies by hand.");
    }

    const reply = await askNectarJson(
      client.organization_id,
      PULL_SYSTEM_PROMPT,
      pullUserPrompt(needed, text),
      "Nectar couldn't read the document. Try again.",
    );
    const { drafts, blank } = parsePullReply(reply, needed, text);
    const content: CSTContent = {
      sections: buildStrategySections(
        supports,
        [],
        new Map([...drafts].map(([id, bullets]) => [id, formatBullets(bullets)])),
      ),
      source_document_id: doc.id,
    };
    const { error: uErr } = await sb
      .from("client_specific_trainings")
      .update({
        content: content as unknown,
        status: "draft",
        version: (training.version ?? 1) + 1,
        approved_by: null,
        approved_at: null,
      })
      .eq("id", training.id);
    if (uErr) throw new Error(uErr.message);
    return { copied: drafts.size, blank: blank.map((s) => s.support || "Support") };
  });
