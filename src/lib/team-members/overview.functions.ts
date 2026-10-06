// Team member Overview + Training section — reads only.
//
// Same checks as getTeamMemberProfile (staff_roster View, Hire & deactivate
// View for someone deactivated, and access_can_see_staff for scoped viewers),
// then service-role reads as separate queries joined in JS. Never embeds
// organization_members <-> profiles. Never reads `role`. All counting lives in
// ./overview.ts (pure, unit-tested).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { hasCategory } from "@/lib/access/can";
import { denverYmd } from "@/lib/denver-date";
import { dailyLogProgram } from "@/lib/daily-log-missing";
import { loadActiveCodesAsService } from "@/lib/clients/codes";
import { loadDailyNoteFacts } from "@/lib/daily-log-missing.functions";
import type { EvidenceFileRow } from "@/lib/evidence/types";
import { inHiveRefUuid } from "@/lib/in-hive-training";
import { isTrainingClassType, trainingClassLabel } from "@/lib/training-class";
import {
  NOTE_LOOKBACK_DAYS,
  buildMemberOverview,
  denverWeek,
  type MemberOverview,
  type OverviewDailyClient,
  type OverviewEvidenceItem,
  type OverviewTimesheet,
} from "@/lib/team-members/overview";
import { addDaysYmd } from "@/lib/team-members/profile";
import { selectIn } from "@/lib/team-members/roster.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const input = z.object({ organizationId: z.string().uuid(), staffUserId: z.string().uuid() });

/**
 * The profile's gate. Null when the person isn't in this agency or the viewer
 * may not see them (same answers getTeamMemberProfile gives).
 */
async function visibleMember(
  supabase: Sb,
  viewerId: string,
  orgId: string,
  staffId: string,
): Promise<{ admin: Sb } | null> {
  const access = await requireCategory(supabase, viewerId, orgId, "staff_roster", "view");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Sb;
  const { data: member, error } = await admin
    .from("organization_members")
    .select("user_id, active")
    .eq("organization_id", orgId)
    .eq("user_id", staffId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) return null;
  const m = member as { user_id: string; active: boolean | null };
  if (m.active === false && !hasCategory(access.categories, "staff_hiring", "view")) return null;
  if (access.scope !== "agency" && staffId !== viewerId) {
    const { data: visible, error: visErr } = await admin.rpc("access_can_see_staff", {
      _org: orgId,
      _staff: staffId,
      _viewer: viewerId,
    });
    if (visErr) throw new Error(visErr.message);
    if (visible !== true) return null;
  }
  return { admin };
}

type ClientNameRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  /** Active service codes (client_billing_codes). */
  codes?: string[];
};

function clientName(c: ClientNameRow): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Client";
}

const TIMESHEET_SELECT =
  "id, client_id, service_type_code, clock_in_timestamp, clock_out_timestamp, corrected_clock_in, corrected_clock_out, review_status, status, shift_note_text, goals_completed, import_source, staff_confirmed_at, is_out_of_bounds, outside_geofence_reason";

/**
 * The person's caseload the way the Daily Logs page resolves it
 * (clients_for_staff: direct assignments + group-home mates). That RPC only
 * answers the person themself or an agency-wide admin; for anyone else fall
 * back to the direct staff_assignments half of the same resolver.
 */
async function caseloadClients(
  supabase: Sb,
  admin: Sb,
  orgId: string,
  staffId: string,
): Promise<ClientNameRow[]> {
  const { data, error } = await supabase.rpc("clients_for_staff", { _org: orgId, _staff: staffId });
  const rows = !error ? ((data ?? []) as ClientNameRow[]) : await directCaseload(admin, orgId, staffId);
  const codes = await loadActiveCodesAsService(admin, rows.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, codes: codes.get(r.id) ?? [] }));
}

/** The direct staff_assignments half of clients_for_staff. */
async function directCaseload(admin: Sb, orgId: string, staffId: string): Promise<ClientNameRow[]> {
  const { data: assigns, error: aErr } = await admin
    .from("staff_assignments")
    .select("client_id")
    .eq("organization_id", orgId)
    .eq("staff_id", staffId);
  if (aErr) throw new Error(aErr.message);
  return selectIn<ClientNameRow>(
    (ids) =>
      admin
        .from("clients")
        .select("id, first_name, last_name")
        .eq("organization_id", orgId)
        .in("id", ids),
    [...new Set(((assigns ?? []) as Array<{ client_id: string }>).map((a) => a.client_id))],
  );
}

/** Null when the person isn't in this agency (or the viewer may not see them). */
export const getMemberOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<MemberOverview | null> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const staffId = data.staffUserId;
    const gate = await visibleMember(supabase as Sb, userId, orgId, staffId);
    if (!gate) return null;
    const { admin } = gate;

    const now = new Date();
    const today = denverYmd(now);
    const week = denverWeek(today);
    const lookback = addDaysYmd(today, -NOTE_LOOKBACK_DAYS);
    const since = lookback < week.start ? lookback : week.start;
    // One day of slack so a Denver-evening punch isn't cut at UTC midnight.
    const sinceIso = `${addDaysYmd(since, -1)}T00:00:00Z`;

    const [items, orgTimesheet, orgDailyLog, timesheets, clients] = await Promise.all([
      admin
        .from("evidence_items")
        .select("*")
        .eq("organization_id", orgId)
        .eq("subject_type", "staff")
        .eq("subject_id", staffId),
      admin.from("evv_timesheets").select("id").eq("organization_id", orgId).limit(1),
      admin.from("daily_logs").select("id").eq("organization_id", orgId).limit(1),
      admin
        .from("evv_timesheets")
        .select(TIMESHEET_SELECT)
        .eq("organization_id", orgId)
        .eq("staff_id", staffId)
        .or(`clock_in_timestamp.gte.${sinceIso},clock_out_timestamp.is.null`),
      caseloadClients(supabase as Sb, admin, orgId, staffId),
    ]);
    for (const r of [items, orgTimesheet, orgDailyLog, timesheets]) {
      if (r.error) throw new Error(r.error.message);
    }

    const evidenceItems = (items.data ?? []) as OverviewEvidenceItem[];
    const files = await selectIn<EvidenceFileRow>(
      (ids) =>
        admin.from("evidence_files").select("*").eq("organization_id", orgId).in("item_id", ids),
      evidenceItems.map((i) => i.id),
    );

    const tsRows = (timesheets.data ?? []) as OverviewTimesheet[];
    const known = new Map(clients.map((c) => [c.id, c] as const));
    const otherIds = [
      ...new Set(tsRows.map((t) => t.client_id).filter((id): id is string => !!id)),
    ].filter((id) => !known.has(id));
    const others = await selectIn<ClientNameRow>(
      (ids) =>
        admin
          .from("clients")
          .select("id, first_name, last_name")
          .eq("organization_id", orgId)
          .in("id", ids),
      otherIds,
    );
    const clientNames: Record<string, string> = {};
    for (const c of [...clients, ...others]) clientNames[c.id] = clientName(c);
    const dailyClients: OverviewDailyClient[] = clients
      .filter((c) => dailyLogProgram(c) !== null)
      .map((c) => ({ id: c.id, name: clientName(c) }));
    // Any assigned staff's note meets the day; the host home provider owes it.
    const dailyFacts = await loadDailyNoteFacts(
      admin,
      orgId,
      dailyClients.map((c) => c.id),
      addDaysYmd(since, -1),
    );

    const usesTimesheets = (orgTimesheet.data ?? []).length > 0;
    return buildMemberOverview({
      staffId,
      today,
      now,
      items: evidenceItems,
      files,
      timesheets: tsRows,
      dailyClients,
      dailyAssignments: dailyFacts.assignments,
      dailyNotes: dailyFacts.notes,
      clientNames,
      usesTimesheets,
      usesNotes: usesTimesheets || (orgDailyLog.data ?? []).length > 0,
    });
  });

/* -------------------------------- training ------------------------------- */

export type MemberTrainingCourse = {
  id: string;
  title: string;
  status: string;
  progressPct: number | null;
  completedAt: string | null;
  expiresAt: string | null;
};

export type MemberTrainingCertificate = {
  id: string;
  title: string;
  /** "Course" (in-platform certificate) or "Class" (class card on file). */
  source: "Course" | "Class";
  issuedAt: string | null;
};

export type MemberTrainingData = {
  courses: MemberTrainingCourse[];
  certificates: MemberTrainingCertificate[];
};

/**
 * What the current training pages read for one person:
 *   hive_training_assignments (+ hive_training_courses title) — HIVE Training roster
 *   training_completions CERT rows for the 30-day / ABI courses — the staff record's
 *     in-platform certificates
 *   training_class_roster rows with a class card — Submitted classes
 */
export const getMemberTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<MemberTrainingData | null> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const staffId = data.staffUserId;
    const gate = await visibleMember(supabase as Sb, userId, orgId, staffId);
    if (!gate) return null;
    const { admin } = gate;

    const [assigns, certs, roster] = await Promise.all([
      admin
        .from("hive_training_assignments")
        .select("id, course_id, status, progress_pct, completed_at, expires_at, created_at")
        .eq("organization_id", orgId)
        .eq("user_id", staffId)
        .order("created_at", { ascending: false }),
      admin
        .from("training_completions")
        .select("id, topic_title, completed_at, ref_id")
        .eq("user_id", staffId)
        .eq("topic_kind", "core")
        .eq("topic_code", "CERT")
        .in("ref_id", [inHiveRefUuid("thirty-day", "__cert__"), inHiveRefUuid("abi", "__cert__")]),
      admin
        .from("training_class_roster")
        .select("id, class_id, card_path, card_uploaded_at")
        .eq("organization_id", orgId)
        .eq("staff_user_id", staffId)
        .not("card_path", "is", null),
    ]);
    for (const r of [assigns, certs, roster]) if (r.error) throw new Error(r.error.message);

    const assignRows = (assigns.data ?? []) as Array<{
      id: string;
      course_id: string | null;
      status: string | null;
      progress_pct: number | null;
      completed_at: string | null;
      expires_at: string | null;
    }>;
    const rosterRows = (roster.data ?? []) as Array<{
      id: string;
      class_id: string;
      card_uploaded_at: string | null;
    }>;
    const [courses, classes] = await Promise.all([
      selectIn<{ id: string; title: string | null }>(
        (ids) => admin.from("hive_training_courses").select("id, title").in("id", ids),
        [...new Set(assignRows.map((a) => a.course_id).filter((id): id is string => !!id))],
      ),
      selectIn<{ id: string; training_type: string | null; completed_at: string | null }>(
        (ids) =>
          admin
            .from("training_classes")
            .select("id, training_type, completed_at")
            .eq("organization_id", orgId)
            .in("id", ids),
        [...new Set(rosterRows.map((r) => r.class_id))],
      ),
    ]);
    const courseTitle = new Map(courses.map((c) => [c.id, c.title] as const));
    const classById = new Map(classes.map((c) => [c.id, c] as const));

    const certificates: MemberTrainingCertificate[] = [
      ...(
        (certs.data ?? []) as Array<{
          id: string;
          topic_title: string | null;
          completed_at: string | null;
        }>
      )
        .filter((c) => !!c.completed_at)
        .map((c) => ({
          id: c.id,
          title: c.topic_title ?? "In-platform course",
          source: "Course" as const,
          issuedAt: c.completed_at,
        })),
      ...rosterRows.map((r) => {
        const cls = classById.get(r.class_id);
        const type = cls?.training_type ?? "";
        return {
          id: r.id,
          title: isTrainingClassType(type) ? trainingClassLabel(type) : "Training class",
          source: "Class" as const,
          issuedAt: cls?.completed_at ?? r.card_uploaded_at,
        };
      }),
    ].sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""));

    return {
      courses: assignRows.map((a) => ({
        id: a.id,
        title: (a.course_id && courseTitle.get(a.course_id)) || "Course",
        status: a.status ?? "assigned",
        progressPct: a.progress_pct,
        completedAt: a.completed_at,
        expiresAt: a.expires_at,
      })),
      certificates,
    };
  });

/** React Query keys — invalidated after any action on the profile. */
export const memberOverviewQueryKey = (orgId: string | null | undefined, staffId: string) =>
  ["team-member-overview", orgId ?? null, staffId] as const;
export const memberTrainingQueryKey = (orgId: string | null | undefined, staffId: string) =>
  ["team-member-training", orgId ?? null, staffId] as const;
