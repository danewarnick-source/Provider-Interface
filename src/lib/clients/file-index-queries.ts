// Batched reads behind the Client file index (file-index.ts): every
// artifact the cards need for a set of clients, and the housemate
// obligation status. RLS-scoped caller's client.

import type { ClientFileDoc } from "./file-docs";
import { isHousemateObligationTitle, type ClientFileSummary } from "./file";
import type { ClientPlan } from "./plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = any;

export const UUID_CHUNK = 80;

export function chunkIds(ids: string[]): string[][] {
  if (!ids.length) return [];
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += UUID_CHUNK) {
    out.push(ids.slice(i, i + UUID_CHUNK));
  }
  return out;
}

export async function maybe<T>(
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  fallback: T,
): Promise<T> {
  const { data, error } = await fn();
  if (error) {
    console.warn("[client-file]", error.message);
    return fallback;
  }
  return (data ?? fallback) as T;
}

/** Codes, documents, belongings, summaries, PBA and plans for `clientIds`. */
export async function loadFileRows(
  supabase: AnySupabase,
  organizationId: string,
  clientIds: string[],
) {
  const codeRows: Array<{
    client_id: string;
    service_code: string | null;
    service_end_date: string | null;
    authorization_pending: boolean | null;
  }> = [];
  const docRows: Array<ClientFileDoc & { client_id: string }> = [];
  const belongRows: Array<{ client_id: string; inventoried_on: string | null }> = [];
  const summaryRows: Array<ClientFileSummary & { client_id: string }> = [];
  const pbaRows: Array<{ client_id: string }> = [];
  const planRows: ClientPlan[] = [];

  for (const ids of chunkIds(clientIds)) {
    const [codes, docs, belongs, summaries, pbas, plans] = await Promise.all([
      maybe(
        () =>
          supabase
            .from("client_billing_codes")
            .select("client_id, service_code, service_end_date, authorization_pending")
            .eq("organization_id", organizationId)
            .in("client_id", ids),
        [] as typeof codeRows,
      ),
      maybe(
        () =>
          supabase
            .from("client_documents")
            .select(
              "client_id, id, document_type, file_name, storage_path, uploaded_at, effective_from, expires_on",
            )
            .eq("organization_id", organizationId)
            .in("client_id", ids)
            // Archived and replaced documents don't count toward the file.
            .is("archived_at", null)
            .neq("status", "outdated"),
        [] as typeof docRows,
      ),
      maybe(
        () =>
          supabase
            .from("client_belongings")
            .select("client_id, inventoried_on")
            .eq("organization_id", organizationId)
            .in("client_id", ids),
        [] as typeof belongRows,
      ),
      maybe(
        () =>
          supabase
            .from("client_progress_summaries")
            .select(
              "client_id, status, due_date, finalized_at, requires_upi_attestation, upi_entered_at, period_label",
            )
            .eq("organization_id", organizationId)
            .in("client_id", ids)
            .order("due_date", { ascending: false }),
        [] as Array<ClientFileSummary & { client_id: string }>,
      ),
      maybe(
        () =>
          supabase
            .from("pba_accounts")
            .select("client_id")
            .eq("organization_id", organizationId)
            .in("client_id", ids),
        [] as Array<{ client_id: string }>,
      ),
      maybe(
        () =>
          supabase
            .from("client_plans")
            .select(
              "id, client_id, start_date, end_date, activated_on, meeting_date, status, label, source, document_id, created_at",
            )
            .eq("organization_id", organizationId)
            .in("client_id", ids),
        [] as ClientPlan[],
      ),
    ]);
    codeRows.push(...codes);
    docRows.push(...docs);
    belongRows.push(...belongs);
    summaryRows.push(...summaries);
    pbaRows.push(...pbas);
    planRows.push(...plans);
  }
  return { codeRows, docRows, belongRows, summaryRows, pbaRows, planRows };
}

/** Housemate discussion on file / due per client, from company obligations. */
export async function loadHousemateStatus(
  supabase: AnySupabase,
  organizationId: string,
  clientIds: string[],
) {
  const obligations = await maybe(
    () =>
      supabase
        .from("company_obligations")
        .select("id, title")
        .eq("organization_id", organizationId),
    [] as Array<{ id: string; title: string }>,
  );
  const housemateObIds = obligations
    .filter((o) => isHousemateObligationTitle(o.title))
    .map((o) => o.id);
  const housemateByClient = new Map<string, { onFile: boolean; dueAt: string | null }>();
  if (!housemateObIds.length) return housemateByClient;
  for (const ids of chunkIds(clientIds)) {
    const inst = await maybe(
      () =>
        supabase
          .from("company_obligation_instances")
          .select("client_id, obligation_id, status, due_at, upload_path")
          .eq("organization_id", organizationId)
          .in("client_id", ids)
          .in("obligation_id", housemateObIds),
      [] as Array<{
        client_id: string | null;
        obligation_id: string;
        status: string | null;
        due_at: string | null;
        upload_path: string | null;
      }>,
    );
    for (const row of inst) {
      if (!row.client_id) continue;
      const done = row.status === "completed" || row.status === "waived" || !!row.upload_path;
      const prev = housemateByClient.get(row.client_id);
      housemateByClient.set(row.client_id, {
        onFile: !!(prev?.onFile || done),
        dueAt: prev?.dueAt ?? row.due_at,
      });
    }
  }
  return housemateByClient;
}
