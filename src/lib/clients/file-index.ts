// The Client file index: per client, the cards (On file / Due soon /
// Missing), the facts behind them and the audit pack. Built from existing
// client artifacts (file-index-queries.ts); no tables of its own.

import { personNeedsSupportStrategies } from "@/lib/audit-evidence";
import {
  buildClientFileCards,
  tallyClientFileCards,
  type ClientFileCard,
  type ClientFileFacts,
  type ClientFileSummary,
} from "./file";
import type { ClientFileDoc } from "./file-docs";
import { strategiesDueOn } from "./plan-dates";
import { currentPlan, type ClientPlan } from "./plans";
import { loadFileRows, loadObligationStatus, maybe, type AnySupabase } from "./file-index-queries";

export type ClientFileMatrixRow = {
  client_id: string;
  full_name: string;
  service_codes: string[];
  active: boolean;
  missing: number;
  due_soon: number;
  on_file: number;
  missing_items: Array<{ title: string; due_at: string | null }>;
};

export type ClientFilePackItem = {
  client_id: string;
  client_name: string;
  title: string;
  filename: string;
  path: string;
  bucket: "client-documents" | "client-photos";
};

export type ClientFileIndex = {
  clients: ClientFileMatrixRow[];
  cardsByClient: Map<string, ClientFileCard[]>;
  factsByClient: Map<string, ClientFileFacts>;
  pack: ClientFilePackItem[];
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
  is_own_guardian: boolean | null;
  grievance_acknowledged: boolean | null;
  grievance_signed_date: string | null;
  client_photo_url: string | null;
  client_photo_taken_on: string | null;
};

function displayName(c: { first_name: string | null; last_name: string | null }): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || "Name not set";
}

/**
 * Org-wide Client file index from existing client artifacts.
 * No new tables. Same three statuses as the per-client tab.
 */
export async function loadOrgClientFileIndex(
  supabase: AnySupabase,
  organizationId: string,
  clientFilter?: string[] | null,
): Promise<ClientFileIndex> {
  const today = new Date().toISOString().slice(0, 10);

  const clientRows = await maybe(
    () =>
      supabase
        .from("clients")
        .select(
          "id, first_name, last_name, account_status, is_own_guardian, grievance_acknowledged, grievance_signed_date, client_photo_url, client_photo_taken_on",
        )
        .is("deleted_at", null)
        .eq("organization_id", organizationId),
    [] as ClientRow[],
  );

  const filterSet = clientFilter?.length ? new Set(clientFilter) : null;
  const scoped = clientRows.filter((c) => !filterSet || filterSet.has(c.id));
  if (!scoped.length)
    return { clients: [], cardsByClient: new Map(), factsByClient: new Map(), pack: [] };

  const clientIds = scoped.map((c) => c.id);

  const { codeRows, docRows, belongRows, summaryRows, pbaRows, ssRows, planRows } =
    await loadFileRows(supabase, organizationId, clientIds);

  const plansByClient = new Map<string, ClientPlan[]>();
  for (const p of planRows)
    plansByClient.set(p.client_id, [...(plansByClient.get(p.client_id) ?? []), p]);

  const codesByClient = new Map<string, Set<string>>();
  for (const r of codeRows) {
    if (!r.service_code) continue;
    if (r.service_end_date && r.service_end_date < today) continue;
    if (r.authorization_pending) continue;
    const set = codesByClient.get(r.client_id) ?? new Set<string>();
    set.add(r.service_code.toUpperCase());
    codesByClient.set(r.client_id, set);
  }

  const docsByClient = new Map<string, ClientFileDoc[]>();
  for (const d of docRows) {
    const list = docsByClient.get(d.client_id) ?? [];
    list.push(d);
    docsByClient.set(d.client_id, list);
  }

  const belongByClient = new Map<string, string>();
  for (const b of belongRows) {
    if (!b.inventoried_on) continue;
    // Belongings are inventoried once (no yearly renewal): any inventory counts.
    const on = b.inventoried_on.slice(0, 10);
    const prev = belongByClient.get(b.client_id);
    if (!prev || on > prev) belongByClient.set(b.client_id, on);
  }

  const summariesByClient = new Map<string, ClientFileSummary[]>();
  for (const s of summaryRows) {
    const list = summariesByClient.get(s.client_id) ?? [];
    list.push(s);
    summariesByClient.set(s.client_id, list);
  }

  const pbaClients = new Set(pbaRows.map((r) => r.client_id));
  const publishedStrategies = new Set(
    ssRows
      .filter((r) => r.status === "published" || r.status === "approved")
      .map((r) => r.client_id),
  );
  const { strategyStatuses, housemateByClient } = await loadObligationStatus(
    supabase,
    organizationId,
    clientIds,
  );

  const now = new Date();
  const clients: ClientFileMatrixRow[] = [];
  const cardsByClient = new Map<string, ClientFileCard[]>();
  const factsByClient = new Map<string, ClientFileFacts>();
  const pack: ClientFilePackItem[] = [];

  for (const c of scoped) {
    const codes = Array.from(codesByClient.get(c.id) ?? []).sort();
    const plan = currentPlan(plansByClient.get(c.id) ?? [], now);
    const docs = docsByClient.get(c.id) ?? [];
    const strategyList = strategyStatuses.get(c.id) ?? [];
    let supportOk = false;
    if (!personNeedsSupportStrategies(codes)) {
      supportOk = false;
    } else if (strategyList.some((s) => s === "completed")) {
      supportOk = true;
    } else if (publishedStrategies.has(c.id)) {
      supportOk = true;
    }

    const facts: ClientFileFacts = {
      codes,
      photoPath: c.client_photo_url || null,
      photoTakenOn: c.client_photo_taken_on,
      isOwnGuardian: c.is_own_guardian === true,
      grievanceOk: !!c.grievance_acknowledged || !!c.grievance_signed_date,
      planEndDate: plan?.end_date?.slice(0, 10) ?? null,
      docs,
      belongingsOn: belongByClient.get(c.id) ?? null,
      supportStrategiesOk: supportOk,
      supportStrategiesDueAt: strategiesDueOn(plan),
      housemateOnFile: housemateByClient.get(c.id)?.onFile ?? false,
      housemateDueAt: housemateByClient.get(c.id)?.dueAt ?? null,
      summaries: summariesByClient.get(c.id) ?? [],
      hasPbaAccount: pbaClients.has(c.id),
    };

    const cards = buildClientFileCards(c.id, facts, now);
    cardsByClient.set(c.id, cards);
    factsByClient.set(c.id, facts);
    const counts = tallyClientFileCards(cards);
    const missingItems = cards
      .filter((card) => card.status === "missing")
      .map((card) => ({ title: card.title, due_at: card.dueAt }));
    const name = displayName(c);
    clients.push({
      client_id: c.id,
      full_name: name,
      service_codes: codes,
      active: (c.account_status ?? "active") === "active",
      missing: counts.missing,
      due_soon: counts.due_soon,
      on_file: counts.on_file,
      missing_items: missingItems,
    });
    for (const card of cards) {
      if (card.status !== "on_file" || !card.evidencePath || !card.evidenceBucket) continue;
      pack.push({
        client_id: c.id,
        client_name: name,
        title: card.title,
        filename: card.evidenceFilename ?? "evidence",
        path: card.evidencePath,
        bucket: card.evidenceBucket,
      });
    }
  }

  clients.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { clients, cardsByClient, factsByClient, pack };
}
