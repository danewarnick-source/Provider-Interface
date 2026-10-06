// A client's service codes come from one place: their active authorization
// rows in client_billing_codes (the 1056). A row is active until its
// service_end_date (an end date of today or earlier closes it).
// Pure helpers plus one loader that takes the caller's Supabase client.

import { todayYmd } from "./dates.ts";

export interface ClientCodeRow {
  client_id: string;
  service_code: string | null;
  service_end_date: string | null;
}

/** True when the authorization row is still open on `today` (YYYY-MM-DD). */
export function isActiveCodeRow(row: Pick<ClientCodeRow, "service_end_date">, today: string): boolean {
  return !row.service_end_date || row.service_end_date.slice(0, 10) > today;
}

function addCode(list: string[], raw: string | null): void {
  const code = String(raw ?? "").trim().toUpperCase();
  if (code && !list.includes(code)) list.push(code);
}

/** Active codes for every client in `rows`: client_id → sorted, upper-cased, distinct codes. */
export function activeCodesForClients(
  rows: readonly ClientCodeRow[],
  now: Date = new Date(),
): Map<string, string[]> {
  const today = todayYmd(now);
  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!isActiveCodeRow(r, today)) continue;
    const list = out.get(r.client_id) ?? [];
    addCode(list, r.service_code);
    out.set(r.client_id, list);
  }
  for (const list of out.values()) list.sort();
  return out;
}

/** Active codes for one client (sorted, upper-cased, distinct); [] when none. */
export function activeCodesForClient(
  rows: readonly ClientCodeRow[],
  clientId: string,
  now: Date = new Date(),
): string[] {
  return activeCodesForClients(
    rows.filter((r) => r.client_id === clientId),
    now,
  ).get(clientId) ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodesSupabase = { rpc: (...args: any[]) => any };

/**
 * Load active codes for some clients through client_active_codes (codes only,
 * no rates; works for staff, who can't read client_billing_codes directly).
 * Every requested client is in the map; no active codes → [].
 */
export async function loadActiveCodes(
  supabase: CodesSupabase,
  clientIds: readonly string[],
): Promise<Map<string, string[]>> {
  const ids = [...new Set(clientIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc("client_active_codes", { _client_ids: ids });
  if (error) throw new Error(error.message);
  const map = activeCodesForClients((data ?? []) as ClientCodeRow[]);
  for (const id of ids) if (!map.has(id)) map.set(id, []);
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TableSupabase = { from: (table: string) => any };

/**
 * Same result as loadActiveCodes, read straight from client_billing_codes.
 * For server code running with the service role (no signed-in user, so the
 * client_active_codes access check would see nothing).
 */
export async function loadActiveCodesAsService(
  supabase: TableSupabase,
  clientIds: readonly string[],
): Promise<Map<string, string[]>> {
  const ids = [...new Set(clientIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("client_billing_codes")
    .select("client_id, service_code, service_end_date")
    .in("client_id", ids);
  if (error) throw new Error(error.message);
  const map = activeCodesForClients((data ?? []) as ClientCodeRow[]);
  for (const id of ids) if (!map.has(id)) map.set(id, []);
  return map;
}
