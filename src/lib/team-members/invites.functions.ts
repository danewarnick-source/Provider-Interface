// Shared team-member invitation rail. Every invite surface (the Add team
// member dialog and the Invited view on the Team Members roster) calls these
// server fns instead
// of inserting into `invitations` directly, so invite creation, resend, and
// the actual email send live in exactly one place.
//
// Email goes out through the same Resend rail as everything else
// (resolveOrgSender + the `send-email` edge function) — see
// src/lib/email.functions.ts. We call that rail's building blocks directly
// rather than invoking the `sendEmail` server fn from inside another server
// fn's handler, since createServerFn calls aren't meant to be nested.

import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory, requireLevel, requirePermission } from "@/lib/access/require";
import { resolveOrgSender } from "@/lib/email.functions";
import { type AccessLevel } from "@/lib/access/levels";
import { resolvePresetId } from "@/lib/access/preset-resolve";
import { buildInvitationEmail } from "@/lib/invitation-email";
import { inviteJoinUrl } from "@/lib/join-invite";
import { pickReplyTo, stripFakeDisplayLabel } from "@/lib/managed-from";
import { canSendImportInvite } from "@/lib/import-invite";
import { assertAgencySetupCompleteForOrg } from "@/lib/agency-setup-gate.functions";
import {
  findMemberAccessByEmail,
  resolveResendAccess,
  type InviteAccessValues,
  type MemberAccessPick,
  type ProfileEmailPick,
} from "@/lib/invitation-resend-access";
import {
  asRosterLevel,
  buildTeamInviteRows,
  isEmployeeOnActiveRoster,
  lastLoginByUserId,
  type InviteSourceInvitation,
  type TeamInviteRow,
} from "@/lib/team-members/roster";
import { displayNameOf, loadVisibleMembers, selectIn } from "@/lib/team-members/roster.functions";

const ORG_ID = z.string().uuid();
const INVITE_LEVEL = z.enum(["owner", "admin", "staff"]);

type InvitationRow = {
  id: string;
  token: string;
  email: string;
  access_level: AccessLevel;
  access_preset_id: string | null;
  expires_at: string;
};

const INVITE_SELECT = "id, token, email, access_level, access_preset_id, expires_at";

/** Per inviter. Reuses nectar_check_rate (service role). 0 daily cap = requests only. */
const INVITE_MAX_PER_MIN = 20;

// Server-only so sendTeamMemberInvitesInternal (a plain export that stays in
// the client module graph) doesn't pull @tanstack/react-start/server into it.
const setTooManyRequests = createServerOnlyFn(async () => {
  const { setResponseStatus } = await import("@tanstack/react-start/server");
  setResponseStatus(429);
});

async function assertInviteRate(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).rpc("nectar_check_rate", {
    p_key: `invite:${userId}`,
    p_max_per_min: INVITE_MAX_PER_MIN,
    p_daily_token_cap: 0,
  });
  if (error) {
    console.error("[invite-rate] nectar_check_rate failed:", error.message);
    throw new Error("Invites are temporarily unavailable. Try again in a moment.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  const waitMs = Number(row?.wait_ms ?? 0);
  if (waitMs > 0 || row?.day_full) {
    try {
      await setTooManyRequests();
    } catch {
      /* The thrown error still stops the invite when no response object is bound. */
    }
    throw new Error("Too many invites. Try again in a minute.");
  }
}

type InviteTargetResult = {
  email: string;
  user_id: string | null;
  status: "sent" | "created_unsent" | "skipped" | "error";
  reason: string | null;
};

/** Unified payload so hire-wizard (`res.sent`) and resend (`res.email_sent`) share one shape. */
function inviteSendPayload(args: {
  invitation?: InvitationRow | { id: string; email: string } | null;
  email?: string | null;
  userId?: string | null;
  email_sent: boolean;
  email_error?: string | null;
  sent?: number;
  skipped?: number;
  errors?: number;
  results?: InviteTargetResult[];
  status?: InviteTargetResult["status"];
}) {
  const email =
    (args.email && args.email.trim()) ||
    (args.invitation && "email" in args.invitation ? String(args.invitation.email ?? "") : "");
  const status =
    args.status ?? (args.email_sent ? "sent" : args.email_error ? "created_unsent" : "error");
  const results =
    args.results ??
    (email || args.email_error
      ? [
          {
            email,
            user_id: args.userId ?? null,
            status,
            reason: args.email_sent ? null : (args.email_error ?? null),
          },
        ]
      : []);
  return {
    invitation: args.invitation ?? null,
    email_sent: args.email_sent,
    email_error: args.email_error ?? null,
    sent: args.sent ?? (args.email_sent ? 1 : 0),
    skipped: args.skipped ?? 0,
    errors: args.errors ?? (args.email_sent ? 0 : results.length ? 1 : 0),
    results,
  };
}

/**
 * invite_staff lets someone invite a team member; inviting an Owner or Admin takes an Owner.
 * A chosen preset must belong to the org and match the level. No preset → the
 * level's default (Admin → Program Manager, Team member → DSP).
 */
async function presetIdForInvite(
  organizationId: string,
  level: AccessLevel,
  presetId: string | null | undefined,
): Promise<string | null> {
  if (level === "owner") return null;
  return resolvePresetId(organizationId, level, { id: presetId });
}

async function assertCanInviteAt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  organizationId: string,
  level: AccessLevel,
  presetId: string | null | undefined,
): Promise<void> {
  if (level !== "staff") await requireLevel(supabase, userId, organizationId, "owner");
  if (level === "owner" || !presetId) return;
  const { data: preset } = await supabase
    .from("access_presets")
    .select("access_level")
    .eq("id", presetId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!preset) throw new Error("That preset doesn't exist in this agency");
  if (preset.access_level !== level) throw new Error("That preset is for a different access level");
}

async function loadInviterName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  const row = (data ?? {}) as {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  const full = String(row.full_name ?? "").trim();
  if (full) return full;
  const joined = [row.first_name, row.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "A teammate";
}

async function loadProfileEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return pickReplyTo(null, (data as { email?: string | null } | null)?.email ?? null);
}

/**
 * Account history for the profile's Activity tab. Never fails the invite: a
 * log write that errors is only reported to the server console.
 */
async function logInviteSent(args: {
  organizationId: string;
  actorId: string;
  email: string;
  level: AccessLevel;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logChange } = await import("@/lib/access/change-log.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("email", args.email.trim().toLowerCase())
      .maybeSingle();
    await logChange(
      args.organizationId,
      args.actorId,
      "invite_sent",
      { userId: prof?.id ?? null, name: prof?.full_name ?? args.email },
      { email: args.email, access_level: args.level },
    );
  } catch (e) {
    console.warn("[invites] invite_sent log failed:", e);
  }
}

async function sendInvitationEmail(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  email: string;
  level: AccessLevel;
  token: string;
  inviterUserId: string;
  /** Auth email for the person sending, used when profiles.email is empty. */
  inviterEmail?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, organizationId, email, level, token, inviterUserId, inviterEmail } = args;
  try {
    const actorEmail =
      (await loadProfileEmail(supabase, inviterUserId)) ?? pickReplyTo(null, inviterEmail);
    const sender = await resolveOrgSender(supabase, organizationId, actorEmail);
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    const orgName = stripFakeDisplayLabel(String(org?.name || "").trim()) || "your organization";
    const inviterName = await loadInviterName(supabase, inviterUserId);
    const link = inviteJoinUrl(token);
    const { subject, html, text } = buildInvitationEmail({
      orgName,
      role: level,
      link,
      inviterName,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invokeData, error: invokeErr } = await (supabaseAdmin as any).functions.invoke(
      "send-email",
      {
        body: {
          from: sender.from,
          to: email,
          subject,
          html,
          text,
          ...(sender.reply_to ? { reply_to: sender.reply_to } : {}),
        },
      },
    );
    if (invokeErr) return { ok: false, error: invokeErr.message || "Email send failed" };
    if (!invokeData || invokeData.ok !== true) {
      return { ok: false, error: (invokeData && invokeData.error) || "Email send failed" };
    }
    await logInviteSent({ organizationId, actorId: inviterUserId, email, level });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed" };
  }
}

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      email: string;
      access_level: AccessLevel;
      access_preset_id?: string | null;
    }) =>
      z
        .object({
          organization_id: ORG_ID,
          email: z.string().trim().toLowerCase().email().max(255),
          access_level: INVITE_LEVEL,
          access_preset_id: z.string().uuid().nullish(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { invitation: null, email_sent: false, email_error: null };
    await requirePermission(
      supabase as unknown as SupabaseClient,
      userId,
      data.organization_id,
      "invite_staff",
    );
    await assertCanInviteAt(
      supabase,
      userId,
      data.organization_id,
      data.access_level,
      data.access_preset_id,
    );
    await assertAgencySetupCompleteForOrg(supabase, data.organization_id);
    await assertInviteRate(userId);
    const presetId = await presetIdForInvite(
      data.organization_id,
      data.access_level,
      data.access_preset_id,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: existErr } = await (supabase as any)
      .from("invitations")
      .select("id")
      .eq("organization_id", data.organization_id)
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();
    if (existErr) throw new Error(existErr.message);
    if (existing) throw new Error("A pending invitation already exists for this email");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invite, error } = await (supabase as any)
      .from("invitations")
      .insert({
        organization_id: data.organization_id,
        email: data.email,
        access_level: data.access_level,
        access_preset_id: presetId,
        invited_by: userId,
      })
      .select(INVITE_SELECT)
      .single();
    if (error) throw new Error(error.message);

    const emailResult = await sendInvitationEmail({
      supabase,
      organizationId: data.organization_id,
      email: data.email,
      level: data.access_level,
      token: (invite as InvitationRow).token,
      inviterUserId: userId,
      inviterEmail: context.claims?.email ?? null,
    });

    return {
      invitation: invite as InvitationRow,
      email_sent: emailResult.ok,
      email_error: emailResult.ok ? null : (emailResult.error ?? "Email send failed"),
    };
  });

/**
 * Resend also rewrites access_level / access_preset_id (see
 * invitation-resend-access.ts): from the values passed in, or else from the
 * person's current organization_members row. Without this, an invite created
 * before an access change would hand the OLD access back when they join.
 */
export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      invitation_id: string;
      access_level?: AccessLevel;
      access_preset_id?: string | null;
    }) =>
      z
        .object({
          organization_id: ORG_ID,
          invitation_id: z.string().uuid(),
          access_level: INVITE_LEVEL.optional(),
          access_preset_id: z.string().uuid().nullish(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { invitation: null, email_sent: false, email_error: null };
    await requirePermission(
      supabase as unknown as SupabaseClient,
      userId,
      data.organization_id,
      "invite_staff",
    );
    await assertInviteRate(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: current, error: readErr } = await sb
      .from("invitations")
      .select(INVITE_SELECT)
      .eq("id", data.invitation_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Invitation not found");
    const currentRow = current as InvitationRow;

    // Explicit values go through the same checks as a new invite (Owner/Admin
    // needs an Owner; preset must belong to the org and match the level).
    let requested: InviteAccessValues | null = null;
    if (data.access_level) {
      await assertCanInviteAt(
        sb,
        userId,
        data.organization_id,
        data.access_level,
        data.access_preset_id,
      );
      requested = {
        access_level: data.access_level,
        access_preset_id: await presetIdForInvite(
          data.organization_id,
          data.access_level,
          data.access_preset_id,
        ),
      };
    }

    // Otherwise mirror what the person holds right now. organization_members
    // and profiles share no FK — two queries, joined by email in JS.
    let member: InviteAccessValues | null = null;
    if (!requested) {
      const { data: members, error: memErr } = await sb
        .from("organization_members")
        .select("user_id, access_level, access_preset_id")
        .eq("organization_id", data.organization_id);
      if (memErr) throw new Error(memErr.message);
      const memberRows = (members ?? []) as MemberAccessPick[];
      let profiles: ProfileEmailPick[] = [];
      if (memberRows.length) {
        const { data: profs, error: pErr } = await sb
          .from("profiles")
          .select("id, email")
          .in(
            "id",
            memberRows.map((m) => m.user_id),
          );
        if (pErr) throw new Error(pErr.message);
        profiles = (profs ?? []) as ProfileEmailPick[];
      }
      member = findMemberAccessByEmail(currentRow.email, memberRows, profiles);
    }
    const access = resolveResendAccess({ requested, member });

    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invite, error } = await sb
      .from("invitations")
      .update({ expires_at: expires, status: "pending", ...(access ?? {}) })
      .eq("id", data.invitation_id)
      .eq("organization_id", data.organization_id)
      .select(INVITE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invitation not found");

    const row = invite as InvitationRow;
    const emailResult = await sendInvitationEmail({
      supabase,
      organizationId: data.organization_id,
      email: row.email,
      level: row.access_level,
      token: row.token,
      inviterUserId: userId,
      inviterEmail: context.claims?.email ?? null,
    });

    return {
      invitation: row,
      email_sent: emailResult.ok,
      email_error: emailResult.ok ? null : (emailResult.error ?? "Email send failed"),
    };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; invitation_id: string }) =>
    z
      .object({
        organization_id: ORG_ID,
        invitation_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { invitation: null };
    await requirePermission(
      supabase as unknown as SupabaseClient,
      userId,
      data.organization_id,
      "invite_staff",
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invite, error } = await (supabase as any)
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitation_id)
      .eq("organization_id", data.organization_id)
      .eq("status", "pending")
      .select("id, email")
      .single();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invitation not found or already resolved");

    return { invitation: invite as { id: string; email: string } };
  });

async function upsertPendingInviteAndSend(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  userId: string;
  email: string;
  level: AccessLevel;
  presetId: string | null;
  inviterEmail?: string | null;
}): Promise<{ invitation: InvitationRow; email_sent: boolean; email_error: string | null }> {
  const { supabase, organizationId, userId, email, level, inviterEmail } = args;
  const presetId = await presetIdForInvite(organizationId, level, args.presetId);
  const access = { access_level: level, access_preset_id: presetId };
  await assertAgencySetupCompleteForOrg(supabase, organizationId);
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pending, error: pendingErr } = await supabase
    .from("invitations")
    .select(INVITE_SELECT)
    .eq("organization_id", organizationId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingErr) throw new Error(pendingErr.message);

  let invite = pending as InvitationRow | null;
  if (invite) {
    const { data: refreshed, error: refreshErr } = await supabase
      .from("invitations")
      .update({ expires_at: expires, ...access })
      .eq("id", invite.id)
      .eq("organization_id", organizationId)
      .select(INVITE_SELECT)
      .single();
    if (refreshErr) throw new Error(refreshErr.message);
    invite = refreshed as InvitationRow;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email,
        ...access,
        invited_by: userId,
      })
      .select(INVITE_SELECT)
      .single();
    if (createErr) throw new Error(createErr.message);
    invite = created as InvitationRow;
  }

  const emailResult = await sendInvitationEmail({
    supabase,
    organizationId,
    email,
    level,
    token: invite.token,
    inviterUserId: userId,
    inviterEmail,
  });
  return {
    invitation: invite,
    email_sent: emailResult.ok,
    email_error: emailResult.ok ? null : (emailResult.error ?? "Email send failed"),
  };
}

export type TeamMemberInviteTarget = {
  email: string;
  level: AccessLevel;
  presetId: string | null;
};

export type TeamMemberInviteOutcome = {
  email: string;
  email_sent: boolean;
  error: string | null;
};

/**
 * Add / Import team members: invite the people just created. Creates the
 * pending invitation, or updates and resends the one already pending for that
 * email. Checks invite_staff and the inviter's rate once for the whole batch.
 * Never throws per person — each outcome says whether the email went out.
 */
export async function sendTeamMemberInvitesInternal(args: {
  organizationId: string;
  actorId: string;
  actorEmail?: string | null;
  targets: TeamMemberInviteTarget[];
}): Promise<TeamMemberInviteOutcome[]> {
  if (!args.targets.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requirePermission(
    supabaseAdmin as unknown as SupabaseClient,
    args.actorId,
    args.organizationId,
    "invite_staff",
  );
  await assertInviteRate(args.actorId);
  const out: TeamMemberInviteOutcome[] = [];
  for (const t of args.targets) {
    try {
      const res = await upsertPendingInviteAndSend({
        supabase: supabaseAdmin,
        organizationId: args.organizationId,
        userId: args.actorId,
        email: t.email,
        level: t.level,
        presetId: t.presetId,
        inviterEmail: args.actorEmail ?? null,
      });
      out.push({ email: t.email, email_sent: res.email_sent, error: res.email_error });
    } catch (e) {
      out.push({
        email: t.email,
        email_sent: false,
        error: e instanceof Error ? e.message : "Invite failed",
      });
    }
  }
  return out;
}

/**
 * Invite already-created roster members (roster Send invite and the Invited
 * view). Never emails during CSV parse. Never re-invites an accepted
 * join unless resend_accepted is explicit.
 */
export const inviteStaffMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: ORG_ID,
        user_ids: z.array(z.string().uuid()).max(200).default([]),
        emails: z.array(z.string().trim().toLowerCase().email().max(255)).max(200).default([]),
        access_level: INVITE_LEVEL.optional(),
        resend_accepted: z.boolean().optional().default(false),
        force: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const empty = inviteSendPayload({
      email_sent: false,
      sent: 0,
      skipped: 0,
      errors: 0,
      results: [],
    });
    if (!supabase || !userId) return { ...empty, email_error: "Unauthorized" };
    try {
      await requirePermission(
        supabase as unknown as SupabaseClient,
        userId,
        data.organization_id,
        "invite_staff",
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      if (data.access_level) {
        await assertCanInviteAt(sb, userId, data.organization_id, data.access_level, null);
      }
      await assertInviteRate(userId);
      type Target = {
        userId: string | null;
        email: string;
        level: AccessLevel;
        presetId: string | null;
        mustChange: boolean | null;
      };
      const targets = new Map<string, Target>();

      if (data.user_ids.length) {
        const { data: members, error: memErr } = await sb
          .from("organization_members")
          .select("user_id, access_level, access_preset_id")
          .eq("organization_id", data.organization_id)
          .in("user_id", data.user_ids);
        if (memErr) throw new Error(memErr.message);
        type MemberAccessPick = {
          user_id: string;
          access_level: AccessLevel;
          access_preset_id: string | null;
        };
        const ids = (members ?? []).map((m: MemberAccessPick) => m.user_id);
        const accessByUser = new Map<string, MemberAccessPick>(
          (members ?? []).map((m: MemberAccessPick) => [m.user_id, m]),
        );
        if (ids.length) {
          const { data: profs, error: pErr } = await sb
            .from("profiles")
            .select("id, email, must_change_password")
            .in("id", ids);
          if (pErr) throw new Error(pErr.message);
          for (const p of profs ?? []) {
            const email = String(p.email ?? "")
              .trim()
              .toLowerCase();
            if (!email) continue;
            targets.set(email, {
              userId: p.id,
              email,
              level: data.access_level ?? accessByUser.get(p.id)?.access_level ?? "staff",
              presetId: data.access_level
                ? null
                : (accessByUser.get(p.id)?.access_preset_id ?? null),
              mustChange: p.must_change_password ?? null,
            });
          }
        }
      }

      for (const raw of data.emails) {
        const email = raw.trim().toLowerCase();
        if (targets.has(email)) continue;
        targets.set(email, {
          userId: null,
          email,
          level: data.access_level ?? "staff",
          presetId: null,
          mustChange: true,
        });
      }

      const emails = [...targets.keys()];
      const inviteByEmail = new Map<string, string>();
      if (emails.length) {
        const { data: invites, error: invErr } = await sb
          .from("invitations")
          .select("email, status")
          .eq("organization_id", data.organization_id)
          .in("email", emails);
        if (invErr) throw new Error(invErr.message);
        for (const row of invites ?? []) {
          const key = String(row.email ?? "").toLowerCase();
          const prev = inviteByEmail.get(key);
          if (row.status === "accepted" || prev !== "accepted") {
            inviteByEmail.set(key, String(row.status ?? ""));
          }
        }
      }

      const results: InviteTargetResult[] = [];
      let sent = 0;
      let skipped = 0;
      let errors = 0;

      for (const t of targets.values()) {
        const invitationStatus = inviteByEmail.get(t.email) ?? null;
        if (
          !canSendImportInvite(
            {
              email: t.email,
              mustChangePassword: t.mustChange,
              invitationStatus,
            },
            { resendAccepted: data.resend_accepted, force: data.force },
          )
        ) {
          skipped += 1;
          results.push({
            email: t.email,
            user_id: t.userId,
            status: "skipped",
            reason:
              invitationStatus === "accepted"
                ? "Already accepted — use Resend to send again"
                : t.mustChange === false
                  ? "Already has a login"
                  : "Not inviteable",
          });
          continue;
        }

        try {
          const out = await upsertPendingInviteAndSend({
            supabase: sb,
            organizationId: data.organization_id,
            userId,
            email: t.email,
            level: t.level,
            presetId: t.presetId,
            inviterEmail: context.claims?.email ?? null,
          });
          if (out.email_sent) {
            sent += 1;
            results.push({ email: t.email, user_id: t.userId, status: "sent", reason: null });
          } else {
            errors += 1;
            results.push({
              email: t.email,
              user_id: t.userId,
              status: "created_unsent",
              reason: out.email_error,
            });
          }
        } catch (e) {
          errors += 1;
          results.push({
            email: t.email,
            user_id: t.userId,
            status: "error",
            reason: e instanceof Error ? e.message : "Invite failed",
          });
        }
      }

      const emailError =
        results.find((r) => r.status === "created_unsent" || r.status === "error")?.reason ?? null;
      return inviteSendPayload({
        email_sent: sent > 0,
        email_error: emailError,
        sent,
        skipped,
        errors,
        results,
      });
    } catch (e) {
      return inviteSendPayload({
        email_sent: false,
        email_error: e instanceof Error ? e.message : "Invite failed",
        sent: 0,
        skipped: 0,
        errors: 1,
        status: "error",
      });
    }
  });

/**
 * Invited view on the Team Members roster: pending invitations (with expiry)
 * plus active members who have never signed in and have no pending invite
 * ("not_invited"). Scoped viewers see invites for the people they can see and
 * the invites they sent themselves.
 */
export const listTeamInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => z.object({ organizationId: ORG_ID }).parse(d))
  .handler(async ({ data, context }): Promise<TeamInviteRow[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const access = await requireCategory(
      supabase as unknown as SupabaseClient,
      userId,
      orgId,
      "staff_hiring",
      "view",
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { members, profiles } = await loadVisibleMembers({
      admin,
      organizationId: orgId,
      viewerId: userId,
      scope: access.scope,
    });

    const { data: inviteData, error: invErr } = await admin
      .from("invitations")
      .select(
        "id, token, email, access_level, access_preset_id, created_at, expires_at, invited_by",
      )
      .eq("organization_id", orgId)
      .eq("status", "pending");
    if (invErr) throw new Error(invErr.message);
    const visibleEmails = new Set(
      members
        .map((m) => profiles.get(m.user_id)?.email?.trim().toLowerCase() ?? "")
        .filter(Boolean),
    );
    const invitations = (
      (inviteData ?? []) as Array<InviteSourceInvitation & { invited_by: string | null }>
    ).filter(
      (i) =>
        access.scope === "agency" ||
        i.invited_by === userId ||
        visibleEmails.has(i.email.trim().toLowerCase()),
    );

    const signIns = await admin.rpc("org_member_last_sign_ins", { _org: orgId });
    const known = !signIns.error;
    const lastLogin = lastLoginByUserId(known ? signIns.data : null);

    const presetIds = [
      ...new Set(
        [
          ...members.map((m) => m.access_preset_id),
          ...invitations.map((i) => i.access_preset_id),
        ].filter((id): id is string => !!id),
      ),
    ];
    const presets = await selectIn<{ id: string; name: string }>(
      (ids) =>
        admin.from("access_presets").select("id, name").eq("organization_id", orgId).in("id", ids),
      presetIds,
    );

    return buildTeamInviteRows({
      invitations,
      members: members.map((m) => {
        const p = profiles.get(m.user_id);
        const level = asRosterLevel(m.access_level);
        return {
          userId: m.user_id,
          email: p?.email ?? "",
          name: p ? displayNameOf(p).display : null,
          accessLevel: level,
          presetId: level === "owner" ? null : m.access_preset_id,
          createdAt: m.created_at,
          active: isEmployeeOnActiveRoster({ active: m.active !== false, profile: p }),
          lastSignInAt: lastLogin.get(m.user_id) ?? null,
          lastSignInKnown: known && lastLogin.has(m.user_id),
        };
      }),
      presetNames: new Map(presets.map((p) => [p.id, p.name])),
      nowMs: Date.now(),
    });
  });
