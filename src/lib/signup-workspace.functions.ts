import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  agencyNameFromUserMetadata,
  isBlockedSignupMeta,
  isOrgSetupGateError,
  isRbacSeedTriggerError,
  isSelfServeAgencySignup,
  resolveSignupWorkspaceName,
  type SignupWorkspaceReason,
} from "@/lib/signup-workspace";
import { defaultUsernameFromEmail } from "@/lib/account-username";

export type EnsureSignupWorkspaceResult = {
  ok: boolean;
  orgId: string | null;
  reason: SignupWorkspaceReason | null;
};

function emailLocalPart(email: string | null | undefined): string {
  const raw = String(email ?? "").trim();
  const at = raw.indexOf("@");
  return at > 0 ? raw.slice(0, at) : raw;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function skipped(): EnsureSignupWorkspaceResult {
  return { ok: false, orgId: null, reason: "not_agency_signup" };
}

/**
 * After a real session exists: find the creator org, or provision profile +
 * org + Owner membership.
 *
 * The live on_auth_user_created trigger still creates that workspace at
 * signUp, before email confirmation. docs/SQL_HANDOFF_signup_after_confirm.sql
 * stops that. This function is what creates it after confirmation.
 *
 * Owner insert uses the service role. RLS policy "admins insert org members"
 * only allows someone who is already an owner, so the new user's session
 * cannot insert the row. trg_org_members_require_org_setup still fires for
 * the service role, and enforce_org_setup_before_create allows the first
 * organization_members row for that org. No extra SQL is required for it.
 *
 * Access presets are seeded by the trg_access_seed_presets org trigger.
 * Never log name / phone / email.
 */
export const ensureSignupWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agencyName?: string } | undefined) => {
    return { agencyName: String(input?.agencyName ?? "").trim() };
  })
  .handler(async ({ data, context }): Promise<EnsureSignupWorkspaceResult> => {
    const userId = context.userId;
    if (!userId) {
      return { ok: false, orgId: null, reason: "no_session" };
    }

    const claimsMeta = context.claims?.user_metadata;
    if (isBlockedSignupMeta(claimsMeta)) return skipped();

    // Session client first — preview often has VITE_ URL/anon but no
    // SUPABASE_SERVICE_ROLE_KEY. Admin lookup then throws and Business
    // Continue never PATCHes organizations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userClient = context.supabase as any;
    if (userClient && isSelfServeAgencySignup(claimsMeta)) {
      try {
        const { data: created } = await userClient
          .from("organizations")
          .select("id")
          .eq("created_by", userId)
          .limit(1)
          .maybeSingle();
        if (typeof created?.id === "string") {
          const { data: member } = await userClient
            .from("organization_members")
            .select("id")
            .eq("organization_id", created.id)
            .eq("user_id", userId)
            .eq("active", true)
            .limit(1)
            .maybeSingle();
          if (typeof member?.id === "string") {
            return { ok: true, orgId: created.id, reason: null };
          }
        }
      } catch {
        console.warn("[signup] workspace session lookup failed", { code: "org_query_error" });
      }
    }

    const { readSupabaseAdminEnv } = await import("@/lib/supabase-public-env");
    if (!readSupabaseAdminEnv()) {
      if (!isSelfServeAgencySignup(claimsMeta)) return skipped();
      return { ok: false, orgId: null, reason: "provision_failed" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let admin: any;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      admin = supabaseAdmin as typeof admin;
    } catch {
      console.warn("[signup] workspace provision failed", { code: "provision_failed" });
      return { ok: false, orgId: null, reason: "provision_failed" };
    }

    let meta: unknown = claimsMeta;
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const fetched = authUser?.user?.user_metadata;
      if (fetched && typeof fetched === "object" && !Array.isArray(fetched)) {
        if (Object.keys(fetched as Record<string, unknown>).length > 0) meta = fetched;
      }
    } catch {
      console.warn("[signup] workspace auth user lookup failed", { code: "metadata_lookup" });
    }

    if (isBlockedSignupMeta(meta) || !isSelfServeAgencySignup(meta)) return skipped();

    try {
      const { data: auditor } = await admin
        .from("auditor_accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (Array.isArray(auditor) && auditor.length > 0) return skipped();
    } catch {
      /* table may not be applied yet */
    }

    const findOrg = async (): Promise<{
      orgId: string | null;
      reason: SignupWorkspaceReason | null;
    }> => {
      const { data: org, error } = await admin
        .from("organizations")
        .select("id")
        .eq("created_by", userId)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[signup] workspace lookup failed", { code: "org_query_error" });
        return { orgId: null, reason: "org_query_error" };
      }
      const orgId = typeof org?.id === "string" ? org.id : null;
      return { orgId, reason: null };
    };

    // First member of a new org. Service role bypasses RLS; the setup
    // trigger allows this row. Do not reactivate a membership an admin turned off.
    const ensureOwnerMembership = async (orgId: string): Promise<EnsureSignupWorkspaceResult> => {
      const { data: mine, error: mineErr } = await admin
        .from("organization_members")
        .select("id, active")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (mineErr) {
        console.warn("[signup] workspace membership lookup failed", { code: "provision_failed" });
        return { ok: false, orgId: null, reason: "provision_failed" };
      }
      if (typeof mine?.id === "string") {
        if (mine.active === false) return skipped();
        return { ok: true, orgId, reason: null };
      }

      const { data: other } = await admin
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
        .maybeSingle();
      if (typeof other?.id === "string") {
        console.warn("[signup] workspace membership insert failed", { code: "setup_gate" });
        return { ok: false, orgId: null, reason: "provision_failed" };
      }

      const memberIns = await admin.from("organization_members").insert({
        organization_id: orgId,
        user_id: userId,
        access_level: "owner",
        active: true,
      });
      if (memberIns?.error) {
        const code = isOrgSetupGateError(memberIns.error.message)
          ? "setup_gate"
          : "provision_failed";
        console.warn("[signup] workspace membership insert failed", { code });
        return { ok: false, orgId: null, reason: "provision_failed" };
      }
      return { ok: true, orgId, reason: null };
    };

    let existing: { orgId: string | null; reason: SignupWorkspaceReason | null };
    try {
      existing = await findOrg();
    } catch {
      console.warn("[signup] workspace provision failed", { code: "provision_failed" });
      return { ok: false, orgId: null, reason: "provision_failed" };
    }
    if (existing.reason === "org_query_error") {
      return { ok: false, orgId: null, reason: "org_query_error" };
    }
    if (existing.orgId) {
      return ensureOwnerMembership(existing.orgId);
    }

    let profileAgencyName = "";
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("agency_name")
        .eq("id", userId)
        .maybeSingle();
      if (typeof profile?.agency_name === "string") profileAgencyName = profile.agency_name;
    } catch {
      /* name falls through to auth metadata */
    }

    const name = resolveSignupWorkspaceName({
      agencyName: data.agencyName,
      profileAgencyName,
      metadataAgencyName: agencyNameFromUserMetadata(meta),
      emailLocalPart: emailLocalPart(context.claims?.email ?? null),
    });
    const slugBase = `${name}-${String(userId).slice(0, 6)}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    try {
      const profileEmail = context.claims?.email ?? null;
      const profileUpsert = await admin.from("profiles").upsert(
        {
          id: userId,
          email: profileEmail,
          username: defaultUsernameFromEmail(profileEmail) || null,
          agency_name: name,
        },
        { onConflict: "id" },
      );
      if (profileUpsert?.error) {
        console.warn("[signup] workspace profile upsert failed", { code: "provision_failed" });
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const again = await findOrg();
        if (again.orgId) {
          return ensureOwnerMembership(again.orgId);
        }

        const { data: created, error: insertErr } = await admin
          .from("organizations")
          .insert({
            name,
            slug: attempt === 0 ? slugBase : `${slugBase}-${attempt}`,
            created_by: userId,
          })
          .select("id")
          .maybeSingle();

        if (insertErr) {
          if (isRbacSeedTriggerError(insertErr.message)) {
            console.warn("[signup] workspace provision failed", { code: "trigger_blocked" });
            return { ok: false, orgId: null, reason: "trigger_blocked" };
          }
          console.warn("[signup] workspace provision failed", { code: "provision_failed" });
        } else if (typeof created?.id === "string") {
          return ensureOwnerMembership(created.id);
        }
        await sleep(350 * (attempt + 1));
      }

      const last = await findOrg();
      if (last.orgId) {
        return ensureOwnerMembership(last.orgId);
      }
      return { ok: false, orgId: null, reason: last.reason ?? "provision_failed" };
    } catch {
      console.warn("[signup] workspace provision failed", { code: "provision_failed" });
      return { ok: false, orgId: null, reason: "provision_failed" };
    }
  });
