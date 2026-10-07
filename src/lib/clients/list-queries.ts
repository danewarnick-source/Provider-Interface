// Queries behind the client list (list-load.ts). Each takes the caller's
// RLS-scoped client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientCodeRow } from "./codes";
import {
  DISCHARGED_STATUSES,
  draftMatches,
  searchTerms,
  type ClientListRow,
  type ListFilters,
} from "./list";
import type { UsageCode, UsageDay, UsageTimesheet } from "./units";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sb = SupabaseClient<any>;

export type ClientBase = {
  id: string;
  first_name: string;
  last_name: string;
  client_photo_url: string | null;
  medicaid_id: string | null;
  client_pid: string | null;
  account_status: string | null;
  team_id: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  is_own_guardian: boolean | null;
};
export type AuthRow = ClientCodeRow & UsageCode & { authorization_pending: boolean | null };

const DISCHARGED_IN = `(${DISCHARGED_STATUSES.join(",")})`;

export async function rows<T>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function groupBy<T>(
  list: readonly T[],
  key: (t: T) => string | null | undefined,
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of list) {
    const k = key(t);
    if (!k) continue;
    const arr = out.get(k) ?? [];
    arr.push(t);
    out.set(k, arr);
  }
  return out;
}

export async function loadClients(sb: Sb, orgId: string, f: ListFilters): Promise<ClientBase[]> {
  let q = sb
    .from("clients")
    .select(
      "id, first_name, last_name, client_photo_url, medicaid_id, client_pid, account_status, team_id, home_latitude, home_longitude, is_own_guardian",
    )
    .eq("organization_id", orgId);
  q =
    f.view === "discharged"
      ? q.in("account_status", [...DISCHARGED_STATUSES])
      : q.or(`account_status.is.null,account_status.not.in.${DISCHARGED_IN}`);
  for (const t of searchTerms(f.search)) {
    q = q.or(
      `first_name.ilike.%${t}%,last_name.ilike.%${t}%,medicaid_id.ilike.%${t}%,client_pid.ilike.%${t}%`,
    );
  }
  return rows<ClientBase>(q.order("last_name", { ascending: true }).limit(2000));
}

export async function countView(sb: Sb, orgId: string, discharged: boolean): Promise<number> {
  let q = sb
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  q = discharged
    ? q.in("account_status", [...DISCHARGED_STATUSES])
    : q.or(`account_status.is.null,account_status.not.in.${DISCHARGED_IN}`);
  const { count } = await q;
  return count ?? 0;
}

export async function loadUsage(sb: Sb, orgId: string, ids: string[], auths: AuthRow[]) {
  const starts = auths
    .map((a) => a.service_start_date)
    .filter((d): d is string => !!d)
    .sort();
  if (ids.length === 0 || starts.length === 0)
    return { sheets: [] as UsageTimesheet[], days: [] as UsageDay[] };
  const from = starts[0];
  const [sheets, days] = await Promise.all([
    rows<UsageTimesheet>(
      sb
        .from("evv_timesheets")
        .select(
          "client_id, service_type_code, clock_in_timestamp, clock_out_timestamp, rounded_clock_in, rounded_clock_out, corrected_clock_in, corrected_clock_out, review_status, shift_note_text",
        )
        .eq("organization_id", orgId)
        .in("client_id", ids)
        .gte("clock_in_timestamp", from),
    ),
    rows<UsageDay>(
      sb
        .from("hhs_daily_records_v")
        .select("client_id, record_date, service_code")
        .eq("organization_id", orgId)
        .in("client_id", ids)
        .eq("billable", true)
        .gte("record_date", from),
    ),
  ]);
  return { sheets, days };
}

export async function loadDrafts(sb: Sb, orgId: string, f: ListFilters): Promise<ClientListRow[]> {
  if (f.view !== "active" || f.code || f.homeId || f.staffId) return [];
  const subjects = await rows<{ id: string; display_name: string | null }>(
    sb
      .from("import_subjects")
      .select("id, display_name")
      .eq("org_id", orgId)
      .eq("subject_type", "client")
      .is("committed_at", null)
      .is("discarded_at", null),
  ).catch(() => []);
  const terms = searchTerms(f.search);
  return subjects
    .filter((s) => draftMatches(s.display_name ?? "", terms))
    .map((s) => {
      const [first, ...rest] = (s.display_name?.trim() || "Unnamed imported client").split(/\s+/);
      return {
        id: s.id,
        kind: "draft" as const,
        first_name: first,
        last_name: rest.join(" "),
        photo_url: null,
        medicaid_id: null,
        client_pid: null,
        account_status: null,
        codes: [],
        home: null,
        unitsLeft: null,
        nextDue: null,
        staff: [],
        readiness: { ready: false, missing: ["Finish setup"] },
      };
    });
}
