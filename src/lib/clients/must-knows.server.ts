// Server side of Must-knows: Nectar's draft from the client's documents and
// the must-knows already written, and saving what a person approves.
// Approval writes clients.special_directions (the one text every reader
// uses) and keeps each bullet's source in client_must_knows.

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAboutReply, type AboutDocInfo } from "./about-me";
import { askNectarJson, clientDocInfos, readClientDocs } from "./client-doc-texts.server";
import { rows } from "./list-queries";
import { loadPeopleNames } from "./overview-team";
import { assertRowsChanged } from "./writes";
import {
  MUST_KNOWS_SYSTEM,
  checkMustKnowItems,
  formatMustKnows,
  mustKnowsPrompt,
  type MustKnowItem,
  type MustKnowsApproval,
  type MustKnowsDraft,
} from "./must-knows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export type MustKnowsView = { approval: MustKnowsApproval | null; docs: AboutDocInfo[] };

async function loadClient(sb: Sb, orgId: string, clientId: string) {
  const [client] = await rows<{ first_name: string | null; special_directions: string | null }>(
    sb
      .from("clients")
      .select("first_name, special_directions")
      .is("deleted_at", null)
      .eq("organization_id", orgId)
      .eq("id", clientId),
  );
  if (!client) throw new Error("Client not found.");
  return client;
}

export async function loadMustKnowsView(
  sb: Sb,
  orgId: string,
  clientId: string,
): Promise<MustKnowsView> {
  const [found, docs] = await Promise.all([
    rows<{ items: unknown; approved_by: string; approved_at: string; approved_text: string }>(
      sb
        .from("client_must_knows")
        .select("items, approved_by, approved_at, approved_text")
        .eq("organization_id", orgId)
        .eq("client_id", clientId),
    ),
    clientDocInfos(sb, orgId, clientId),
  ]);
  const row = found[0];
  if (!row) return { approval: null, docs };
  const names = await loadPeopleNames(sb, [row.approved_by]);
  return {
    approval: {
      approvedAt: row.approved_at,
      approverName: names.get(row.approved_by) ?? "Team member",
      approvedText: row.approved_text,
      items: Array.isArray(row.items) ? (row.items as MustKnowItem[]) : [],
    },
    docs,
  };
}

const FAILED = "Nectar couldn't draft the must-knows right now. Try again in a minute.";

/** Nectar's draft from the readable documents and the current must-knows. Saves nothing. */
export async function draftMustKnows(
  sb: Sb,
  orgId: string,
  clientId: string,
): Promise<MustKnowsDraft> {
  const client = await loadClient(sb, orgId, clientId);
  const existing = client.special_directions?.trim() || null;
  const { readable, skipped } = await readClientDocs(sb, orgId, clientId);
  if (!readable.length && !existing) return { items: [], basedOn: [], skipped };
  const reply = await askNectarJson(
    orgId,
    MUST_KNOWS_SYSTEM,
    mustKnowsPrompt(client.first_name ?? "", existing, readable),
    FAILED,
  );
  const items = checkMustKnowItems(parseAboutReply(reply), readable, !!existing);
  return { items, basedOn: readable.map((d) => d.id), skipped };
}

/** Save what a person approved: special_directions becomes the bullets; sources are kept. */
export async function approveMustKnows(
  sb: Sb,
  a: { orgId: string; clientId: string; userId: string; items: MustKnowItem[]; basedOn: string[] },
): Promise<void> {
  const [client, docs] = await Promise.all([
    loadClient(sb, a.orgId, a.clientId),
    clientDocInfos(sb, a.orgId, a.clientId),
  ]);
  const ids = new Set(docs.map((d) => d.id));
  const checked = checkMustKnowItems(
    a.items,
    docs.map((d) => ({ id: d.id, pages: [] })),
    !!client.special_directions?.trim(),
  );
  if (!checked.length) throw new Error("Keep at least one bullet before approving.");
  if (checked.length !== a.items.length)
    throw new Error(
      "Some bullets have no source in this client's files. Remove them, then approve.",
    );
  const text = formatMustKnows(checked);
  const now = new Date().toISOString();
  const updated = await sb
    .from("clients")
    .update({ special_directions: text })
    .eq("organization_id", a.orgId)
    .eq("id", a.clientId)
    .select("id");
  if (updated.error) throw new Error(updated.error.message);
  assertRowsChanged(updated.data);
  const saved = await sb
    .from("client_must_knows")
    .upsert(
      {
        organization_id: a.orgId,
        client_id: a.clientId,
        items: checked,
        approved_text: text,
        drafted_by_nectar: true,
        approved_by: a.userId,
        approved_at: now,
        based_on_doc_ids: a.basedOn.filter((id) => ids.has(id)),
        updated_at: now,
      },
      { onConflict: "client_id" },
    )
    .select("id");
  if (saved.error) throw new Error(saved.error.message);
  assertRowsChanged(saved.data);
}
