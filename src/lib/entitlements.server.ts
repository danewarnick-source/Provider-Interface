import { entitlementsForOrg, isBillingExempt } from "@/lib/billing-access";
import { type AddonId } from "@/lib/hive-tiers";
import { requireOrgMembership } from "@/integrations/supabase/require-org";

/**
 * Server-side entitlement enforcement.
 *
 * UI locks (AddonLock / NectarInfusionLock) and the server check below must
 * agree — never trust the UI alone. Verifies the caller is an active member
 * of `organizationId`, reads THAT org's assigned tier from
 * `org_subscriptions`, and throws a 403-ish error if the requested add-on is
 * not included.
 *
 * Tier 3 Stage 3: the legacy `resolveCallerEntitlements` / `assertAddon`
 * helpers (which picked the caller's "primary" org via FIRST_MEMBERSHIP)
 * have been removed. Always pass the active org explicitly.
 */
export async function assertAddonForOrg(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  addon: AddonId,
  organizationId: string,
): Promise<void> {
  await requireOrgMembership(supabase, userId, organizationId, "staff");

  const { data: sub } = await supabase
    .from("org_subscriptions")
    .select("plan")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const orgRes = await supabase
    .from("organizations")
    .select("name, legal_name, dba_name, billing_exempt")
    .eq("id", organizationId)
    .maybeSingle();
  let org = orgRes.data as
    | { name: string; legal_name: string | null; dba_name: string | null; billing_exempt?: boolean }
    | null;
  if (orgRes.error && /billing_exempt/i.test(orgRes.error.message ?? "")) {
    const retry = await supabase
      .from("organizations")
      .select("name, legal_name, dba_name")
      .eq("id", organizationId)
      .maybeSingle();
    org = retry.data as typeof org;
  }
  const billingExempt = org
    ? isBillingExempt({
        billingExempt: org.billing_exempt === true,
        orgName: org.name,
        legalName: org.legal_name,
        dbaName: org.dba_name,
      })
    : false;
  const { addons } = entitlementsForOrg({
    billingExempt,
    plan: (sub?.plan as string | null) ?? null,
  });
  if (!addons.includes(addon)) {
    throw new Error(
      `Forbidden: this capability requires the "${addon}" add-on. Upgrade your plan to enable it.`,
    );
  }
}

/**
 * Team-member Nectar access. Membership is checked on the user client.
 * The org plan is read with the service role, scoped to that organization,
 * so caseload RLS cannot hide the plan or grant access from a client flag.
 */
export async function assertMemberPlanAddon(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  addon: AddonId,
  organizationId: string,
): Promise<void> {
  await requireOrgMembership(supabase, userId, organizationId, "staff");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;
  const { data: sub, error: subErr } = await admin
    .from("org_subscriptions")
    .select("plan")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (subErr) throw new Error("Could not verify this workspace's plan.");
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("name, legal_name, dba_name, billing_exempt, id")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr) throw new Error("Could not verify this workspace's plan.");
  const billingExempt = org
    ? isBillingExempt({
        billingExempt: org.billing_exempt === true,
        orgName: org.name,
        legalName: org.legal_name,
        dbaName: org.dba_name,
        organizationId,
      })
    : false;
  const { addons } = entitlementsForOrg({
    billingExempt,
    plan: (sub?.plan as string | null) ?? null,
  });
  if (!addons.includes(addon)) {
    throw new Error(
      `Forbidden: this capability requires the "${addon}" add-on. Upgrade your plan to enable it.`,
    );
  }
}
