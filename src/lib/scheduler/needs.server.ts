// Loads everything Needs you reads (B5) and builds the list with buildNeeds
// (needs-list.ts). Runs as the signed-in user, so RLS limits every row to what
// they may see (a scoped lead sees their homes). Who was offered a shift,
// asked to fix a punch or sent a card reminder lives in other people's
// notifications (needs-notices.server.ts, service role, after the caller's
// scheduling check). Called by loadNeedsYou (needs.functions.ts) for the page,
// the board banner and the menu count.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hasCategory } from "@/lib/access/can";
import { isAgencyAdmin, isOwner } from "@/lib/access/levels";
import type { MemberAccess } from "@/lib/access/member";
import { loadAuthOutlook } from "@/lib/scheduler/auth-outlook-load";
import type { BoardShift } from "@/lib/scheduler/board-model";
import { approvalHome, type ApprovalHome } from "@/lib/scheduler/needs-approvers";
import { cardFindings } from "@/lib/scheduler/needs-cards";
import { needsWindow, type NeedItem } from "@/lib/scheduler/needs-items";
import { buildNeeds } from "@/lib/scheduler/needs-list";
import { needsNotices } from "@/lib/scheduler/needs-notices.server";
import { loadStaffEvidence, rows } from "@/lib/scheduler/rule-staff-facts.server";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";

type Db = SupabaseClient<Database>;

export const NEED_SHIFT_COLUMNS =
  "id, staff_id, client_id, team_id, service_code, starts_at, ends_at, status, published, parent_shift_id, open_spots, override_reason, shift_type, notes, claim_requested_by";

const iso = (ymd: string) => parseLocalDate(ymd).toISOString();
const person = (p: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}) =>
  (p.full_name ?? "").trim() ||
  [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
  "Team member";

async function paged<T>(
  page: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const got = await rows(page(from));
    out.push(...got);
    if (got.length < 1000) return out;
  }
}

export async function loadNeeds(
  db: Db,
  orgId: string,
  userId: string,
  access: MemberAccess,
): Promise<NeedItem[]> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = dayKey(now);
  const win = needsWindow(today);
  const org = orgId;
  const [
    shifts,
    teams,
    clients,
    members,
    punches,
    callouts,
    timeOff,
    swaps,
    fixes,
    homeSettings,
    settings,
    outlook,
  ] = await Promise.all([
    rows(
      db
        .from("scheduled_shifts")
        .select(NEED_SHIFT_COLUMNS)
        .eq("organization_id", org)
        .gte("starts_at", iso(win.from))
        .lt("starts_at", iso(win.until)),
    ),
    rows(
      db
        .from("teams")
        .select("id, team_name, team_type, manager_id")
        .eq("organization_id", org)
        .eq("active", true),
    ),
    rows(
      db
        .from("clients")
        .select("id, first_name, last_name, team_id")
        .eq("organization_id", org)
        .is("deleted_at", null),
    ),
    rows(
      db
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org)
        .eq("active", true)
        .is("deleted_at", null),
    ),
    paged((from) =>
      db
        .from("evv_timesheets")
        .select("scheduled_shift_id, staff_id, client_id, clock_in_timestamp")
        .eq("organization_id", org)
        .gte("clock_in_timestamp", iso(win.from))
        .order("clock_in_timestamp")
        .range(from, from + 999),
    ),
    rows(
      db
        .from("shift_callouts")
        .select("id, scheduled_shift_id, staff_id, reason, created_at")
        .eq("organization_id", org)
        .eq("status", "open"),
    ),
    rows(
      db
        .from("time_off_requests")
        .select("id, staff_id, start_date, end_date, type, note, status")
        .eq("organization_id", org)
        .in("status", ["pending", "approved"])
        .gte("end_date", today),
    ),
    rows(
      db
        .from("shift_swap_requests")
        .select("id, shift_id, from_staff_id, to_staff_id, note")
        .eq("organization_id", org)
        .eq("status", "pending")
        .eq("partner_status", "accepted"),
    ),
    rows(
      db
        .from("evv_timesheets")
        .select(
          "id, staff_id, client_id, service_type_code, clock_in_timestamp, clock_out_timestamp, corrected_clock_in, corrected_clock_out, edit_reason, override_reason",
        )
        .eq("organization_id", org)
        .eq("review_status", "needs_review")
        .order("clock_in_timestamp"),
    ),
    rows(
      db
        .from("team_schedule_settings")
        .select("team_id, swap_approval, timeoff_approval")
        .eq("organization_id", org),
    ),
    db
      .from("org_shift_behavior_settings")
      .select("ot_threshold_hours")
      .eq("organization_id", org)
      .maybeSingle(),
    loadAuthOutlook(db, org, win.week[0]!),
  ]);

  // Shifts a swap, call-out or time off points at that fall outside the window.
  const have = new Set(shifts.map((s) => s.id));
  const missing = [
    ...new Set([...swaps.map((w) => w.shift_id), ...callouts.map((c) => c.scheduled_shift_id)]),
  ].filter((id) => !have.has(id));
  const offStaff = [...new Set(timeOff.map((t) => t.staff_id))];
  const offFrom = timeOff.map((t) => t.start_date).sort()[0];
  const offTo = timeOff
    .map((t) => t.end_date)
    .sort()
    .at(-1);
  const [byId, byStaff] = await Promise.all([
    missing.length
      ? rows(db.from("scheduled_shifts").select(NEED_SHIFT_COLUMNS).in("id", missing))
      : [],
    offStaff.length && offFrom && offTo
      ? rows(
          db
            .from("scheduled_shifts")
            .select(NEED_SHIFT_COLUMNS)
            .eq("organization_id", org)
            .in("staff_id", offStaff)
            .neq("status", "cancelled")
            .gte("starts_at", iso(offFrom))
            .lt("starts_at", iso(addDaysKey(offTo, 1))),
        )
      : [],
  ]);
  const all = new Map<string, BoardShift>();
  for (const s of [...shifts, ...byId, ...byStaff]) all.set(s.id, s as BoardShift);
  const allShifts = [...all.values()];

  const ids = [...new Set(members.map((m) => m.user_id).filter((x): x is string => !!x))];
  const profiles = ids.length
    ? await rows(
        db
          .from("profiles")
          .select("id, full_name, first_name, last_name, phone, hire_date")
          .in("id", ids),
      )
    : [];
  const upcoming = allShifts.filter(
    (s) => s.staff_id && s.status !== "cancelled" && s.starts_at > nowIso,
  );
  const working = [...new Set(upcoming.map((s) => s.staff_id!))];
  const evidence = await loadStaffEvidence(db, org, working);

  const openIds = allShifts.filter((s) => !s.staff_id).map((s) => s.id);
  const watchIds = allShifts
    .filter((s) => s.staff_id && s.starts_at < now.toISOString())
    .map((s) => s.id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sent = await needsNotices(supabaseAdmin, org, {
    open: allShifts.filter((s) => !s.staff_id).map((s) => s.id),
    started: allShifts.filter((s) => s.staff_id && s.starts_at < nowIso).map((s) => s.id),
    staff: working,
    todayStart: iso(today),
  });

  const homes = new Map<string, ApprovalHome>(
    teams.map((t) => [t.id, approvalHome(t, homeSettings.find((h) => h.team_id === t.id) ?? null)]),
  );
  const staff = new Map(profiles.map((p) => [p.id, { name: person(p), phone: p.phone ?? null }]));
  const facts = profiles
    .filter((p) => working.includes(p.id))
    .map((p) => ({
      id: p.id,
      name: person(p),
      active: true,
      age: null,
      hireDate: p.hire_date,
      timeOff: [],
    }));

  return buildNeeds({
    now,
    week: win.week,
    openUntil: win.until,
    viewer: {
      userId,
      isOwner: isOwner(access.level),
      isAgencyAdmin: isAgencyAdmin(access.level, access.scope),
      canEditScheduling: hasCategory(access.categories, "scheduling", "edit"),
      canEditTimesheets: hasCategory(access.categories, "timesheets", "edit"),
    },
    shifts: allShifts,
    staff,
    teams: new Map(teams.map((t) => [t.id, { name: t.team_name }])),
    clients: new Map(
      clients.map((c) => [
        c.id,
        {
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client",
          team_id: c.team_id,
        },
      ]),
    ),
    homes,
    punches,
    callouts,
    swaps,
    timeOff,
    punchFixes: fixes,
    cards: cardFindings(facts, upcoming, evidence, today),
    outlook,
    otHours: Number(settings.data?.ot_threshold_hours ?? 40),
    ...sent,
  });
}
