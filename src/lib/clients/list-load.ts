// Server-side assembly of the client list: one pass over the org's clients
// with codes, home, units left, next due item, team members and readiness.
// Runs with the caller's RLS-scoped client, so scoped managers see only
// their clients. Called only from list.functions.ts.

import { activeCodesForClients, isActiveCodeRow, loadActiveCodes } from "./codes";
import { guardianSatisfied, loadClientContacts, type ClientContact } from "./contacts";
import { todayYmd } from "./dates";
import {
  applyListFilters,
  endedCodesFor,
  listReadiness,
  nextDueItem,
  planHasExpired,
  sortRows,
  type ClientListRow,
  type ListFilters,
} from "./list";
import {
  countView,
  groupBy,
  loadClients,
  loadPreferredNames,
  loadUsage,
  rows,
  type AuthRow,
  type Sb,
} from "./list-queries";
import { worstUnitsLeft } from "./units";

export type ClientListResult = {
  rows: ClientListRow[];
  counts: { active: number; discharged: number };
  homes: { id: string; name: string }[];
  staffOptions: { id: string; name: string }[];
  codeOptions: string[];
  hasReferrals: boolean;
};

/** Everything the list page shows, in one call. */
export async function loadClientList(
  sb: Sb,
  orgId: string,
  f: ListFilters,
  opts: { referralsVisible: boolean; now?: Date },
): Promise<ClientListResult> {
  const now = opts.now ?? new Date();
  const today = todayYmd(now);
  const [clients, homes, active, discharged, referralCount] = await Promise.all([
    loadClients(sb, orgId, f),
    rows<{ id: string; team_name: string }>(
      sb.from("teams").select("id, team_name").eq("organization_id", orgId).order("team_name"),
    ),
    countView(sb, orgId, false),
    countView(sb, orgId, true),
    opts.referralsVisible
      ? sb
          .from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .is("discarded_at", null)
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);
  const ids = clients.map((c) => c.id);
  const [codes, auths, assignments, contacts, plans, summaries, preferred] = await Promise.all([
    loadActiveCodes(sb, ids),
    ids.length
      ? rows<AuthRow>(
          sb
            .from("client_billing_codes")
            .select(
              "client_id, service_code, service_start_date, service_end_date, annual_unit_authorization, authorization_pending",
            )
            .eq("organization_id", orgId)
            .in("client_id", ids),
        ).catch(() => [])
      : [],
    ids.length
      ? rows<{ client_id: string; staff_id: string }>(
          sb
            .from("staff_assignments")
            .select("client_id, staff_id")
            .eq("organization_id", orgId)
            .in("client_id", ids),
        )
      : [],
    loadClientContacts(sb, ids),
    ids.length
      ? rows<{ client_id: string; end_date: string | null; status: string | null }>(
          sb
            .from("client_plans")
            .select("client_id, end_date, status")
            .eq("organization_id", orgId)
            .in("client_id", ids)
            .eq("status", "current"),
        )
      : [],
    ids.length
      ? rows<{ client_id: string; due_date: string | null }>(
          sb
            .from("client_progress_summaries")
            .select("client_id, due_date")
            .eq("organization_id", orgId)
            .in("client_id", ids)
            .is("completed_at", null),
        )
      : [],
    loadPreferredNames(sb, orgId, ids),
  ]);
  const activeAuths = auths.filter((a) => isActiveCodeRow(a, today));
  const endedBy = groupBy(
    auths.filter((a) => !isActiveCodeRow(a, today)),
    (a) => a.client_id,
  );
  const usage = await loadUsage(sb, orgId, ids, activeAuths);
  const staffIds = [...new Set(assignments.map((a) => a.staff_id))];
  const profiles = staffIds.length
    ? await rows<{
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(sb.from("profiles").select("id, full_name, first_name, last_name").in("id", staffIds))
    : [];
  const staffName = new Map(
    profiles.map((p) => [
      p.id,
      p.full_name?.trim() || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Team member",
    ]),
  );
  const homeName = new Map(homes.map((h) => [h.id, h.team_name]));
  const authBy = groupBy(activeAuths, (a) => a.client_id);
  const sheetBy = groupBy(usage.sheets, (s) => s.client_id);
  const dayBy = groupBy(usage.days, (d) => d.client_id);
  const staffBy = groupBy(assignments, (a) => a.client_id);
  const contactBy = groupBy<ClientContact>(contacts, (c) => c.client_id);
  const planBy = groupBy(plans, (p) => p.client_id);
  const summaryBy = groupBy(summaries, (s) => s.client_id);
  const authCodes = activeCodesForClients(activeAuths, now);

  const built: ClientListRow[] = clients.map((c) => {
    const clientCodes = codes.get(c.id) ?? authCodes.get(c.id) ?? [];
    const clientAuths = authBy.get(c.id) ?? [];
    const clientPlans = planBy.get(c.id) ?? [];
    const endedCodes = endedCodesFor(clientCodes, endedBy.get(c.id) ?? []);
    const staff = [
      ...new Map(
        (staffBy.get(c.id) ?? []).map((a) => [
          a.staff_id,
          { id: a.staff_id, name: staffName.get(a.staff_id) ?? "Team member" },
        ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const nextDue = nextDueItem(
      [
        ...clientPlans.map((p) => ({
          kind: "plan" as const,
          label: "Plan renews",
          date: p.end_date,
        })),
        ...clientAuths.map((a) => ({
          kind: "authorization" as const,
          label: `${a.service_code} authorization ends`,
          date: a.service_end_date,
        })),
        ...(summaryBy.get(c.id) ?? []).map((s) => ({
          kind: "summary" as const,
          label: "Summary due",
          date: s.due_date,
        })),
      ],
      now,
    );
    const row: ClientListRow = {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      preferred_name: preferred.get(c.id) ?? null,
      photo_url: c.client_photo_url,
      medicaid_id: c.medicaid_id,
      client_pid: c.client_pid,
      account_status: c.account_status,
      codes: clientCodes,
      endedCodes,
      planExpired: planHasExpired(clientPlans, today),
      home:
        c.team_id && homeName.has(c.team_id)
          ? { id: c.team_id, name: homeName.get(c.team_id)! }
          : null,
      unitsLeft: worstUnitsLeft(clientAuths, sheetBy.get(c.id) ?? [], dayBy.get(c.id) ?? []),
      needsUnits: clientAuths.some(
        (a) => !a.authorization_pending && !(Number(a.annual_unit_authorization) > 0),
      ),
      nextDue,
      staff,
      readiness: listReadiness({
        codes: clientCodes,
        staffCount: staff.length,
        hasPin: c.home_latitude != null && c.home_longitude != null,
        guardianOk: guardianSatisfied(c.is_own_guardian, contactBy.get(c.id) ?? [], now),
        endedOn: endedCodes?.endedOn ?? null,
      }),
    };
    return row;
  });

  const staffOptions = [
    ...new Map(built.flatMap((r) => r.staff).map((s) => [s.id, s])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const codeOptions = [...new Set(built.flatMap((r) => r.codes))].sort();
  return {
    rows: sortRows(applyListFilters(built, f)),
    counts: { active, discharged },
    homes: homes.map((h) => ({ id: h.id, name: h.team_name })),
    staffOptions,
    codeOptions,
    hasReferrals: referralCount > 0,
  };
}
