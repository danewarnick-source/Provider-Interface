// Shared email rail.
//
// `sendEmail` is the SINGLE server fn every email feature (loan signatures,
// referral follow-ups, billing/onboarding notifications) goes through. It:
//   1. Verifies caller has `send_emails` permission in the org.
//   2. Resolves the org's sender via resolveOrgSender().
//   3. Invokes the `send-email` edge function with the service-role client
//      (Resend, RESEND_API_KEY). The function rejects any other bearer.
//
// Two modes exist in org_email_settings.send_mode:
//   - 'hive_managed' (default, active): sends from managedFromAddress()
//     (RESEND_FROM / EMAIL_FROM, else noreply@providerinterface.com)
//     with the org's display name. Reply-To is the org setting, then the
//     sender's own email, then omitted. Zero DNS setup.
//   - 'own_domain' (deferred, not built yet): would send from the org's own
//     verified domain. updateOrgEmailSettings rejects this mode for now.
//
// Override the mailbox with RESEND_FROM or EMAIL_FROM. Display name stays
// the org's from_name / org name / "Provider Interface".

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/access/require";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import {
  DEFAULT_MANAGED_FROM_NAME,
  formatFromHeader,
  managedFromAddress,
  pickReplyTo,
  stripFakeDisplayLabel,
} from "../shared/managed-from.ts";

export { HIVE_MANAGED_FROM_ADDRESS, managedFromAddress } from "../shared/managed-from.ts";

const ORG_ID = z.string().uuid();

export type ResolvedSender = {
  from: string; // "Display Name <address>"
  /** Null when neither the org nor the fallback address is a usable mailbox. */
  reply_to: string | null;
  send_mode: "hive_managed";
};

/** Server-only helper. Loads org email settings + org name, composes the From
 *  header, and returns the reply-to address. From stays the platform mailbox.
 *  Reply-To is the org setting, then fallbackReplyTo (the person sending),
 *  then omitted so the message still goes out. Any server fn / .server helper
 *  that sends email MUST go through this so all rails stay consistent when
 *  the From mailbox is swapped via RESEND_FROM. */
export async function resolveOrgSender(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  organizationId: string,
  fallbackReplyTo?: string | null,
): Promise<ResolvedSender> {
  const { data: settings, error: sErr } = await supabase
    .from("org_email_settings")
    .select("send_mode, from_name, from_address, reply_to")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);

  const { data: org, error: oErr } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);

  const orgName = String(org?.name || "").trim();

  // Mode 2 (own_domain) is deferred — fall through to hive_managed rather
  // than blocking sends, so no org is silently broken.

  const displayName =
    String(settings?.from_name || "").trim() || orgName || DEFAULT_MANAGED_FROM_NAME;

  return {
    from: formatFromHeader(displayName),
    reply_to: pickReplyTo(settings?.reply_to, fallbackReplyTo),
    send_mode: "hive_managed",
  };
}

// ────────── Settings ──────────

export const getOrgEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: ORG_ID }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) {
      return { settings: null, hive_managed_from_address: managedFromAddress() };
    }
    await requireOrgMembership(
      supabase as unknown as SupabaseClient,
      userId,
      data.organization_id,
      "staff",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from("org_email_settings")
      .select("organization_id, send_mode, from_name, from_address, reply_to, verified, updated_at")
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      settings: row ?? null,
      hive_managed_from_address: managedFromAddress(),
    };
  });

export const updateOrgEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      send_mode?: "hive_managed" | "own_domain";
      from_name?: string | null;
      reply_to: string;
    }) =>
      z
        .object({
          organization_id: ORG_ID,
          send_mode: z.enum(["hive_managed", "own_domain"]).optional(),
          from_name: z.string().trim().max(200).nullable().optional(),
          reply_to: z.string().trim().email().max(320),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return null;
    await requirePermission(
      supabase as unknown as SupabaseClient,
      userId,
      data.organization_id,
      "manage_organization",
    );

    const mode = data.send_mode ?? "hive_managed";
    if (mode === "own_domain") {
      throw new Error(
        "Custom-domain sending isn't available yet. PI-managed sending is active and works with no DNS setup.",
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from("org_email_settings")
      .upsert(
        {
          organization_id: data.organization_id,
          send_mode: "hive_managed",
          from_name: stripFakeDisplayLabel(data.from_name ?? "") || null,
          from_address: null, // Mode 1 uses managedFromAddress()
          reply_to: data.reply_to,
          verified: true, // Mode 1 is trusted (shared PI sender)
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ────────── Send ──────────

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
      cc?: string[];
      bcc?: string[];
      reply_to?: string;
      /** Forces a failure path for honest-error verification. Server-side only. */
      forceFail?: boolean;
    }) =>
      z
        .object({
          organization_id: ORG_ID,
          to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
          subject: z.string().trim().min(1).max(998),
          html: z.string().max(200_000).optional(),
          text: z.string().max(200_000).optional(),
          cc: z.array(z.string().email()).optional(),
          bcc: z.array(z.string().email()).optional(),
          reply_to: z.string().email().optional(),
          forceFail: z.boolean().optional(),
        })
        .refine((v) => !!(v.html || v.text), { message: "html or text required" })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) {
      return { ok: false as const, error: "Unauthorized" };
    }
    await requirePermission(
      supabase as unknown as SupabaseClient,
      userId,
      data.organization_id,
      "send_emails",
    );

    const claimEmail =
      context.claims && typeof context.claims.email === "string" ? context.claims.email : null;
    let fallbackReplyTo = pickReplyTo(null, claimEmail);
    if (!fallbackReplyTo) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      fallbackReplyTo = pickReplyTo(null, profile?.email ?? null);
    }
    const sender = await resolveOrgSender(supabase, data.organization_id, fallbackReplyTo);
    const replyTo = data.reply_to ?? sender.reply_to;

    if (data.forceFail) {
      return { ok: false as const, error: "Forced failure (verification path)" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invokeData, error: invokeErr } = await (supabaseAdmin as any).functions.invoke(
      "send-email",
      {
        body: {
          from: sender.from,
          to: data.to,
          subject: data.subject,
          html: data.html,
          text: data.text,
          cc: data.cc,
          bcc: data.bcc,
          // Per-call reply_to wins. Org settings, then the sender's own
          // email. Omit the header when neither is available.
          ...(replyTo ? { reply_to: replyTo } : {}),
        },
      },
    );

    if (invokeErr) {
      return { ok: false as const, error: invokeErr.message || "Email send failed" };
    }
    if (!invokeData || invokeData.ok !== true) {
      return { ok: false as const, error: (invokeData && invokeData.error) || "Email send failed" };
    }
    return { ok: true as const, id: invokeData.id ?? null };
  });
