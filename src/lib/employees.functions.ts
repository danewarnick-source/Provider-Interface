import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { onStaffHiredInternal } from "@/lib/staff-assignment-hooks.functions";
import { resolveAccountUsername } from "@/lib/account-username";
import { assertAgencySetupCompleteForOrg } from "@/lib/agency-setup-gate.functions";
import { generateTempPassword } from "@/lib/temp-password";
import { requireCategory, requireLevel } from "@/lib/access/require";
import type { AccessLevel } from "@/lib/access/levels";
import { resolvePresetId } from "@/lib/access/preset-resolve";
import { logChange } from "@/lib/access/change-log.server";

type MemberInsert = Database["public"]["Tables"]["organization_members"]["Insert"];

const LevelEnum = z.enum(["owner", "admin", "staff"]);

export const CreateEmployeeInput = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  temporaryPassword: z.string().min(8).max(128),
  accessLevel: LevelEnum,
  /** Null for Owner. Blank for Admin / Team member uses that level's default preset. */
  accessPresetId: z.string().uuid().nullable().optional(),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  hireDate: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  requiresDeescalation: z.boolean().default(true),
  requiresAbi: z.boolean().default(true),
  staffType: z.array(z.string()).optional().default([]),
  employeeId: z.string().trim().max(80).optional().or(z.literal("")),
  workerType: z.string().trim().max(80).optional().or(z.literal("")),
  customFieldValues: z.record(z.string(), z.unknown()).optional().default({}),
  username: z.string().trim().max(254).optional().or(z.literal("")),
  managerId: z.string().uuid().nullable().optional(),
});

export type HireEmployeeInput = z.infer<typeof CreateEmployeeInput>;

export type HireEmployeeOptions = {
  /** Bulk add: person is on the roster but job questions are not answered yet. */
  needsSetup?: boolean;
  /** Skip Evidence-pack assignment until Finish setup, when job answers exist. */
  deferHirePack?: boolean;
  /** Spreadsheet job title. Omit to keep the Add employee department → job title path. */
  jobTitle?: string | null;
};

async function customAttributesFromIntake(
  organizationId: string,
  customFieldValues: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const customFieldEntries = Object.entries(customFieldValues ?? {}).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  const customAttributes: Record<string, unknown> = {};
  if (!customFieldEntries.length) return customAttributes;
  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("feature_config")
    .eq("id", organizationId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customFieldDefs = ((orgRow as any)?.feature_config?.staff_intake_fields?.custom_fields ??
    []) as Array<{ id: string; name: string }>;
  const nameById = new Map(customFieldDefs.map((f) => [f.id, f.name]));
  for (const [fieldId, value] of customFieldEntries) {
    const name = nameById.get(fieldId);
    if (name && name !== "needs_setup") customAttributes[name] = value;
  }
  return customAttributes;
}

async function assertOrgManager(actorId: string, orgId: string) {
  await requireCategory(supabaseAdmin, actorId, orgId, "staff_hiring", "edit");
}

/** Hiring or re-leveling someone above Team member takes an Owner. */
async function assertCanGrantLevel(actorId: string, orgId: string, level: AccessLevel) {
  if (level !== "staff") await requireLevel(supabaseAdmin, actorId, orgId, "owner");
}

/** Shared hire path for Add employee and roster upload. Never sends email. */
export async function hireEmployeeInternal(
  data: HireEmployeeInput,
  actorUserId: string,
  createdVia: "manual_admin" | "smart_import" = "manual_admin",
  options: HireEmployeeOptions = {},
): Promise<{ userId: string; email: string; created: boolean }> {
  await assertAgencySetupCompleteForOrg(supabaseAdmin, data.organizationId);

  const effectiveEmail = data.email.trim().toLowerCase();
  const startDate = data.startDate || data.hireDate || null;
  const endDate = data.endDate || null;
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be on or after Start date.");
  }

  const { data: existingProf } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", effectiveEmail)
    .maybeSingle();

  if (existingProf?.id && createdVia === "manual_admin") {
    throw new Error("An account with this email already exists.");
  }

  let newUserId = existingProf?.id ?? "";
  let created = false;

  if (!newUserId) {
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: effectiveEmail,
      password: data.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: `${data.firstName} ${data.lastName}`.trim(),
        created_via: createdVia,
      },
    });
    if (createErr || !createdUser.user) {
      const msg = createErr?.message || "Failed to create user";
      if (/already/i.test(msg)) {
        const { data: again } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", effectiveEmail)
          .maybeSingle();
        if (again?.id) {
          newUserId = again.id;
        } else {
          throw new Error(msg);
        }
      } else {
        throw new Error(msg);
      }
    } else {
      newUserId = createdUser.user.id;
      created = true;
    }
  }

  try {
    const customAttributes = await customAttributesFromIntake(
      data.organizationId,
      data.customFieldValues,
    );
    if (options.needsSetup) customAttributes.needs_setup = true;

    const profileRow: Record<string, unknown> = {
      id: newUserId,
      email: effectiveEmail,
      full_name: `${data.firstName} ${data.lastName}`.trim(),
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone?.trim() || null,
      department: data.department || null,
      employee_id: data.employeeId || null,
      staff_type_keys: data.staffType,
      hire_date: startDate,
      start_date: startDate,
      end_date: endDate,
      is_active: true,
      requires_deescalation: data.requiresDeescalation,
      requires_abi: data.requiresAbi,
    };
    if (data.workerType) profileRow.worker_type = data.workerType;
    if (created) {
      profileRow.must_change_password = true;
      profileRow.username = resolveAccountUsername({
        username: data.username,
        email: effectiveEmail,
      });
    } else if (data.username?.trim()) {
      profileRow.username = resolveAccountUsername({
        username: data.username,
        email: effectiveEmail,
      });
    }
    if (Object.keys(customAttributes).length) profileRow.custom_attributes = customAttributes;

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(profileRow as any, { onConflict: "id" });

    if (profErr) throw new Error(profErr.message);

    await supabaseAdmin
      .from("organization_members")
      .update({ active: false })
      .eq("user_id", newUserId)
      .neq("organization_id", data.organizationId);

    const jobTitle =
      options.jobTitle !== undefined ? options.jobTitle?.trim() || null : data.department || null;
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

    if (!options.deferHirePack) {
      try {
        await onStaffHiredInternal(supabaseAdmin, data.organizationId, newUserId);
      } catch (hireErr) {
        console.warn("[obligations] hire auto-assign failed:", hireErr);
      }
    }

    return { userId: newUserId, email: effectiveEmail, created };
  } catch (e) {
    if (created) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
    }
    throw e;
  }
}

export const createEmployeeManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateEmployeeInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.userId) return { userId: "", email: "" };
    await assertOrgManager(context.userId, data.organizationId);
    await assertCanGrantLevel(context.userId, data.organizationId, data.accessLevel);
    const hired = await hireEmployeeInternal(data, context.userId, "manual_admin");
    return { userId: hired.userId, email: hired.email };
  });

const RosterApplyInput = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(1).max(30),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  accessLevel: z.enum(["admin", "staff"]).default("staff"),
  presetName: z.string().trim().max(80).optional().or(z.literal("")),
});

export type RosterApplyResult = {
  userId: string;
  email: string;
  action: "created" | "skipped";
  reason: string | null;
};

/** Add basics only. Existing emails are skipped. Never updates, never emails. */
export const applyEmployeeRosterRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RosterApplyInput.parse(d))
  .handler(async ({ data, context }): Promise<RosterApplyResult> => {
    const email = data.email.trim().toLowerCase();
    const empty: RosterApplyResult = {
      userId: "",
      email,
      action: "skipped",
      reason: "Not signed in.",
    };
    if (!context.userId) return empty;
    await assertOrgManager(context.userId, data.organizationId);
    await assertCanGrantLevel(context.userId, data.organizationId, data.accessLevel);
    const presetId = await resolvePresetId(data.organizationId, data.accessLevel, {
      name: data.presetName,
    });

    const { data: existingProf } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingProf?.id) {
      const { data: mem } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("user_id", existingProf.id)
        .eq("organization_id", data.organizationId)
        .maybeSingle();
      return {
        userId: existingProf.id,
        email,
        action: "skipped",
        reason: mem ? "Already on the roster." : "An account with this email already exists.",
      };
    }

    try {
      const hired = await hireEmployeeInternal(
        {
          organizationId: data.organizationId,
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          phone: data.phone,
          temporaryPassword: generateTempPassword(),
          accessLevel: data.accessLevel,
          accessPresetId: presetId,
          department: "",
          hireDate: data.hireDate,
          startDate: data.hireDate,
          requiresDeescalation: false,
          requiresAbi: false,
          staffType: [],
          customFieldValues: {},
        },
        context.userId,
        "manual_admin",
        {
          needsSetup: true,
          deferHirePack: true,
          jobTitle: data.jobTitle ?? "",
        },
      );
      return {
        userId: hired.userId,
        email: hired.email,
        action: "created",
        reason: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/already exists/i.test(msg)) {
        return { userId: "", email, action: "skipped", reason: "Already on the roster." };
      }
      throw e;
    }
  });

const FinishSetupInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(1).max(30),
  accessLevel: LevelEnum,
  accessPresetId: z.string().uuid().nullable().optional(),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  staffType: z.array(z.string()).optional().default([]),
  employeeId: z.string().trim().max(80).optional().or(z.literal("")),
  workerType: z.string().trim().max(80).optional().or(z.literal("")),
  customFieldValues: z.record(z.string(), z.unknown()).optional().default({}),
});

export type FinishEmployeeSetupResult = {
  userId: string;
  email: string;
  name: string;
};

/**
 * Same profile writes as Add employee, for someone already created as Needs setup.
 * Clears the flag and runs the hire pack once job answers exist. Never sends email.
 */
export const finishEmployeeSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FinishSetupInput.parse(d))
  .handler(async ({ data, context }): Promise<FinishEmployeeSetupResult> => {
    if (!context.userId) throw new Error("Not signed in.");
    await assertOrgManager(context.userId, data.organizationId);
    await assertCanGrantLevel(context.userId, data.organizationId, data.accessLevel);
    await assertAgencySetupCompleteForOrg(supabaseAdmin, data.organizationId);

    const { data: mem, error: memLookupErr } = await supabaseAdmin
      .from("organization_members")
      .select("id, access_level, access_preset_id")
      .eq("user_id", data.userId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (memLookupErr) throw new Error(memLookupErr.message);
    if (!mem) throw new Error("Team member not found in this organization");

    const email = data.email.trim().toLowerCase();
    const { data: emailOwner } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (emailOwner?.id && emailOwner.id !== data.userId) {
      throw new Error("An account with this email already exists.");
    }

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    if ((current?.email ?? "").trim().toLowerCase() !== email) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email,
        email_confirm: true,
      });
      if (authErr) throw new Error(authErr.message);
    }

    const customAttributes = await customAttributesFromIntake(
      data.organizationId,
      data.customFieldValues,
    );
    const startDate = data.hireDate;
    const profilePatch: Record<string, unknown> = {
      email,
      full_name: `${data.firstName} ${data.lastName}`.trim(),
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone.trim(),
      department: data.department || null,
      employee_id: data.employeeId || null,
      staff_type_keys: data.staffType,
      hire_date: startDate,
      start_date: startDate,
      requires_deescalation: false,
      requires_abi: false,
      custom_attributes: customAttributes,
    };
    if (data.workerType) profilePatch.worker_type = data.workerType;

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(profilePatch as any)
      .eq("id", data.userId);
    if (profErr) throw new Error(profErr.message);

    const presetId =
      data.accessLevel === "owner"
        ? null
        : await resolvePresetId(data.organizationId, data.accessLevel, {
            id: data.accessPresetId,
          });
    const { error: memErr } = await supabaseAdmin
      .from("organization_members")
      .update({
        access_level: data.accessLevel,
        access_preset_id: presetId,
        job_title: data.jobTitle?.trim() || null,
        active: true,
      })
      .eq("organization_id", data.organizationId)
      .eq("user_id", data.userId);
    if (memErr) throw new Error(memErr.message);

    if (mem.access_level !== data.accessLevel || mem.access_preset_id !== presetId) {
      await logChange(
        data.organizationId,
        context.userId,
        "member_access",
        { userId: data.userId, name: `${data.firstName} ${data.lastName}`.trim() },
        {
          before: { access_level: mem.access_level, access_preset_id: mem.access_preset_id },
          after: { access_level: data.accessLevel, access_preset_id: presetId },
          change_method: "finishEmployeeSetup",
        },
      );
    }

    try {
      await onStaffHiredInternal(supabaseAdmin, data.organizationId, data.userId);
    } catch (hireErr) {
      console.warn("[obligations] finish-setup auto-assign failed:", hireErr);
    }

    return {
      userId: data.userId,
      email,
      name: `${data.firstName} ${data.lastName}`.trim(),
    };
  });

const ResetInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  newPassword: z.string().min(8).max(128),
});

export const adminResetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.userId) return { ok: false };
    await assertOrgManager(context.userId, data.organizationId);

    // Confirm target user belongs to that org
    const { data: mem } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("user_id", data.userId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!mem) throw new Error("Team member not found in this organization");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);

    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Bulk hire-date maintenance                                          */
/* ------------------------------------------------------------------ */

const OrgInput = z.object({ organizationId: z.string().uuid() });

export interface StaffHireDateRow {
  userId: string;
  name: string;
  email: string | null;
  accessLevel: AccessLevel;
  department: string | null;
  hireDate: string | null;
}

export const listStaffHireDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }): Promise<StaffHireDateRow[]> => {
    if (!context.userId) return [];
    await assertOrgManager(context.userId, data.organizationId);

    const { data: members, error } = await supabaseAdmin
      .from("organization_members")
      .select("user_id, access_level, job_title")
      .eq("organization_id", data.organizationId)
      .eq("active", true);
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id);
    if (!ids.length) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, email, department, hire_date, start_date, is_active",
      )
      .in("id", ids);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map((profiles ?? []).map((p) => [p.id, p as any]));

    return (members ?? [])
      .map((m) => {
        const p = byId.get(m.user_id);
        if (p && p.is_active === false) return null;
        const name =
          (p?.full_name as string | null) ||
          [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
          (p?.email as string | null) ||
          "Unknown";
        return {
          userId: m.user_id,
          name,
          email: (p?.email as string | null) ?? null,
          accessLevel: (m.access_level ?? "staff") as AccessLevel,
          department: (p?.department as string | null) ?? (m.job_title as string | null) ?? null,
          hireDate: ((p?.start_date ?? p?.hire_date) as string | null) ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as StaffHireDateRow[];
  });

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
    await assertOrgManager(context.userId, data.organizationId);

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
