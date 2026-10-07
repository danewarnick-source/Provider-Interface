// client_support_scope reads and writes on the server. Add client starts the
// setup (the profile then shows "Finish setting up"); the Overview reads the
// answers so hidden cards never count in Needs attention. Callers run
// assertCanManageClient first.

import type { SupabaseClient } from "@supabase/supabase-js";
import { directiveStatus } from "./health";
import {
  SUPPORT_SCOPE_COLUMNS,
  allHiddenCards,
  type ScopeAnswers,
  type ScopeCard,
  type SupportScope,
} from "./support-scope";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

/** Signed advance directive forms (client_documents.document_type). */
export const DIRECTIVE_DOC_TYPES = ["dnr", "polst"] as const;

export async function loadSupportScope(sb: Sb, clientId: string): Promise<SupportScope | null> {
  const { data, error } = await sb
    .from("client_support_scope")
    .select(SUPPORT_SCOPE_COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as SupportScope | null) ?? null;
}

/**
 * A new client: the profile shows "Finish setting up" until the steps are
 * finished. Best effort: a client is never left unsaved over its banner.
 */
export async function startClientSetup(
  sb: Sb,
  organizationId: string,
  clientId: string,
): Promise<void> {
  const { error } = await sb.from("client_support_scope").insert({
    client_id: clientId,
    organization_id: organizationId,
    setup_started_at: new Date().toISOString(),
  });
  if (error) console.warn("[clients] setup banner not started:", error.message);
}

/** Save answers (and/or finish the setup). One row per client. */
export async function saveSupportScope(
  sb: Sb,
  args: {
    organizationId: string;
    clientId: string;
    userId: string;
    answers: ScopeAnswers;
    finished?: boolean;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const answered = Object.keys(args.answers).length > 0;
  const { error } = await sb.from("client_support_scope").upsert(
    {
      client_id: args.clientId,
      organization_id: args.organizationId,
      ...args.answers,
      ...(answered ? { answered_by: args.userId, answered_at: now } : {}),
      ...(args.finished ? { setup_finished_at: now } : {}),
      updated_at: now,
    },
    { onConflict: "client_id" },
  );
  if (error) throw new Error(error.message);
}

/** What the Overview needs: hidden cards and whether a signed DNR/POLST is due. */
export async function loadAttentionScope(
  sb: Sb,
  organizationId: string,
  clientId: string,
): Promise<{ hidden: ScopeCard[]; directive: { required: boolean; onFile: boolean } }> {
  const [scope, client, docs] = await Promise.all([
    loadSupportScope(sb, clientId).catch(() => null),
    sb
      .from("clients")
      .select("dnr_status, polst_status")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    sb
      .from("client_documents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .in("document_type", [...DIRECTIVE_DOC_TYPES])
      .is("archived_at", null)
      .limit(1),
  ]);
  const row = (client.data ?? null) as { dnr_status: string | null; polst_status: string | null } | null;
  const status = directiveStatus(row?.dnr_status) ?? (row?.polst_status ? "polst" : null);
  const required = status === "dnr" || status === "polst";
  return {
    hidden: allHiddenCards(scope, { needsBsp: false, directiveOnFile: required }),
    directive: { required, onFile: (docs.data ?? []).length > 0 },
  };
}
