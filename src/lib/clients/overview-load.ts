// Server-side assembly of one client's Overview: units pace per code, the
// needs-attention list (readiness.ts), must-knows, coming up, team and the
// last notes. Runs with the caller's RLS-scoped client; called only from
// overview.functions.ts.

import { personNeedsSupportStrategies } from "@/lib/audit-evidence";
import { computeRestrictionCompletion, type RestrictionRecord } from "./hrc";
import { isActiveCodeRow, loadActiveCodes } from "./codes";
import { guardianSatisfied, loadClientContacts } from "./contacts";
import { todayYmd } from "./dates";
import { loadOrgClientFileIndex } from "./file.functions";
import { loadUsage, rows, type AuthRow, type Sb } from "./list-queries";
import { comingUpItems, lastNotes, type ClientOverview } from "./overview";
import { loadOverviewTeam } from "./overview-team";
import type { ClientPlan } from "./plans";
import { clientAttention, codePace } from "./readiness";
import { usedUnitsForCode } from "./units";

const SKIP_FILE_CARDS = new Set(["photograph", "support_strategies", "service_summary"]);

type ClientFacts = {
  special_directions: string | null;
  client_photo_url: string | null;
  client_photo_taken_on: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  is_own_guardian: boolean | null;
  has_abi: boolean | null;
};

export async function loadClientOverview(
  sb: Sb,
  orgId: string,
  clientId: string,
  now: Date = new Date(),
): Promise<ClientOverview> {
  const today = todayYmd(now);
  const ids = [clientId];
  const clientRows = await rows<ClientFacts>(
    sb
      .from("clients")
      .select(
        "special_directions, client_photo_url, client_photo_taken_on, home_latitude, home_longitude, is_own_guardian, has_abi",
      )
      .eq("id", clientId)
      .eq("organization_id", orgId),
  );
  const client = clientRows[0];
  if (!client) throw new Error("Client not found in this organization");
  const [codes, auths, contacts, plans, summaries, restrictions, strategies, fileIndex, team] =
    await Promise.all([
      loadActiveCodes(sb, ids),
      rows<AuthRow>(
        sb
          .from("client_billing_codes")
          .select(
            "client_id, service_code, service_start_date, service_end_date, annual_unit_authorization, authorization_pending",
          )
          .eq("organization_id", orgId)
          .eq("client_id", clientId),
      ).catch(() => [] as AuthRow[]),
      loadClientContacts(sb, ids),
      rows<ClientPlan>(sb.from("client_plans").select("*").eq("client_id", clientId)),
      rows<{ period_label: string | null; due_date: string | null }>(
        sb
          .from("client_progress_summaries")
          .select("period_label, due_date")
          .eq("organization_id", orgId)
          .eq("client_id", clientId)
          .is("completed_at", null)
          .is("finalized_at", null),
      ),
      rows<RestrictionRecord>(
        sb.from("hrc_restriction_records").select("*").eq("client_id", clientId).eq("active", true),
      ).catch(() => [] as RestrictionRecord[]),
      rows<{ status: string | null }>(
        sb
          .from("client_specific_trainings")
          .select("status")
          .eq("client_id", clientId)
          .eq("training_type", "support_strategies"),
      ).catch(() => []),
      loadOrgClientFileIndex(sb, orgId, ids),
      loadOverviewTeam(sb, orgId, clientId, client.has_abi === true),
    ]);
  const clientCodes = codes.get(clientId) ?? [];
  const activeAuths = auths.filter((a) => isActiveCodeRow(a, today));
  const usage = await loadUsage(sb, orgId, ids, activeAuths);
  const paces = activeAuths
    .map((a) => codePace(a, usedUnitsForCode(a, usage.sheets, usage.days).usedUnits, now))
    .sort((a, b) => a.code.localeCompare(b.code));

  const attention = clientAttention(
    {
      codes: clientCodes,
      paces,
      fileCards: (fileIndex.cardsByClient.get(clientId) ?? []).filter(
        (c) => !SKIP_FILE_CARDS.has(c.key),
      ),
      photo: { url: client.client_photo_url, takenOn: client.client_photo_taken_on },
      plans,
      strategies: personNeedsSupportStrategies(clientCodes)
        ? { published: strategies.some((s) => s.status === "published") }
        : null,
      summaries: summaries.map((s) => ({ label: s.period_label ?? "", dueDate: s.due_date })),
      restrictions: restrictions.map((r) => ({
        title: r.restriction_title,
        nextReview: r.next_review_date,
        complete: computeRestrictionCompletion(r).isComplete,
      })),
      setup: {
        staffCount: team.length,
        hasPin: client.home_latitude != null && client.home_longitude != null,
        guardianOk: guardianSatisfied(client.is_own_guardian, contacts, now),
      },
    },
    now,
  );

  const [shifts, notes] = await Promise.all([
    loadUpcomingShifts(sb, orgId, clientId, now),
    loadRecentNotes(sb, orgId, clientId),
  ]);
  const teamNames = new Map(team.map((t) => [t.id, t.name]));
  const current = plans.find((p) => p.status === "current");
  return {
    attention,
    paces,
    mustKnows: client.special_directions?.trim() || null,
    comingUp: comingUpItems(
      {
        shifts: shifts.map((s) => ({
          ...s,
          staffName: s.staff_id ? (teamNames.get(s.staff_id) ?? "Team member") : null,
        })),
        due: [
          ...(current?.end_date
            ? [
                {
                  key: "plan-end",
                  label: "Plan year ends",
                  date: current.end_date,
                  section: "plans" as const,
                },
              ]
            : []),
          ...activeAuths.map((a) => ({
            key: `auth:${a.service_code}`,
            label: `${a.service_code} authorization ends`,
            date: a.service_end_date,
            section: "services" as const,
          })),
          ...summaries.map((s, i) => ({
            key: `summary:${i}`,
            label: `Summary ${s.period_label ?? ""}`.trim(),
            date: s.due_date,
            section: "plans" as const,
          })),
        ],
      },
      now,
    ),
    team,
    lastNotes: lastNotes(notes),
  };
}

async function loadUpcomingShifts(sb: Sb, orgId: string, clientId: string, now: Date) {
  return rows<{
    id: string;
    starts_at: string;
    service_code: string | null;
    staff_id: string | null;
  }>(
    sb
      .from("scheduled_shifts")
      .select("id, starts_at, service_code, staff_id")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(10),
  ).catch(() => []);
}

async function loadRecentNotes(sb: Sb, orgId: string, clientId: string) {
  const [sheets, logs] = await Promise.all([
    rows<{
      id: string;
      clock_in_timestamp: string | null;
      service_type_code: string | null;
      shift_note_text: string | null;
    }>(
      sb
        .from("evv_timesheets")
        .select("id, clock_in_timestamp, service_type_code, shift_note_text")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .not("shift_note_text", "is", null)
        .order("clock_in_timestamp", { ascending: false })
        .limit(6),
    ).catch(() => []),
    rows<{ id: string; log_date: string | null; narrative: string | null }>(
      sb
        .from("daily_logs")
        .select("id, log_date, narrative")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("log_date", { ascending: false })
        .limit(6),
    ).catch(() => []),
  ]);
  return [
    ...sheets.map((s) => ({
      key: `shift:${s.id}`,
      date: s.clock_in_timestamp ? todayYmd(new Date(s.clock_in_timestamp)) : "",
      kind: "shift" as const,
      code: s.service_type_code,
      author: null,
      text: s.shift_note_text ?? "",
    })),
    ...logs.map((l) => ({
      key: `daily:${l.id}`,
      date: l.log_date ?? "",
      kind: "daily" as const,
      code: null,
      author: null,
      text: l.narrative ?? "",
    })),
  ];
}
