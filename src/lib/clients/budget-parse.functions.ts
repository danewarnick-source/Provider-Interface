// "Fill from 1056" on Services & billing. read1056 saves the PDF to the
// client's file ('1056_budget'), reads its text, and asks Nectar for every
// field as {value, page, quote}; values whose quote isn't in the PDF are
// dropped (auth-1056.ts). Nothing else is written until confirm1056, which
// re-checks codes against the agency's approved codes, real dates and
// whole-number units, then upserts the authorizations. Both need Billing:
// Edit for this client.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { assertRowsChanged } from "./writes";
import { pdfToLayout, type UnpdfLike } from "./pcsp/layout";
import {
  read1056Checks,
  read1056FromReply,
  read1056Messages,
  review1056Problems,
  rowsFrom1056,
  type Read1056,
} from "./auth-1056";
import { loadAgencyCodes } from "./services-load";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const MAX_BYTES = 15 * 1024 * 1024;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };

export type Read1056Result = {
  documentId: string;
  fileName: string;
  read: Read1056;
  checks: string[];
  agencyCodes: string[];
};

async function pdfText(bytes: Uint8Array): Promise<string> {
  const unpdf = (await import("unpdf")) as unknown as UnpdfLike;
  const pages = await pdfToLayout(bytes.slice(), unpdf);
  return pages.flatMap((p) => p.lines.map((l) => `[page ${p.index}] ${l.text.trim()}`)).join("\n");
}

async function askNectar(text: string, orgId: string): Promise<unknown> {
  const { assertBedrockConfigured, gatewayFetch } = await import("@/lib/ai-bedrock.server");
  assertBedrockConfigured();
  const res = await gatewayFetch(
    { messages: read1056Messages(text), response_format: { type: "json_object" } },
    { orgId },
  );
  if (res.status === 429) throw new Error("Nectar is busy right now — try again in a moment.");
  if (!res.ok) throw new Error(`Nectar couldn't read the 1056 (${res.status}). Enter it by hand.`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(
      content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim() || "{}",
    );
  } catch {
    return null;
  }
}

export const read1056 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...scope,
        fileName: z.string().min(1).max(255),
        fileBase64: z.string().min(10).max(21_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Read1056Result> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      clientId,
      action: "edit_billing",
    });

    const bytes = Uint8Array.from(Buffer.from(data.fileBase64, "base64"));
    if (bytes.byteLength > MAX_BYTES)
      throw new Error("This PDF is over 15 MB. Upload a smaller copy.");
    if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-")
      throw new Error("Upload the 1056 as a PDF.");
    const text = await pdfText(bytes);
    if (!text.trim())
      throw new Error(
        "No text was found in this PDF (is it a scan?). Enter the authorizations by hand.",
      );

    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${organizationId}/${clientId}/1056/${Date.now()}_${safe}`;
    const up = await sb.storage
      .from("client-documents")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
    const { data: docRows, error: docErr } = await sb
      .from("client_documents")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        document_type: "1056_budget",
        file_name: data.fileName,
        file_url: `storage://client-documents/${path}`,
        storage_path: path,
        file_size_bytes: bytes.byteLength,
        uploaded_by: userId,
      })
      .select("id");
    if (docErr) throw new Error(docErr.message);
    const documentId = assertRowsChanged(docRows as { id: string }[])[0].id;

    const [reply, agencyCodes] = await Promise.all([
      askNectar(text, organizationId),
      loadAgencyCodes(sb, organizationId),
    ]);
    const read = read1056FromReply(reply, text);
    return { documentId, fileName: data.fileName, read, checks: read1056Checks(read), agencyCodes };
  });

const lineSchema = z.object({
  include: z.boolean(),
  code: z.string().max(8),
  unitType: z.string().max(10),
  rate: z.number().nullable(),
  annualUnits: z.number().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  sources: z.record(z.string(), z.unknown()).optional().default({}),
});

export const confirm1056 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...scope,
        documentId: z.string().uuid(),
        review: z.object({
          authorizationNumber: z.string().max(40),
          approvedOn: z.string().nullable(),
          lines: z.array(lineSchema).max(40),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      clientId,
      action: "edit_billing",
    });
    const review = { ...data.review, lines: data.review.lines.map((l) => ({ ...l, sources: {} })) };
    const problems = review1056Problems(review, await loadAgencyCodes(sb, organizationId));
    if (problems.length) throw new Error(problems.join(" "));

    const { data: doc, error: docErr } = await sb
      .from("client_documents")
      .select("id")
      .eq("id", data.documentId)
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("That 1056 upload wasn't found for this client. Upload it again.");

    const values = rowsFrom1056(review, {
      organizationId,
      clientId,
      documentId: data.documentId,
      now: new Date().toISOString(),
    });
    const { data: out, error } = await sb
      .from("client_billing_codes")
      .upsert(values, { onConflict: "organization_id,client_id,service_code" })
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(out as unknown[]);
    return { codes: values.map((v) => String(v.service_code)) };
  });
