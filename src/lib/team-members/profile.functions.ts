// Team member profile — one server call loads everything the page draws.
//
// Checks first (staff_roster View, the viewer's scope, and Hire & deactivate
// View for someone already deactivated), then reads with the service-role
// client as separate queries joined in JS. Never embeds organization_members
// <-> profiles (no FK). Never reads the legacy `role` column. Badges come only
// from Evidence (evidence_items / evidence_files). Date of birth and pay are
// only returned to viewers allowed to see them.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { hasCategory } from "@/lib/access/can";
import { isOwner } from "@/lib/access/levels";
import { denverYmd } from "@/lib/denver-date";
import { parseIsoDate, resolveHireDate } from "@/lib/evidence/due";
import type { EvidenceFileRow } from "@/lib/evidence/types";
import type { BadgeEvidenceItem } from "@/lib/team-members/badges";
import {
  SEPARATION_REASONS,
  TIME_OFF_WINDOW_DAYS,
  addDaysYmd,
  canSeeDateOfBirth,
  memberStatus,
  type SeparationReason,
  type TeamMemberProfileData,
} from "@/lib/team-members/profile";
import { asRosterLevel, lastLoginByUserId } from "@/lib/team-members/roster";
import { displayNameOf, selectIn } from "@/lib/team-members/roster.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

type NameRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const PROFILE_SELECT =
  "id, full_name, first_name, last_name, email, username, phone, photo_path, home_address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, date_of_birth, hire_date, start_date, worker_type, transports_clients, staff_type_keys, employee_id, team_id, hourly_rate, daily_rate";

function asReason(v: string | null | undefined): SeparationReason | null {
  return (SEPARATION_REASONS as readonly string[]).includes(v ?? "")
    ? (v as SeparationReason)
    : null;
}

/** Null when the person isn't in this agency (or the viewer may not see them). */
export const getTeamMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), staffId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<TeamMemberProfileData | null> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const access = await requireCategory(supabase as Sb, userId, orgId, "staff_roster", "view");
    const cats = access.categories;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;

    const { data: memberRow, error: memErr } = await admin
      .from("organization_members")
      .select(
        "id, user_id, active, access_level, access_preset_id, job_title, manager_id, end_date, separation_reason, rehire_eligible",
      )
      .eq("organization_id", orgId)
      .eq("user_id", data.staffId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!memberRow) return null;
    const m = memberRow as {
      id: string;
      user_id: string;
      active: boolean | null;
      access_level: string | null;
      access_preset_id: string | null;
      job_title: string | null;
      manager_id: string | null;
      end_date: string | null;
      separation_reason: string | null;
      rehire_eligible: boolean | null;
    };
    if (m.active === false && !hasCategory(cats, "staff_hiring", "view")) return null;
    if (access.scope !== "agency" && data.staffId !== userId) {
      const { data: visible, error } = await admin.rpc("access_can_see_staff", {
        _org: orgId,
        _staff: data.staffId,
        _viewer: userId,
      });
      if (error) throw new Error(error.message);
      if (visible !== true) return null;
    }

    const { data: profRow, error: profErr } = await admin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", data.staffId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (profRow ?? {}) as Record<string, any>;

    const viewerIsOwner = isOwner(access.level);
    const seeDob = canSeeDateOfBirth({
      isOwner: viewerIsOwner,
      staffHiringView: hasCategory(cats, "staff_hiring", "view"),
    });
    const canEditDob = hasCategory(cats, "staff_hiring", "edit");
    const canSeePay = hasCategory(cats, "payroll", "view");
    const canEditPay = hasCategory(cats, "payroll", "edit");
    const today = denverYmd();
    const email = String(p.email ?? "").trim();

    const [allMembers, presets, teams, staffTypes, signIns, invites, timeOff, items] =
      await Promise.all([
        admin
          .from("organization_members")
          .select("id, user_id, active")
          .eq("organization_id", orgId),
        admin.from("access_presets").select("id, name").eq("organization_id", orgId),
        admin.from("teams").select("id, team_name, active").eq("organization_id", orgId),
        admin.from("staff_types").select("key, label").eq("organization_id", orgId),
        admin.rpc("org_member_last_sign_ins", { _org: orgId }),
        email
          ? admin
              .from("invitations")
              .select("id, status, created_at")
              .eq("organization_id", orgId)
              .eq("email", email.toLowerCase())
          : Promise.resolve({ data: [], error: null }),
        admin
          .from("time_off_requests")
          .select("id, start_date, end_date, type, status")
          .eq("organization_id", orgId)
          .eq("staff_id", data.staffId)
          .in("status", ["approved", "pending"])
          .gte("end_date", today)
          .lte("start_date", addDaysYmd(today, TIME_OFF_WINDOW_DAYS))
          .order("start_date", { ascending: true }),
        // select("*") so skip columns are read once they exist.
        admin
          .from("evidence_items")
          .select("*")
          .eq("organization_id", orgId)
          .eq("subject_type", "staff")
          .eq("subject_id", data.staffId),
      ]);
    for (const r of [allMembers, presets, teams, staffTypes, invites, timeOff, items]) {
      if (r.error) throw new Error(r.error.message);
    }
    const evidenceItems = (items.data ?? []) as BadgeEvidenceItem[];
    const files = await selectIn<EvidenceFileRow>(
      (ids) =>
        admin.from("evidence_files").select("*").eq("organization_id", orgId).in("item_id", ids),
      evidenceItems.map((i) => i.id),
    );

    const memberList = (allMembers.data ?? []) as Array<{
      id: string;
      user_id: string;
      active: boolean | null;
    }>;
    const supervisorMember = m.manager_id ? memberList.find((x) => x.id === m.manager_id) : null;
    const activeOthers = memberList.filter((x) => x.active !== false && x.user_id !== data.staffId);
    const nameIds = [
      ...new Set([
        ...activeOthers.map((x) => x.user_id),
        ...(supervisorMember ? [supervisorMember.user_id] : []),
        ...evidenceItems.map((i) => i.opted_out_by).filter((id): id is string => !!id),
        ...evidenceItems
          .flatMap((i) => (Array.isArray(i.history) ? i.history.map((h) => h?.by) : []))
          .filter((id): id is string => typeof id === "string" && !!id),
        ...files.flatMap((f) => [f.reviewed_by, f.uploaded_by]).filter((id): id is string => !!id),
      ]),
    ];
    const nameRows = await selectIn<NameRow>(
      (ids) =>
        admin.from("profiles").select("id, full_name, first_name, last_name, email").in("id", ids),
      nameIds,
    );
    const names: Record<string, string> = {};
    for (const r of nameRows) names[r.id] = displayNameOf(r as never).display;

    const lastLogin = lastLoginByUserId(signIns.error ? null : signIns.data);
    const inviteRows = (invites.data ?? []) as Array<{ id: string; status: string | null }>;
    const pending = inviteRows.find((i) => i.status === "pending") ?? null;
    const name = displayNameOf(p as never);
    const teamRows = (teams.data ?? []) as Array<{
      id: string;
      team_name: string | null;
      active: boolean | null;
    }>;
    const presetName =
      ((presets.data ?? []) as Array<{ id: string; name: string | null }>).find(
        (x) => x.id === m.access_preset_id,
      )?.name ?? null;

    return {
      member: {
        id: m.id,
        userId: m.user_id,
        active: m.active !== false,
        accessLevel: asRosterLevel(m.access_level),
        presetId: m.access_preset_id,
        presetName: asRosterLevel(m.access_level) === "owner" ? "Owner" : presetName,
        jobTitle: m.job_title,
        supervisorMemberId: m.manager_id,
        supervisorName: supervisorMember ? (names[supervisorMember.user_id] ?? null) : null,
        endDate: m.end_date,
        separationReason: asReason(m.separation_reason),
        rehireEligible: m.rehire_eligible,
      },
      profile: {
        firstName: name.first,
        lastName: name.last,
        displayName: name.display,
        email,
        username: p.username ?? null,
        phone: p.phone ?? null,
        photoPath: p.photo_path ?? null,
        homeAddress: p.home_address ?? null,
        emergencyContactName: p.emergency_contact_name ?? null,
        emergencyContactRelationship: p.emergency_contact_relationship ?? null,
        emergencyContactPhone: p.emergency_contact_phone ?? null,
        dateOfBirth: seeDob ? (p.date_of_birth ?? null) : null,
        hireDate: parseIsoDate(resolveHireDate(p.hire_date, p.start_date)),
        workerType: p.worker_type ?? null,
        transportsClients: p.transports_clients === true,
        staffTypeKeys: (p.staff_type_keys ?? []) as string[],
        employeeId: p.employee_id ?? null,
        homeId: p.team_id ?? null,
        homeName: teamRows.find((t) => t.id === p.team_id)?.team_name ?? null,
      },
      status: memberStatus({
        active: m.active !== false,
        lastSignInAt: lastLogin.get(data.staffId) ?? null,
        lastSignInKnown: !signIns.error && lastLogin.has(data.staffId),
        hasInvite: inviteRows.length > 0,
      }),
      pendingInviteId: pending?.id ?? null,
      lastSignInAt: lastLogin.get(data.staffId) ?? null,
      lastSignInKnown: !signIns.error && lastLogin.has(data.staffId),
      pay: canSeePay
        ? {
            hourlyRate: p.hourly_rate != null ? Number(p.hourly_rate) : null,
            dailyRate: p.daily_rate != null ? Number(p.daily_rate) : null,
          }
        : null,
      timeOff: (
        (timeOff.data ?? []) as Array<{
          id: string;
          start_date: string;
          end_date: string;
          type: string;
          status: string;
        }>
      ).map((t) => ({
        id: t.id,
        startDate: t.start_date,
        endDate: t.end_date,
        type: t.type,
        status: t.status,
      })),
      evidence: { items: evidenceItems, files },
      names,
      options: {
        homes: teamRows
          .filter((t) => t.active !== false || t.id === p.team_id)
          .map((t) => ({ id: t.id, name: String(t.team_name ?? "").trim() || "Unnamed home" }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        supervisors: activeOthers
          .map((x) => ({ memberId: x.id, name: names[x.user_id] ?? "Team member" }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        staffTypes: ((staffTypes.data ?? []) as Array<{ key: string; label: string | null }>)
          .map((s) => ({ key: s.key, label: String(s.label ?? "").trim() || s.key }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
      viewer: {
        canSeeDateOfBirth: seeDob,
        canEditDateOfBirth: canEditDob,
        canSeePay,
        canEditPay,
      },
    };
  });
