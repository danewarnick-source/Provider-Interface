// The background late-clock-in alerts (B5), run by the hook route
// /api/public/hooks/scheduler-tick every 5 minutes. Service role,
// across every agency: published shifts with a person that started in the
// last LATE_LOOKBACK_HOURS and have no clock-in. At +10 minutes the person
// gets a nudge; at +30 the home's lead (else the agency's schedulers) gets an
// alert. The rules are late-punch.ts (lateAlerts, lateLeadRecipients); the
// notification rows are the record of what was sent (needs-notices.server.ts),
// so a rerun never sends twice. Texts: code, day and time; no client names.
import { hasCategory } from "../access/can.ts";
import { isAgencyAdmin } from "../access/levels.ts";
import {
  MEMBER_ACCESS_SELECT,
  resolveMemberAccess,
  type MemberAccessRow,
} from "../access/member.ts";
import {
  LATE_LOOKBACK_HOURS,
  LATE_NUDGE_MINUTES,
  lateAlerts,
  lateAlertText,
  lateLeadRecipients,
  type PunchShift,
  type ShiftPunch,
} from "./late-punch.ts";
import { LATE_LEAD, LATE_NUDGE, sentNotices } from "./needs-notices.server.ts";
import { notify, type SchedulerNotification } from "./notify.ts";
import { rows } from "./rule-staff-facts.server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type Shift = PunchShift & { organization_id: string; team_id: string | null };

/** Owners and agency-wide Admins with Scheduling edit, per agency. */
async function schedulersByOrg(admin: Db, orgIds: string[]): Promise<Map<string, string[]>> {
  const members = await rows<MemberAccessRow & { user_id: string; organization_id: string }>(
    admin
      .from("organization_members")
      .select(`user_id, organization_id, ${MEMBER_ACCESS_SELECT}`)
      .in("organization_id", orgIds)
      .eq("active", true)
      .is("deleted_at", null),
  );
  const out = new Map<string, string[]>();
  for (const m of members) {
    const a = resolveMemberAccess(m);
    if (!isAgencyAdmin(a.level, a.scope) || !hasCategory(a.categories, "scheduling", "edit"))
      continue;
    out.set(m.organization_id, [...(out.get(m.organization_id) ?? []), m.user_id]);
  }
  return out;
}

async function punchesSince(admin: Db, orgIds: string[], fromIso: string): Promise<ShiftPunch[]> {
  const out: ShiftPunch[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await rows<ShiftPunch>(
      admin
        .from("evv_timesheets")
        .select("scheduled_shift_id, staff_id, client_id, clock_in_timestamp")
        .in("organization_id", orgIds)
        .gte("clock_in_timestamp", fromIso)
        .order("clock_in_timestamp")
        .range(from, from + 999),
    );
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export async function runLateAlerts(
  admin: Db,
  now = new Date(),
): Promise<{ nudges: number; leads: number }> {
  const since = new Date(now.getTime() - LATE_LOOKBACK_HOURS * 3_600_000).toISOString();
  const until = new Date(now.getTime() - LATE_NUDGE_MINUTES * 60_000).toISOString();
  const shifts = await rows<Shift>(
    admin
      .from("scheduled_shifts")
      .select(
        "id, organization_id, staff_id, client_id, team_id, service_code, starts_at, ends_at, status, published, parent_shift_id",
      )
      .eq("published", true)
      .not("staff_id", "is", null)
      .gte("starts_at", since)
      .lte("starts_at", until),
  );
  if (!shifts.length) return { nudges: 0, leads: 0 };
  const orgIds = [...new Set(shifts.map((s) => s.organization_id))];
  const ids = shifts.map((s) => s.id);
  const [punches, nudged, alerted] = await Promise.all([
    punchesSince(admin, orgIds, new Date(Date.parse(since) - 3_600_000).toISOString()),
    sentNotices(admin, null, LATE_NUDGE, ids),
    sentNotices(admin, null, LATE_LEAD, ids),
  ]);
  const sent = new Set([
    ...nudged.map((n) => `nudge:${n.related_id}`),
    ...alerted.map((n) => `lead:${n.related_id}`),
  ]);
  const due = lateAlerts(shifts, punches, sent, now) as Array<{
    shift: Shift;
    kind: "nudge" | "lead";
  }>;
  if (!due.length) return { nudges: 0, leads: 0 };

  const leadsDue = due.filter((d) => d.kind === "lead");
  const teamIds = [
    ...new Set(leadsDue.map((d) => d.shift.team_id).filter((x): x is string => !!x)),
  ];
  const staffIds = [...new Set(leadsDue.map((d) => d.shift.staff_id!))];
  const [teams, profiles, schedulers] = await Promise.all([
    teamIds.length
      ? rows<{ id: string; team_type: string | null; manager_id: string | null }>(
          admin.from("teams").select("id, team_type, manager_id").in("id", teamIds),
        )
      : Promise.resolve([]),
    staffIds.length
      ? rows<{ id: string; first_name: string | null; full_name: string | null }>(
          admin.from("profiles").select("id, first_name, full_name").in("id", staffIds),
        )
      : Promise.resolve([]),
    leadsDue.length ? schedulersByOrg(admin, orgIds) : Promise.resolve(new Map<string, string[]>()),
  ]);
  const firstName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return (p?.first_name ?? p?.full_name?.split(/\s+/)[0] ?? "").trim() || "The team member";
  };

  const notes: SchedulerNotification[] = [];
  for (const { shift: s, kind } of due) {
    const base = {
      organization_id: s.organization_id,
      urgency: "urgent",
      related_id: s.id,
    };
    if (kind === "nudge") {
      notes.push({
        ...base,
        ...LATE_NUDGE,
        ...lateAlertText(s, "nudge", now),
        recipient_role: "staff",
        recipient_user_id: s.staff_id!,
        link_to: `/dashboard/shift/${s.id}`,
      });
      continue;
    }
    const home = s.team_id ? (teams.find((t) => t.id === s.team_id) ?? null) : null;
    const to = lateLeadRecipients(home, schedulers.get(s.organization_id) ?? []);
    for (const id of to)
      notes.push({
        ...base,
        ...LATE_LEAD,
        ...lateAlertText(s, "lead", now, firstName(s.staff_id!)),
        recipient_role: "admin",
        recipient_user_id: id,
        link_to: "/dashboard/scheduler/needs?kind=late",
      });
  }
  await notify(admin, notes);
  return {
    nudges: due.filter((d) => d.kind === "nudge").length,
    leads: leadsDue.length,
  };
}
