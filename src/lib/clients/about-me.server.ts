// Server side of "About <first name>": read the client's documents (with the
// caller's RLS-scoped client), ask Nectar for a draft, check every bullet's
// source in code (about-me.ts), and load/save the approved summary.
// Nectar only drafts; approveAboutMe needs a person and records who and when.

import type { SupabaseClient } from "@supabase/supabase-js";
import { rows } from "./list-queries";
import { askNectarJson, clientDocInfos, readClientDocs } from "./client-doc-texts.server";
import { loadPeopleNames } from "./overview-team";
import { assertRowsChanged } from "./writes";
import {
  ABOUT_SYSTEM,
  aboutPrompt,
  checkAboutItems,
  hasNewKeyDocs,
  parseAboutReply,
  type AboutDraft,
  type AboutItem,
  type AboutSummary,
  type AboutView,
} from "./about-me";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export async function loadAboutView(sb: Sb, orgId: string, clientId: string): Promise<AboutView> {
  const [found, docs] = await Promise.all([
    rows<{
      items: unknown;
      drafted_by_nectar: boolean;
      approved_by: string;
      approved_at: string;
      based_on_doc_ids: string[] | null;
    }>(
      sb
        .from("client_about_me")
        .select("items, drafted_by_nectar, approved_by, approved_at, based_on_doc_ids")
        .eq("organization_id", orgId)
        .eq("client_id", clientId),
    ),
    clientDocInfos(sb, orgId, clientId),
  ]);
  const row = found[0];
  if (!row) return { summary: null, docs, newDocs: false };
  const names = await loadPeopleNames(sb, [row.approved_by]);
  const summary: AboutSummary = {
    items: Array.isArray(row.items) ? (row.items as AboutItem[]) : [],
    draftedByNectar: row.drafted_by_nectar,
    approvedAt: row.approved_at,
    approverName: names.get(row.approved_by) ?? "Team member",
    basedOn: row.based_on_doc_ids ?? [],
  };
  return { summary, docs, newDocs: hasNewKeyDocs(summary, docs) };
}

const FAILED = "Nectar couldn't draft the summary right now. Try again in a minute.";

/** Nectar's draft from the client's readable documents. Saves nothing. */
export async function draftAboutMe(sb: Sb, orgId: string, clientId: string): Promise<AboutDraft> {
  const [client] = await rows<{ first_name: string | null }>(
    sb
      .from("clients")
      .select("first_name")
      .is("deleted_at", null)
      .eq("organization_id", orgId)
      .eq("id", clientId),
  );
  const { readable, skipped } = await readClientDocs(sb, orgId, clientId);
  if (!readable.length) return { items: [], basedOn: [], skipped };
  const reply = await askNectarJson(
    orgId,
    ABOUT_SYSTEM,
    aboutPrompt(client?.first_name ?? "", readable),
    FAILED,
  );
  const items = checkAboutItems(parseAboutReply(reply), readable);
  return { items, basedOn: readable.map((d) => d.id), skipped };
}

/** Save what a person approved. Every bullet's source must still be one of the client's documents. */
export async function approveAboutMe(
  sb: Sb,
  a: {
    orgId: string;
    clientId: string;
    userId: string;
    items: AboutItem[];
    basedOn: string[];
    draftedByNectar: boolean;
  },
): Promise<void> {
  const docs = await clientDocInfos(sb, a.orgId, a.clientId);
  const ids = new Set(docs.map((d) => d.id));
  const checked = checkAboutItems(
    a.items,
    docs.map((d) => ({ id: d.id, pages: [] })),
  );
  if (!checked.length) throw new Error("Keep at least one bullet before approving.");
  if (checked.length !== a.items.length)
    throw new Error(
      "Some bullets have no source in this client's files or mention medical details. Remove them, then approve.",
    );
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("client_about_me")
    .upsert(
      {
        organization_id: a.orgId,
        client_id: a.clientId,
        items: checked,
        drafted_by_nectar: a.draftedByNectar,
        approved_by: a.userId,
        approved_at: now,
        based_on_doc_ids: a.basedOn.filter((id) => ids.has(id)),
        updated_at: now,
      },
      { onConflict: "client_id" },
    )
    .select("id");
  if (error) throw new Error(error.message);
  assertRowsChanged(data as unknown[]);
}
