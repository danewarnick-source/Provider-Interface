import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  onStaffHiredInternal,
  reevaluateStaffDutiesInternal,
} from "@/lib/staff-assignment-hooks.functions";
import { resolveAccountUsername } from "@/lib/account-username";
import { assertAgencySetupCompleteForOrg } from "@/lib/agency-setup-gate.functions";
import { generateTempPassword } from "@/lib/temp-password";
import { requireCategory, requireLevel } from "@/lib/access/require";
import type { AccessLevel } from "@/lib/access/levels";
import { resolvePresetId } from "@/lib/access/preset-resolve";
import { logChange } from "@/lib/access/change-log.server";
import { assertCanManageMember } from "@/lib/team-members/guards.server";
import { usernameAfterEmailChange } from "@/lib/team-members/profile";
import { sendTeamMemberInvitesInternal } from "@/lib/team-members/invites.functions";
import { loadStaffDutyFactsInternal } from "@/lib/obligations/load-staff-duty-facts.functions";
import {
  EMAIL_TAKEN_MESSAGE,
  IMPORT_MAX_ROWS,
  OWNER_ACCESS,
  WORKER_TYPES,
  accessNeedsOwner,
  classifyEmailMatch,
  normalizeEmail,
  resolveAccessChoice,
  resolveSupervisorMemberId,
  type EmailMatch,
  type PresetPick,
  type ResolvedAccess,
} from "@/lib/team-members/add-member";
import type { CaseloadFacts, EvidencePersonFacts } from "@/lib/team-members/evidence-answers";

type MemberInsert = Database["public"]["Tables"]["organization_members"]["Insert"];

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ------------------------------------------------------------------ */
/* Shared hire path                                                    */
/* ------------------------------------------------------------------ */

export type HireTeamMemberInput = {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  accessLevel: AccessLevel;
  /** Null for Owner. Undefined for Admin / Team member uses that level's default preset. */
  accessPresetId?: string | null;
  hireDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dateOfBirth?: string | null;
  department?: string | null;
  employeeId?: string | null;
  /** profiles.staff_type_keys — the Position list (staff_types keys). */
  staffType?: string[];
  workerType?: string | null;
  /** Only written when given; new rows otherwise take the column default (false). */
  transportsClients?: boolean;
  /** profiles.team_id — the person's home. Only written when given. */
  teamId?: string | null;
  /** organization_members.manager_id. Only written when given. */
  managerId?: string | null;
  /** organization_members.job_title. Omit to keep the department → job title path. */
  jobTitle?: string | null;
  /** Only written when given. Add team member leaves them null ("not answered"). */
  requiresAbi?: boolean;
  requiresDeescalation?: boolean;
  username?: string | null;
};

export type HireTeamMemberResult = {
  userId: string;
  email: string;
  created: boolean;
  /** Server-generated, only when a new login was created. Shown once, never stored. */
  tempPassword: string | null;
  presetId: string | null;
};

/**
 * One hire path for Add team member, Import team members and Smart Import.
 * Generates the password on the server. Never sends email. Manual adds refuse
 * an existing account; Smart Import links it.
 */
export async function hireTeamMemberInternal(
  data: HireTeamMemberInput,
  actorUserId: string,
  createdVia: "manual_admin" | "smart_import" = "manual_admin",
): Promise<HireTeamMemberResult> {
  await assertAgencySetupCompleteForOrg(supabaseAdmin, data.organizationId);

  const effectiveEmail = normalizeEmail(data.email);
  const startDate = data.startDate || data.hireDate || null;
  const endDate = data.endDate || null;
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be on or after Start date.");
  }

  const findByEmail = async () =>
    (await supabaseAdmin.from("profiles").select("id").eq("email", effectiveEmail).maybeSingle())
      .data;

  const existingProf = await findByEmail();
  if (existingProf?.id && createdVia === "manual_admin") {
    throw new Error(EMAIL_TAKEN_MESSAGE);
  }

  let newUserId = existingProf?.id ?? "";
  let created = false;
  let tempPassword: string | null = null;

  if (!newUserId) {
    const password = generateTempPassword();
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: effectiveEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `${data.firstName} ${data.lastName}`.trim(),
        created_via: createdVia,
      },
    });
    if (createErr || !createdUser.user) {
      const msg = createErr?.message || "Failed to create user";
      if (!/already/i.test(msg)) throw new Error(msg);
      if (createdVia === "manual_admin") throw new Error(EMAIL_TAKEN_MESSAGE);
      const again = await findByEmail();
      if (!again?.id) throw new Error(msg);
      newUserId = again.id;
    } else {
      newUserId = createdUser.user.id;
      created = true;
      tempPassword = password;
    }
  }

  try {
    const profileRow: Record<string, unknown> = {
      id: newUserId,
      email: effectiveEmail,
      full_name: `${data.firstName} ${data.lastName}`.trim(),
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone?.trim() || null,
      department: data.department || null,
      employee_id: data.employeeId || null,
      staff_type_keys: data.staffType ?? [],
      hire_date: startDate,
      start_date: startDate,
      end_date: endDate,
      is_active: true,
    };
    if (data.dateOfBirth) profileRow.date_of_birth = data.dateOfBirth;
    if (data.workerType) profileRow.worker_type = data.workerType;
    if (data.transportsClients !== undefined)
      profileRow.transports_clients = data.transportsClients;
    if (data.teamId !== undefined) profileRow.team_id = data.teamId;
    if (data.requiresAbi !== undefined) profileRow.requires_abi = data.requiresAbi;
    if (data.requiresDeescalation !== undefined) {
      profileRow.requires_deescalation = data.requiresDeescalation;
    }
    if (created) {
      profileRow.must_change_password = true;
      profileRow.username = resolveAccountUsername({
        username: data.username ?? "",
        email: effectiveEmail,
      });
    } else if (data.username?.trim()) {
      profileRow.username = resolveAccountUsername({
        username: data.username,
        email: effectiveEmail,
      });
    }

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(profileRow as any, { onConflict: "id" });
    if (profErr) throw new Error(profErr.message);

    // The live signup trigger may have opened a personal workspace. This
    // hire writes the real membership itself and does not need that org.
    // After docs/SQL_HANDOFF_signup_after_confirm.sql, the trigger only
    // inserts a profile and this update is a no-op.
    await supabaseAdmin
      .from("organization_members")
      .update({ active: false })
      .eq("user_id", newUserId)
      .neq("organization_id", data.organizationId);

    const jobTitle =
      data.jobTitle !== undefined ? data.jobTitle?.trim() || null : data.department || null;
    const presetId =
      data.accessLevel === "owner"
        ? null
        : await resolvePresetId(data.organizationId, data.accessLevel, {
            id: data.accessPresetId,
          });
    const { error: memErr } = await supabaseAdmin.from("organization_members").upsert(
      {
        organization_id: data.organizationId,
        user_id: newUserId,
        access_level: data.accessLevel,
        access_preset_id: presetId,
        job_title: jobTitle,
        active: true,
        ...(data.managerId !== undefined ? { manager_id: data.managerId } : {}),
        // access_normalize_member() fills access_scope before the NOT NULL check.
      } satisfies Omit<MemberInsert, "access_scope"> as MemberInsert,
      { onConflict: "organization_id,user_id" },
    );
    if (memErr) throw new Error(memErr.message);

    await logChange(
      data.organizationId,
      actorUserId,
      "member_created",
      { userId: newUserId, name: `${data.firstName} ${data.lastName}`.trim() },
      { access_level: data.accessLevel, access_preset_id: presetId, created_via: createdVia },
    );

    try {
      await onStaffHiredInternal(supabaseAdmin, data.organizationId, newUserId);
    } catch (hireErr) {
      console.warn("[obligations] hire auto-assign failed:", hireErr);
    }

    return { userId: newUserId, email: effectiveEmail, created, tempPassword, presetId };
  } catch (e) {
    // Undo only the login this request just made; no existing person is touched.
    if (created) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Agency lookups shared by Add and Import                             */
/* ------------------------------------------------------------------ */

type HireContext = {
  presets: PresetPick[];
  positionKeys: Set<string>;
  homeIds: Set<string>;
  /** Active memberships here: id (organization_members.id) + user_id. */
  activeMembers: Array<{ id: string; user_id: string }>;
};

async function loadHireContext(organizationId: string): Promise<HireContext> {
  const [presets, staffTypes, teams, members] = await Promise.all([
    supabaseAdmin
      .from("access_presets")
      .select("id, name, access_level")
      .eq("organization_id", organizationId),
    supabaseAdmin.from("staff_types").select("key").eq("organization_id", organizationId),
    supabaseAdmin.from("teams").select("id").eq("organization_id", organizationId),
    supabaseAdmin
      .from("organization_members")
      .select("id, user_id")
      .eq("organization_id", organizationId)
      .eq("active", true),
  ]);
  for (const r of [presets, staffTypes, teams, members]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    presets: (presets.data ?? []) as PresetPick[],
    positionKeys: new Set((staffTypes.data ?? []).map((r) => r.key)),
    homeIds: new Set((teams.data ?? []).map((r) => r.id)),
    activeMembers: members.data ?? [],
  };
}

/**
 * Throws a user-facing message when a Home, Supervisor or Position isn't this
 * agency's. Returns the supervisor's membership id for manager_id.
 */
function assertRefsInAgency(ctx: HireContext, row: TeamMemberFieldsValue): string | null {
  if (row.homeId && !ctx.homeIds.has(row.homeId))
    throw new Error("That home isn't in this agency.");
  const supervisorMemberId = resolveSupervisorMemberId(row.supervisorId, ctx.activeMembers);
  const unknown = row.positions.filter((k) => !ctx.positionKeys.has(k));
  if (unknown.length) throw new Error(`Unknown position: ${unknown.join(", ")}.`);
  return supervisorMemberId;
}

type EmailLookup = { match: EmailMatch; userId: string | null; name: string | null };

/** Exact lower-case email match (never ilike), and that person's membership here. */
async function lookupEmails(
  organizationId: string,
  emails: string[],
): Promise<Map<string, EmailLookup>> {
  const wanted = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const out = new Map<string, EmailLookup>();
  for (const e of wanted) out.set(e, { match: "new", userId: null, name: null });
  if (!wanted.length) return out;
  const { data: profs, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, first_name, last_name")
    .in("email", wanted);
  if (error) throw new Error(error.message);
  const rows = profs ?? [];
  if (!rows.length) return out;
  // organization_members ↔ profiles share no FK — two queries, joined here.
  const { data: mems, error: memErr } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, active")
    .eq("organization_id", organizationId)
    .in(
      "user_id",
      rows.map((p) => p.id),
    );
  if (memErr) throw new Error(memErr.message);
  const activeByUser = new Map((mems ?? []).map((m) => [m.user_id, m.active === true]));
  for (const p of rows) {
    const email = normalizeEmail(String(p.email ?? ""));
    if (!out.has(email)) continue;
    const name =
      String(p.full_name ?? "").trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
      null;
    out.set(email, {
      match: classifyEmailMatch(p.id, activeByUser.has(p.id) ? activeByUser.get(p.id) : null),
      userId: p.id,
      name,
    });
  }
  return out;
}

async function actorIsOwner(actorId: string, organizationId: string): Promise<boolean> {
  try {
    await requireLevel(supabaseAdmin, actorId, organizationId, "owner");
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Add team member                                                     */
/* ------------------------------------------------------------------ */

const TeamMemberFields = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  hireDate: YMD,
  dateOfBirth: YMD.optional().or(z.literal("")),
  /** "owner", or one of this agency's access_presets ids. The level comes from the preset. */
  access: z.union([z.literal(OWNER_ACCESS), z.string().uuid()]),
  /** profiles.staff_type_keys — staff_types keys. */
  positions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  homeId: z.string().uuid().nullable().optional(),
  /** The supervisor's organization_members.id (manager_id references it). */
  supervisorId: z.string().uuid().nullable().optional(),
  /** Import's job title column. Add team member uses Position instead. */
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  workerType: z.enum(WORKER_TYPES).default("w2"),
  transportsClients: z.boolean().default(false),
});

type TeamMemberFieldsValue = z.infer<typeof TeamMemberFields>;

const CreateTeamMemberInput = TeamMemberFields.extend({
  organizationId: z.string().uuid(),
  sendInvite: z.boolean().default(true),
});

export type CreateTeamMemberResult =
  | {
      status: "created";
      userId: string;
      invited: boolean;
      /** Why the invite email didn't go out, when one was requested. */
      inviteError?: string | null;
      /** Only when no invite went out. Shown once. */
      tempPassword?: string;
    }
  | {
      status: "inactive_match";
      userId: string;
      name: string;
      /** From the last deactivation here; null when it was never recorded. */
      rehireEligible: boolean | null;
    };

function hireInputFromFields(
  organizationId: string,
  row: TeamMemberFieldsValue,
  access: ResolvedAccess,
  supervisorMemberId: string | null,
): HireTeamMemberInput {
  return {
    organizationId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone || null,
    accessLevel: access.level,
    accessPresetId: access.presetId,
    hireDate: row.hireDate,
    startDate: row.hireDate,
    dateOfBirth: row.dateOfBirth || null,
    staffType: row.positions,
    workerType: row.workerType,
    transportsClients: row.transportsClients,
    teamId: row.homeId ?? null,
    managerId: supervisorMemberId,
    jobTitle: row.jobTitle || null,
  };
}

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTeamMemberInput.parse(d))
  .handler(async ({ data, context }): Promise<CreateTeamMemberResult> => {
    if (!context.userId) throw new Error("Not signed in.");
    await requireCategory(
      supabaseAdmin,
      context.userId,
      data.organizationId,
      "staff_hiring",
      "edit",
    );
    const ctx = await loadHireContext(data.organizationId);
    const access = resolveAccessChoice(data.access, ctx.presets);
    if (!access) throw new Error("Choose an access preset from this agency.");
    if (accessNeedsOwner(access.level)) {
      await requireLevel(supabaseAdmin, context.userId, data.organizationId, "owner");
    }
    await assertAgencySetupCompleteForOrg(supabaseAdmin, data.organizationId);
    const supervisorMemberId = assertRefsInAgency(ctx, data);

    const email = normalizeEmail(data.email);
    const found = (await lookupEmails(data.organizationId, [email])).get(email);
    if (found?.match === "inactive_here" && found.userId) {
      const { data: prior } = await supabaseAdmin
        .from("organization_members")
        .select("rehire_eligible")
        .eq("organization_id", data.organizationId)
        .eq("user_id", found.userId)
        .maybeSingle();
      return {
        status: "inactive_match",
        userId: found.userId,
        name: found.name ?? email,
        rehireEligible: prior?.rehire_eligible ?? null,
      };
    }
    if (found?.match === "already_here") throw new Error(`${email} is already on the roster.`);
    if (found?.match === "other_agency") throw new Error(EMAIL_TAKEN_MESSAGE);

    const hired = await hireTeamMemberInternal(
      hireInputFromFields(data.organizationId, data, access, supervisorMemberId),
      context.userId,
      "manual_admin",
    );

    let invited = false;
    let inviteError: string | null = null;
    if (data.sendInvite) {
      const [outcome] = await sendTeamMemberInvitesInternal({
        organizationId: data.organizationId,
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        targets: [{ email: hired.email, level: access.level, presetId: hired.presetId }],
      }).catch((e: unknown) => [
        {
          email: hired.email,
          email_sent: false,
          error: e instanceof Error ? e.message : "Invite failed",
        },
      ]);
      invited = !!outcome?.email_sent;
      inviteError = outcome?.error ?? null;
    }

    return {
      status: "created",
      userId: hired.userId,
      invited,
      ...(data.sendInvite ? { inviteError } : {}),
      ...(!invited && hired.tempPassword ? { tempPassword: hired.tempPassword } : {}),
    };
  });

/* ------------------------------------------------------------------ */
/* Import team members                                                 */
/* ------------------------------------------------------------------ */

export type TeamImportPreviewRow = { email: string; match: EmailMatch; name: string | null };

/** What each email means here: new / already here / inactive here / other agency. */
export const previewTeamImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        emails: z.array(z.string().trim().max(255)).max(IMPORT_MAX_ROWS),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TeamImportPreviewRow[]> => {
    if (!context.userId) throw new Error("Not signed in.");
    await requireCategory(
      supabaseAdmin,
      context.userId,
      data.organizationId,
      "staff_hiring",
      "edit",
    );
    const found = await lookupEmails(data.organizationId, data.emails);
    return [...found.entries()].map(([email, f]) => ({ email, match: f.match, name: f.name }));
  });

export type TeamImportRowResult = {
  /** Index into the rows that were sent. */
  index: number;
  email: string;
  name: string;
  status: "created" | "skipped";
  userId: string | null;
  invited: boolean;
  reason: string | null;
};

export const importTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        rows: z.array(TeamMemberFields).min(1).max(IMPORT_MAX_ROWS),
        sendInvites: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TeamImportRowResult[]> => {
    if (!context.userId) throw new Error("Not signed in.");
    const actorId = context.userId;
    await requireCategory(supabaseAdmin, actorId, data.organizationId, "staff_hiring", "edit");
    await assertAgencySetupCompleteForOrg(supabaseAdmin, data.organizationId);
    const ctx = await loadHireContext(data.organizationId);
    const isOwner = await actorIsOwner(actorId, data.organizationId);
    const found = await lookupEmails(
      data.organizationId,
      data.rows.map((r) => r.email),
    );

    const results: TeamImportRowResult[] = [];
    const seen = new Set<string>();
    const toInvite: Array<{
      index: number;
      email: string;
      level: AccessLevel;
      presetId: string | null;
    }> = [];

    for (const [index, row] of data.rows.entries()) {
      const email = normalizeEmail(row.email);
      const name = `${row.firstName} ${row.lastName}`.trim();
      const skip = (reason: string, userId: string | null = null) =>
        results.push({ index, email, name, status: "skipped", userId, invited: false, reason });

      if (seen.has(email)) {
        skip("This email is listed more than once.");
        continue;
      }
      seen.add(email);
      const match = found.get(email);
      if (match?.match === "already_here") {
        skip("Already on the roster.", match.userId);
        continue;
      }
      if (match?.match === "inactive_here") {
        skip("Used to work here — reactivate them from the Inactive list.", match.userId);
        continue;
      }
      if (match?.match === "other_agency") {
        skip(EMAIL_TAKEN_MESSAGE);
        continue;
      }
      const access = resolveAccessChoice(row.access, ctx.presets);
      if (!access) {
        skip("Choose an access preset from this agency.");
        continue;
      }
      if (accessNeedsOwner(access.level) && !isOwner) {
        skip("Only an Owner can give Owner or Admin access.");
        continue;
      }
      try {
        const supervisorMemberId = assertRefsInAgency(ctx, row);
        const hired = await hireTeamMemberInternal(
          hireInputFromFields(data.organizationId, row, access, supervisorMemberId),
          actorId,
          "manual_admin",
        );
        results.push({
          index,
          email: hired.email,
          name,
          status: "created",
          userId: hired.userId,
          invited: false,
          reason: null,
        });
        if (data.sendInvites) {
          toInvite.push({
            index,
            email: hired.email,
            level: access.level,
            presetId: hired.presetId,
          });
        }
      } catch (e) {
        skip(e instanceof Error ? e.message : "Could not add.");
      }
    }

    if (toInvite.length) {
      const outcomes = await sendTeamMemberInvitesInternal({
        organizationId: data.organizationId,
        actorId,
        actorEmail: context.claims?.email ?? null,
        targets: toInvite.map(({ email, level, presetId }) => ({ email, level, presetId })),
      }).catch((e: unknown) =>
        toInvite.map((t) => ({
          email: t.email,
          email_sent: false,
          error: e instanceof Error ? e.message : "Invite failed",
        })),
      );
      const sentTo = new Set(outcomes.filter((o) => o.email_sent).map((o) => o.email));
      const errorBy = new Map(outcomes.map((o) => [o.email, o.error]));
      for (const r of results) {
        if (r.status !== "created") continue;
        r.invited = sentTo.has(r.email);
        if (!r.invited && errorBy.get(r.email))
          r.reason = `Invite not sent: ${errorBy.get(r.email)}`;
      }
    }

    return results.sort((a, b) => a.index - b.index);
  });

/* ------------------------------------------------------------------ */
/* Dropdowns and Evidence facts                                        */
/* ------------------------------------------------------------------ */

export type TeamMemberFormOptions = {
  homes: Array<{ id: string; name: string }>;
  /** memberId = organization_members.id, what supervisorId / manager_id take. */
  supervisors: Array<{ memberId: string; name: string }>;
  positions: Array<{ key: string; label: string }>;
};

/** Home (teams), Supervisor (active team members) and Position (staff_types) lists. */
export const listTeamMemberFormOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TeamMemberFormOptions> => {
    if (!context.userId) throw new Error("Not signed in.");
    await requireCategory(
      supabaseAdmin,
      context.userId,
      data.organizationId,
      "staff_hiring",
      "edit",
    );
    const [teams, staffTypes, members] = await Promise.all([
      supabaseAdmin
        .from("teams")
        .select("id, team_name, active")
        .eq("organization_id", data.organizationId),
      supabaseAdmin
        .from("staff_types")
        .select("key, label")
        .eq("organization_id", data.organizationId),
      supabaseAdmin
        .from("organization_members")
        .select("id, user_id")
        .eq("organization_id", data.organizationId)
        .eq("active", true),
    ]);
    for (const r of [teams, staffTypes, members]) {
      if (r.error) throw new Error(r.error.message);
    }
    const ids = (members.data ?? []).map((m) => m.user_id);
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: profs, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, first_name, last_name, email")
        .in("id", ids);
      if (error) throw new Error(error.message);
      names = new Map(
        (profs ?? []).map((p) => [
          p.id,
          String(p.full_name ?? "").trim() ||
            [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
            String(p.email ?? ""),
        ]),
      );
    }
    return {
      homes: (teams.data ?? [])
        .filter((t) => t.active !== false)
        .map((t) => ({ id: t.id, name: String(t.team_name ?? "").trim() || "Unnamed home" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      supervisors: (members.data ?? [])
        .map((m) => ({ memberId: m.id, name: names.get(m.user_id) || "Team member" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      positions: (staffTypes.data ?? [])
        .map((s) => ({ key: s.key, label: String(s.label ?? "").trim() || s.key }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  });

export type TeamMemberEvidenceFacts = {
  people: Array<EvidencePersonFacts & { name: string; hireDate: string | null }>;
  caseload: Record<string, CaseloadFacts>;
};

/** What "Review evidence pack" pre-fills from. Reads only; creates nothing. */
export const loadTeamMemberEvidenceFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        userIds: z.array(z.string().uuid()).min(1).max(IMPORT_MAX_ROWS),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TeamMemberEvidenceFacts> => {
    if (!context.userId) throw new Error("Not signed in.");
    await requireCategory(
      supabaseAdmin,
      context.userId,
      data.organizationId,
      "staff_hiring",
      "edit",
    );
    const { data: mems, error: memErr } = await supabaseAdmin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.organizationId)
      .in("user_id", data.userIds);
    if (memErr) throw new Error(memErr.message);
    const ids = (mems ?? []).map((m) => m.user_id);
    if (!ids.length) return { people: [], caseload: {} };

    const [profs, staffTypes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, first_name, last_name, hire_date, transports_clients, staff_type_keys",
        )
        .in("id", ids),
      supabaseAdmin
        .from("staff_types")
        .select("key, label")
        .eq("organization_id", data.organizationId),
    ]);
    if (profs.error) throw new Error(profs.error.message);
    const labelByKey = new Map(
      (staffTypes.data ?? []).map((s) => [s.key, String(s.label ?? "").trim() || s.key]),
    );
    const duty = await loadStaffDutyFactsInternal(supabaseAdmin, data.organizationId, ids);

    const caseload: Record<string, CaseloadFacts> = {};
    for (const [userId, f] of duty) {
      caseload[userId] = {
        clientIds: f.assignedClientIds,
        serviceCodes: f.assignedServiceCodes,
        hasAbiClient: f.hasAbiCaseload,
        hasBehaviorSupportClient: f.hasBehaviorCaseload,
      };
    }
    return {
      people: (profs.data ?? []).map((p) => ({
        userId: p.id,
        name:
          String(p.full_name ?? "").trim() ||
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
          "Team member",
        hireDate: p.hire_date ?? null,
        transportsClients: p.transports_clients === true,
        positions: (p.staff_type_keys ?? []).map((key) => ({
          key,
          label: labelByKey.get(key) ?? key,
        })),
      })),
      caseload,
    };
  });

/* ------------------------------------------------------------------ */
/* Edit profile                                                        */
/* ------------------------------------------------------------------ */

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

const UpdateTeamMemberInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  // Omitted = unchanged; null = clear. Built by buildTeamMemberPatch (profile.ts).
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  phone: nullableText(30),
  homeAddress: nullableText(300),
  emergencyContactName: nullableText(120),
  emergencyContactRelationship: nullableText(60),
  emergencyContactPhone: nullableText(30),
  dateOfBirth: YMD.nullable().optional(),
  jobTitle: nullableText(120),
  homeId: z.string().uuid().nullable().optional(),
  /** organization_members.id of the supervisor (manager_id references organization_members). */
  supervisorMemberId: z.string().uuid().nullable().optional(),
  hireDate: YMD.nullable().optional(),
  workerType: z.enum(WORKER_TYPES).optional(),
  transportsClients: z.boolean().optional(),
  staffTypeKeys: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  employeeId: nullableText(60),
  hourlyRate: z.number().min(0).max(100000).nullable().optional(),
  dailyRate: z.number().min(0).max(100000).nullable().optional(),
  /** staff-photos path; must sit under {org}/{user}/. */
  photoPath: z.string().max(500).nullable().optional(),
});

export type UpdateTeamMemberInputValue = z.input<typeof UpdateTeamMemberInput>;

/**
 * The one write path for the profile's Contact and Employment cards. Checks
 * edit_profile on the target, payroll Edit for pay, Hire & deactivate Edit for
 * date of birth; confirms every reference is this agency's; throws when a write
 * touched no row.
 */
export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateTeamMemberInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!context.userId) throw new Error("Not signed in.");
    const actorId = context.userId;
    const orgId = data.organizationId;
    await assertCanManageMember({
      supabase: supabaseAdmin,
      actorId,
      organizationId: orgId,
      targetUserId: data.userId,
      action: "edit_profile",
    });
    if (data.hourlyRate !== undefined || data.dailyRate !== undefined) {
      await requireCategory(supabaseAdmin, actorId, orgId, "payroll", "edit");
    }
    if (data.dateOfBirth !== undefined) {
      await requireCategory(supabaseAdmin, actorId, orgId, "staff_hiring", "edit");
    }

    const { data: member, error: memErr } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!member) throw new Error("Team member not found in this organization");

    if (data.homeId) {
      const { data: team, error } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", data.homeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!team) throw new Error("That home isn't in this agency.");
    }
    if (data.supervisorMemberId) {
      if (data.supervisorMemberId === member.id) {
        throw new Error("A team member can't be their own supervisor.");
      }
      const { data: sup, error } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", data.supervisorMemberId)
        .eq("active", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!sup) throw new Error("The supervisor must be an active team member here.");
    }
    if (data.staffTypeKeys?.length) {
      const { data: types, error } = await supabaseAdmin
        .from("staff_types")
        .select("key")
        .eq("organization_id", orgId);
      if (error) throw new Error(error.message);
      const known = new Set((types ?? []).map((t) => t.key));
      const unknown = data.staffTypeKeys.filter((k) => !known.has(k));
      if (unknown.length) throw new Error(`Unknown staff type: ${unknown.join(", ")}.`);
    }
    if (data.photoPath && !data.photoPath.startsWith(`${orgId}/${data.userId}/`)) {
      throw new Error("That photo doesn't belong to this team member.");
    }

    const { data: before, error: beforeErr } = await supabaseAdmin
      .from("profiles")
      .select("email, username, first_name, last_name, full_name, hire_date, transports_clients")
      .eq("id", data.userId)
      .maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message);
    if (!before) throw new Error("Team member not found in this organization");

    const profilePatch: Record<string, unknown> = {};
    const set = (col: string, v: unknown) => {
      if (v !== undefined) profilePatch[col] = v;
    };
    set("first_name", data.firstName);
    set("last_name", data.lastName);
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const first = data.firstName ?? before.first_name ?? "";
      const last = data.lastName ?? before.last_name ?? "";
      profilePatch.full_name = `${first} ${last}`.trim() || null;
    }
    set("phone", data.phone);
    set("home_address", data.homeAddress);
    set("emergency_contact_name", data.emergencyContactName);
    set("emergency_contact_relationship", data.emergencyContactRelationship);
    set("emergency_contact_phone", data.emergencyContactPhone);
    set("date_of_birth", data.dateOfBirth);
    set("team_id", data.homeId);
    if (data.hireDate !== undefined) {
      profilePatch.hire_date = data.hireDate;
      profilePatch.start_date = data.hireDate;
    }
    set("worker_type", data.workerType);
    set("transports_clients", data.transportsClients);
    set("staff_type_keys", data.staffTypeKeys);
    set("employee_id", data.employeeId);
    set("hourly_rate", data.hourlyRate);
    set("daily_rate", data.dailyRate);
    if (data.photoPath !== undefined) {
      profilePatch.photo_path = data.photoPath;
      profilePatch.photo_updated_at = data.photoPath ? new Date().toISOString() : null;
    }

    const oldEmail = normalizeEmail(String(before.email ?? ""));
    const emailChanged = data.email !== undefined && data.email !== oldEmail;
    if (emailChanged) {
      const newEmail = data.email!;
      const { data: taken, error: takenErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", newEmail)
        .neq("id", data.userId)
        .limit(1);
      if (takenErr) throw new Error(takenErr.message);
      if (taken?.length) throw new Error(EMAIL_TAKEN_MESSAGE);
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: newEmail,
        email_confirm: true,
      });
      if (authErr) throw new Error(authErr.message);
      profilePatch.email = newEmail;
      profilePatch.username = resolveAccountUsername({
        username: usernameAfterEmailChange({
          currentUsername: before.username ?? null,
          oldEmail,
          newEmail,
        }),
        email: newEmail,
      });
    }

    if (Object.keys(profilePatch).length) {
      const { data: rows, error } = await supabaseAdmin
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(profilePatch as any)
        .eq("id", data.userId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows?.length) throw new Error("Nothing was saved. Try again.");
    }

    const memberPatch: Database["public"]["Tables"]["organization_members"]["Update"] = {};
    if (data.jobTitle !== undefined) memberPatch.job_title = data.jobTitle;
    if (data.supervisorMemberId !== undefined) memberPatch.manager_id = data.supervisorMemberId;
    if (Object.keys(memberPatch).length) {
      const { data: rows, error } = await supabaseAdmin
        .from("organization_members")
        .update(memberPatch)
        .eq("id", member.id)
        .eq("organization_id", orgId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows?.length) throw new Error("Nothing was saved. Try again.");
    }

    const hireChanged = data.hireDate !== undefined && data.hireDate !== (before.hire_date ?? null);
    const transportChanged =
      data.transportsClients !== undefined &&
      data.transportsClients !== (before.transports_clients === true);
    const supervisorChanged = data.supervisorMemberId !== undefined;
    if (hireChanged || transportChanged || supervisorChanged) {
      // Keeps the older duty system consistent until the compliance rebuild.
      try {
        await reevaluateStaffDutiesInternal(supabaseAdmin, orgId, data.userId);
      } catch (e) {
        console.warn("[obligations] duty re-evaluation after profile edit failed:", e);
      }
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Reset password                                                      */
/* ------------------------------------------------------------------ */

const ResetInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type ResetMemberPasswordResult = {
  /** Username when set, else email — what the person types to sign in. */
  login: string;
  /** 14 characters, generated here. Shown once; never stored in plain text. */
  password: string;
};

/**
 * Sets a new server-generated temporary password and forces a change at next
 * sign-in. The browser never picks the password.
 */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetInput.parse(d))
  .handler(async ({ data, context }): Promise<ResetMemberPasswordResult> => {
    if (!context.userId) throw new Error("Not signed in.");
    // Hire & deactivate = Edit, in-scope target, not an Owner unless the actor
    // is one, never your own account — and the same-org target check.
    await assertCanManageMember({
      supabase: supabaseAdmin,
      actorId: context.userId,
      organizationId: data.organizationId,
      targetUserId: data.userId,
      action: "reset_password",
    });

    const password = generateTempPassword(14);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);

    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId)
      .select("username, email, full_name")
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);

    await logChange(
      data.organizationId,
      context.userId,
      "password_reset",
      { userId: data.userId, name: prof?.full_name ?? null },
      { must_change_password: true },
    );

    return { login: prof?.username?.trim() || prof?.email?.trim() || "", password };
  });

/* ------------------------------------------------------------------ */
/* Bulk hire-date maintenance                                          */
/* ------------------------------------------------------------------ */

const BulkHireDateInput = z.object({
  organizationId: z.string().uuid(),
  updates: z
    .array(
      z.object({
        userId: z.string().uuid(),
        hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1)
    .max(500),
});

export const bulkSetStaffHireDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkHireDateInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.userId) return { updated: 0 };
    await requireCategory(
      supabaseAdmin,
      context.userId,
      data.organizationId,
      "staff_hiring",
      "edit",
    );

    const { data: members, error } = await supabaseAdmin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.organizationId)
      .eq("active", true)
      .in(
        "user_id",
        data.updates.map((u) => u.userId),
      );
    if (error) throw new Error(error.message);
    const allowed = new Set((members ?? []).map((m) => m.user_id));

    let updated = 0;
    for (const u of data.updates) {
      if (!allowed.has(u.userId)) continue;
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ hire_date: u.hireDate, start_date: u.hireDate } as any)
        .eq("id", u.userId);
      if (upErr) throw new Error(upErr.message);
      try {
        await onStaffHiredInternal(supabaseAdmin, data.organizationId, u.userId);
      } catch (hireErr) {
        console.warn("[obligations] hire-date auto-assign failed:", hireErr);
      }
      updated += 1;
    }
    return { updated };
  });
