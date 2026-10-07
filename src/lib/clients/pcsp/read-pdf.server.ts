// Uploaded PDF → PCSP parse (plain code, optional Nectar fallback). Shared by
// Upload PCSP in Plans (import.functions.ts) and "Start from their PCSP" on
// Add client (create.functions.ts). The browser uploads the PDF to storage
// first, so large PDFs never go through a server function's request body
// (hosts cap that at a few MB). Writes only the no-PHI read log.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTenantIdentity } from "@/lib/service-classification";
import { pdfToLayout, type UnpdfLike } from "./layout";
import { readPcspPages } from "./parser";
import {
  applyFallback,
  fallbackMessages,
  NECTAR_FALLBACK_FLAG,
  sectionsNeedingHelp,
  type FallbackSection,
} from "./nectar-fallback";
import type { PcspResult } from "./parser-shared";
import { inFolder, readFailure, readLogRow } from "./read-report";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const MAX_BYTES = 15 * 1024 * 1024;

/** The org's flag (off by default) — on only when both Nectar and the fallback are switched on. */
async function nectarFallbackOn(sb: Sb, organizationId: string): Promise<boolean> {
  const { data } = await sb
    .from("organization_features")
    .select("feature_key, enabled")
    .eq("organization_id", organizationId)
    .in("feature_key", ["nectar", NECTAR_FALLBACK_FLAG]);
  const on = new Map(
    ((data ?? []) as { feature_key: string; enabled: boolean }[]).map((r) => [
      r.feature_key,
      r.enabled,
    ]),
  );
  return on.get("nectar") === true && on.get(NECTAR_FALLBACK_FLAG) === true;
}

async function runNectarFallback(
  parse: PcspResult,
  sections: ReturnType<typeof readPcspPages>["sections"],
  agencyNames: string[],
  orgId: string,
): Promise<FallbackSection[]> {
  const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
  const used: FallbackSection[] = [];
  for (const s of sectionsNeedingHelp(sections, parse)) {
    let reply: unknown = null;
    try {
      const res = await gatewayFetch(
        { messages: fallbackMessages(s.name, s.text), response_format: { type: "json_object" } },
        { orgId },
      );
      if (res.ok) {
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body.choices?.[0]?.message?.content ?? "{}";
        reply = JSON.parse(
          content
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim() || "{}",
        );
      }
    } catch {
      reply = null;
    }
    applyFallback(parse, s.name, reply, s.text, agencyNames);
    used.push(s.name);
  }
  return used;
}

/** Check the file is a PDF under 15 MB. */
export function checkPcspBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("This PDF is over 15 MB. Upload a smaller copy.");
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-")
    throw new Error("Upload the PCSP as a PDF printed from USTEPS.");
  return bytes;
}

/** The agency's names: legal name first (shown in messages), then the name it goes by. */
async function agencyNames(sb: Sb, organizationId: string): Promise<string[]> {
  const { data: org, error } = await sb
    .from("organizations")
    .select("name, legal_name")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const o = (org ?? {}) as { legal_name?: string | null; name?: string | null };
  return [...new Set([o.legal_name, o.name].map((n) => (n ?? "").trim()).filter(Boolean))];
}

export interface PcspPdfRead {
  parse: PcspResult;
  nectarSections: FallbackSection[];
  /** Legal name (or name) used in "No purchased services for …". */
  agencyName: string;
  pageCount: number;
}

/** Read a PCSP PDF for this org (the agency's names decide which providers are "ours"). */
export async function readPcspPdf(sb: Sb, organizationId: string, bytes: Uint8Array): Promise<PcspPdfRead> {
  const unpdf = (await import("unpdf")) as unknown as UnpdfLike;
  const pages = await pdfToLayout(bytes.slice(), unpdf);
  if (!pages.some((p) => p.lines.length))
    throw new Error("No text was found in this PDF (is it a scan?). Enter the plan by hand.");

  const [names, tenant] = await Promise.all([
    agencyNames(sb, organizationId),
    fetchTenantIdentity(sb, organizationId),
  ]);
  const [agencyName = "", ...otherNames] = names;
  const { result: parse, sections } = readPcspPages(pages, {
    agencyName,
    otherNames,
    agencyCodes: tenant.codesHeld,
  });
  const nectarSections = (await nectarFallbackOn(sb, organizationId))
    ? await runNectarFallback(parse, sections, names, organizationId)
    : [];
  return { parse, nectarSections, agencyName, pageCount: pages.length };
}

/** Where browsers upload a PCSP before it is read: under the org's folder in client-documents. */
export const PCSP_BUCKET = "client-documents";

/** Download an uploaded PCSP. The path must sit under `prefix` (the org / client folder). */
export async function downloadPcsp(sb: Sb, storagePath: string, prefix: string): Promise<Uint8Array> {
  if (!inFolder(storagePath, prefix))
    throw new Error("That upload isn't in this client's folder. Upload the PCSP again.");
  const { data, error } = await sb.storage.from(PCSP_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`The uploaded file couldn't be opened (${error?.message ?? "not found"}).`);
  return checkPcspBytes(new Uint8Array(await data.arrayBuffer()));
}

export type PcspReadOutcome =
  | ({ ok: true } & PcspPdfRead)
  | { ok: false; message: string };

/**
 * Download and read an uploaded PCSP, and log the read (pcsp_read_log, no
 * PHI). Failures come back as a value with the plain reason, because a thrown
 * error reaches the browser as a bare "Internal Server Error" on some hosts.
 */
export async function readUploadedPcsp(
  sb: Sb,
  a: { organizationId: string; userId: string; source: "new_client" | "plans"; storagePath: string; prefix: string },
): Promise<PcspReadOutcome> {
  const started = Date.now();
  let out: PcspReadOutcome;
  try {
    const bytes = await downloadPcsp(sb, a.storagePath, a.prefix);
    out = { ok: true, ...(await readPcspPdf(sb, a.organizationId, bytes)) };
  } catch (e) {
    out = { ok: false, message: readFailure(e instanceof Error ? e.message : String(e)) };
  }
  const row = readLogRow({
    organizationId: a.organizationId,
    userId: a.userId,
    source: a.source,
    pageCount: out.ok ? out.pageCount : null,
    parse: out.ok ? out.parse : null,
    nectarSections: out.ok ? out.nectarSections : [],
    durationMs: Date.now() - started,
    error: out.ok ? null : out.message,
  });
  const { error } = await sb.from("pcsp_read_log").insert(row);
  if (error) console.warn("[pcsp-read] log row not saved:", error.message);
  return out;
}
