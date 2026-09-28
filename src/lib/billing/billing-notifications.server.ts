// Billing email dispatch.
//
// Renders PI-branded templates from src/lib/billing-emails.ts and sends
// via the existing `send-email` edge function. From stays the platform
// mailbox. Reply-To is the org setting when one is set; otherwise the
// message still sends. A lookup failure logs and returns gracefully —
// billing state changes must never fail because email infrastructure is
// unavailable (the payment_events row is the durable record of truth).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderBillingEmail, type BillingEmailKind, type BillingEmailVars } from "./billing-emails";

export type { BillingEmailKind } from "./billing-emails";

export interface BillingEmailContext {
  orgId: string;
  kind: BillingEmailKind;
  data?: BillingEmailVars;
}

async function getOrgAdminEmails(orgId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabaseAdmin as any)
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("active", true)
    .eq("access_level", "owner");
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (ids.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabaseAdmin as any)
    .from("profiles")
    .select("email")
    .in("id", ids);
  return (profiles ?? [])
    .map((p: { email: string | null }) => p.email)
    .filter((e: string | null): e is string => !!e);
}

async function getOrgStaffEmails(orgId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabaseAdmin as any)
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("active", true);
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (ids.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabaseAdmin as any)
    .from("profiles")
    .select("email")
    .in("id", ids);
  return (profiles ?? [])
    .map((p: { email: string | null }) => p.email)
    .filter((e: string | null): e is string => !!e);
}

async function getAgencyName(orgId: string): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  return data?.name ?? undefined;
}

async function getSenderFor(orgId: string): Promise<{ from: string; reply_to: string | null } | null> {
  try {
    const { resolveOrgSender } = await import("../email.functions");
    // No acting person on billing mail. Missing reply-to still sends.
    return await resolveOrgSender(supabaseAdmin, orgId);
  } catch {
    // Lookup failure. Billing state changes must never break on email.
    return null;
  }
}


export async function sendBillingEmail(ctx: BillingEmailContext): Promise<{
  sent: boolean;
  recipients: string[];
  reason?: string;
}> {
  try {
    const recipients =
      ctx.kind === "account_locked_staff"
        ? await getOrgStaffEmails(ctx.orgId)
        : await getOrgAdminEmails(ctx.orgId);

    if (recipients.length === 0) {
      return { sent: false, recipients: [], reason: "no_recipients" };
    }

    const agencyName = ctx.data?.agencyName ?? (await getAgencyName(ctx.orgId));
    const rendered = renderBillingEmail(ctx.kind, { ...ctx.data, agencyName });

    const sender = await getSenderFor(ctx.orgId);
    if (!sender) {
      // No verified sender configured. Templates are ready; once
      // an email domain is set up this branch will switch to sending.
      return { sent: false, recipients, reason: "no_sender_configured" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invoke, error } = await (supabaseAdmin as any).functions.invoke("send-email", {
      body: {
        from: sender.from,
        to: recipients,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(sender.reply_to ? { reply_to: sender.reply_to } : {}),
      },
    });

    if (error || !invoke?.ok) {
      // eslint-disable-next-line no-console
      console.error("[billing-email:send-failed]", ctx.kind, ctx.orgId, error?.message || invoke?.error);
      return { sent: false, recipients, reason: "send_failed" };
    }
    return { sent: true, recipients };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[billing-email:exception]", ctx.kind, ctx.orgId, err);
    return { sent: false, recipients: [], reason: "exception" };
  }
}
