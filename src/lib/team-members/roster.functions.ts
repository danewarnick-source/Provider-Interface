// Team Members roster — one server call loads everything the roster draws.
//
// Checks first (staff_roster View, then the viewer's scope), then reads with
// the service-role client as separate queries joined in JS. Never embeds
// organization_members <-> profiles (no FK between them). Never reads the
// legacy `role` column. A person's requirements come only from Evidence
// (evidence_items / evidence_files), summarised by src/lib/team-members/roster.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { hasCategory } from "@/lib/access/can";
import { denverYmd } from "@/lib/denver-date";
import { parseIsoDate, resolveHireDate } from "@/lib/evidence/due";
import { splitPersonName } from "@/lib/team-members/import";
import {
  EMPTY_EVIDENCE,
  asRosterLevel,
  filterByViewerScope,
  isEmployeeOnActiveRoster,
  lastLoginByUserId,
  missingInfoFor,
  profileNeedsSetup,
  summarizeEvidence,
  type RosterEvidenceFile,
  type RosterEvidenceItem,
  type RosterRow,
} from "@/lib/team-members/roster";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const CHUNK = 150;

/** .in() in slices so a big agency never overflows the request URL. */
export async function selectIn<T>(
  build: (ids: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ids: readonly string[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await build(ids.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

type MemberRow = {
  id: string;
  user_id: string;
  access_level: string | null;
  access_preset_id: string | null;
  job_title: string | null;
  manager_id: string | null;
  active: boolean | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  employee_id: string | null;
  photo_path: string | null;
  position: string | null;
  team_id: string | null;
  hire_date: string | null;
  start_date: string | null;
  date_of_birth: string | null;
  home_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  must_change_password: boolean | null;
  account_status: string | null;
  is_active: boolean | null;
  department: string | null;
  worker_type: string | null;
  custom_attributes: unknown;
};

const PROFILE_SELECT =
  "id, full_name, first_name, last_name, email, phone, employee_id, photo_path, position, team_id, hire_date, start_date, date_of_birth, home_address, emergency_contact_name, emergency_contact_phone, must_change_password, account_status, is_active, department, worker_type, custom_attributes";

export function displayNameOf(p: ProfileRow | undefined): {
  display: string;
  first: string;
  last: string;
} {
  const split = splitPersonName(p?.full_name ?? "");
  const first = p?.first_name?.trim() || split.first_name;
  const last = p?.last_name?.trim() || split.last_name;
  const display =
    p?.full_name?.trim() || [first, last].filter(Boolean).join(" ") || p?.email || "—";
  return { display, first, last };
}

/** Everyone in the org the viewer may see: members + profiles, scope-filtered. */
export async function loadVisibleMembers(args: {
  admin: Sb;
  organizationId: string;
  viewerId: string;
  scope: "agency" | "assigned" | "self";
}): Promise<{ members: MemberRow[]; profiles: Map<string, ProfileRow> }> {
  const { admin, organizationId, viewerId, scope } = args;
  const { data: memberData, error } = await admin
    .from("organization_members")
    .select(
      "id, user_id, access_level, access_preset_id, job_title, manager_id, active, created_at",
    )
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  const all = (memberData ?? []) as MemberRow[];
  const visible = new Set(
    await filterByViewerScope({
      scope,
      viewerId,
      userIds: all.map((m) => m.user_id),
      canSee: async (staffId) => {
        const { data, error: rpcErr } = await admin.rpc("access_can_see_staff", {
          _org: organizationId,
          _staff: staffId,
          _viewer: viewerId,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        return data === true;
      },
    }),
  );
  const members = all.filter((m) => visible.has(m.user_id));
  const profs = await selectIn<ProfileRow>(
    (ids) => admin.from("profiles").select(PROFILE_SELECT).in("id", ids),
    members.map((m) => m.user_id),
  );
  return { members, profiles: new Map(profs.map((p) => [p.id, p])) };
}

export const listTeamRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) =>
    z.object({ organizationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RosterRow[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const access = await requireCategory(supabase as Sb, userId, orgId, "staff_roster", "view");
    // Deactivated people belong to Hire & deactivate (View shows them).
    const seesInactive = hasCategory(access.categories, "staff_hiring", "view");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;
    const { members: visibleMembers, profiles } = await loadVisibleMembers({
      admin,
      organizationId: orgId,
      viewerId: userId,
      scope: access.scope,
    });
    const isActive = (m: MemberRow) =>
      isEmployeeOnActiveRoster({ active: m.active !== false, profile: profiles.get(m.user_id) });
    const members = visibleMembers.filter((m) => seesInactive || isActive(m));
    if (!members.length) return [];
    const userIds = members.map((m) => m.user_id);

    // Supervisor: manager_id -> organization_members.id -> that member's profile.
    const { data: allMembers, error: allErr } = await admin
      .from("organization_members")
      .select("id, user_id")
      .eq("organization_id", orgId);
    if (allErr) throw new Error(allErr.message);
    const userIdByMemberId = new Map(
      ((allMembers ?? []) as Array<{ id: string; user_id: string }>).map((m) => [m.id, m.user_id]),
    );
    const supervisorUserIds = [
      ...new Set(
        members
          .map((m) => (m.manager_id ? (userIdByMemberId.get(m.manager_id) ?? null) : null))
          .filter((id): id is string => !!id),
      ),
    ];
    const presetIds = [
      ...new Set(members.map((m) => m.access_preset_id).filter((id): id is string => !!id)),
    ];
    const teamIds = [
      ...new Set(
        userIds.map((id) => profiles.get(id)?.team_id ?? null).filter((id): id is string => !!id),
      ),
    ];
    const emails = [
      ...new Set(
        userIds
          .map((id) => profiles.get(id)?.email?.trim().toLowerCase() ?? "")
          .filter((e) => e.includes("@")),
      ),
    ];

    const [presets, teams, supervisors, signIns, invites, items] = await Promise.all([
      selectIn<{ id: string; name: string }>(
        (ids) =>
          admin
            .from("access_presets")
            .select("id, name")
            .eq("organization_id", orgId)
            .in("id", ids),
        presetIds,
      ),
      selectIn<{ id: string; team_name: string | null }>(
        (ids) =>
          admin.from("teams").select("id, team_name").eq("organization_id", orgId).in("id", ids),
        teamIds,
      ),
      selectIn<{
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }>(
        (ids) =>
          admin
            .from("profiles")
            .select("id, full_name, first_name, last_name, email")
            .in("id", ids),
        supervisorUserIds,
      ),
      admin.rpc("org_member_last_sign_ins", { _org: orgId }),
      selectIn<{ id: string; email: string }>(
        (ids) =>
          admin
            .from("invitations")
            .select("id, email")
            .eq("organization_id", orgId)
            .eq("status", "pending")
            .in("email", ids),
        emails,
      ),
      // select("*") so review_status / opted_out_at are read once they exist.
      selectIn<RosterEvidenceItem>(
        (ids) =>
          admin
            .from("evidence_items")
            .select("*")
            .eq("organization_id", orgId)
            .eq("subject_type", "staff")
            .in("subject_id", ids),
        userIds,
      ),
    ]);
    const files = await selectIn<RosterEvidenceFile>(
      (ids) =>
        admin.from("evidence_files").select("*").eq("organization_id", orgId).in("item_id", ids),
      items.map((i) => i.id),
    );

    const presetName = new Map(presets.map((p) => [p.id, p.name]));
    const teamName = new Map(teams.map((t) => [t.id, t.team_name ?? null]));
    const supervisorName = new Map(
      supervisors.map((p) => [p.id, displayNameOf(p as ProfileRow).display]),
    );
    const signInKnown = !signIns.error;
    const lastLogin = lastLoginByUserId(signIns.error ? null : signIns.data);
    const inviteByEmail = new Map(invites.map((i) => [i.email.trim().toLowerCase(), i.id]));
    const itemsBySubject = new Map<string, RosterEvidenceItem[]>();
    for (const item of items) {
      const list = itemsBySubject.get(item.subject_id) ?? [];
      list.push(item);
      itemsBySubject.set(item.subject_id, list);
    }
    const filesByItem = new Map<string, RosterEvidenceFile[]>();
    for (const f of files) {
      const list = filesByItem.get(f.item_id) ?? [];
      list.push(f);
      filesByItem.set(f.item_id, list);
    }
    const today = denverYmd();

    return members.map((m): RosterRow => {
      const p = profiles.get(m.user_id);
      const name = displayNameOf(p);
      const myItems = itemsBySubject.get(m.user_id) ?? [];
      const myFiles = myItems.flatMap((i) => filesByItem.get(i.id) ?? []);
      const supervisorId = m.manager_id ? (userIdByMemberId.get(m.manager_id) ?? null) : null;
      const email = p?.email ?? "";
      const level = asRosterLevel(m.access_level);
      const needsSetup = profileNeedsSetup(p?.custom_attributes);
      return {
        userId: m.user_id,
        memberId: m.id,
        displayName: name.display,
        firstName: name.first,
        lastName: name.last,
        email,
        phone: p?.phone ?? "",
        employeeId: p?.employee_id ?? "",
        photoPath: p?.photo_path ?? null,
        jobTitle: m.job_title?.trim() || p?.position?.trim() || null,
        accessLevel: level,
        presetId: level === "owner" ? null : m.access_preset_id,
        presetName:
          level === "owner" || !m.access_preset_id
            ? null
            : (presetName.get(m.access_preset_id) ?? null),
        homeId: p?.team_id ?? null,
        homeName: p?.team_id ? (teamName.get(p.team_id) ?? null) : null,
        supervisorId,
        supervisorName: supervisorId ? (supervisorName.get(supervisorId) ?? null) : null,
        hireDate: parseIsoDate(resolveHireDate(p?.hire_date, p?.start_date)),
        active: isActive(m),
        mustChangePassword: p?.must_change_password === true,
        lastSignInAt: lastLogin.get(m.user_id) ?? null,
        lastSignInKnown: signInKnown && lastLogin.has(m.user_id),
        pendingInviteId: inviteByEmail.get(email.trim().toLowerCase()) ?? null,
        evidence: myItems.length ? summarizeEvidence(myItems, myFiles, today) : EMPTY_EVIDENCE,
        missingInfo: missingInfoFor(p),
        needsSetup,
        setup: needsSetup
          ? { department: p?.department ?? "", workerType: p?.worker_type ?? "" }
          : null,
      };
    });
  });
