// PDF bytes → PCSP parse (plain code, optional Nectar fallback). Shared by the
// PCSP upload on the profile (import.functions.ts) and "Fill from PCSP" on
// Add client (create.functions.ts). Writes nothing.

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
  agencyName: string,
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
    applyFallback(parse, s.name, reply, s.text, agencyName);
    used.push(s.name);
  }
  return used;
}

/** Check the upload is a PDF under 15 MB; returns its bytes. */
export function pcspBytes(fileBase64: string): Uint8Array {
  const bytes = Uint8Array.from(Buffer.from(fileBase64, "base64"));
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("This PDF is over 15 MB. Upload a smaller copy.");
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-")
    throw new Error("Upload the PCSP as a PDF printed from USTEPS.");
  return bytes;
}

/** Read a PCSP PDF for this org (agency name decides which providers are "ours"). */
export async function readPcspPdf(
  sb: Sb,
  organizationId: string,
  bytes: Uint8Array,
): Promise<{ parse: PcspResult; nectarSections: FallbackSection[] }> {
  const unpdf = (await import("unpdf")) as unknown as UnpdfLike;
  const pages = await pdfToLayout(bytes.slice(), unpdf);
  if (!pages.some((p) => p.lines.length))
    throw new Error("No text was found in this PDF (is it a scan?). Enter the plan by hand.");

  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("name, legal_name")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  const agencyName =
    (org as { legal_name?: string | null; name?: string } | null)?.legal_name ||
    (org as { name?: string } | null)?.name ||
    "";
  const tenant = await fetchTenantIdentity(sb, organizationId);
  const { result: parse, sections } = readPcspPages(pages, {
    agencyName,
    agencyCodes: tenant.codesHeld,
  });
  const nectarSections = (await nectarFallbackOn(sb, organizationId))
    ? await runNectarFallback(parse, sections, agencyName, organizationId)
    : [];
  return { parse, nectarSections };
}
