import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";

/**
 * Open shifts = scheduled_shifts where staff_id IS NULL and status='open'.
 * Lifecycle:
 *   admin posts → status='open'
 *   team member requests → status stays 'open', claim_requested_by = userId (staff_id still NULL)
 *   admin approves → status='accepted', staff_id = claim_requested_by, claim_requested_by NULL
 *   admin denies → status='open', claim_requested_by NULL
 *
 * Note: status 'pending' is NOT allowed by scheduled_shifts_status_check.
 */

export const listOpenShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organizationId: string;
    startIso: string;
    endIso: string;
  }) => z.object({
    organizationId: z.string().uuid(),
    startIso: z.string(),
    endIso: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) return [];
    const { data: rows, error } = await context.supabase
      .from("scheduled_shifts")
      .select("id, organization_id, client_id, service_code, starts_at, ends_at, location_id, notes, status, claim_requested_by")
      .eq("organization_id", data.organizationId)
      .eq("status", "open")
      .is("staff_id", null)
      .gte("starts_at", data.startIso)
      .lt("starts_at", data.endIso)
      .order("starts_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const claimOpenShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shiftId: string }) =>
    z.object({ shiftId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    if (!supabase || !userId) return { ok: false };
    const { data: shift, error: gErr } = await supabase
      .from("scheduled_shifts")
      .select("id, organization_id, status, staff_id, client_id, starts_at, service_code, claim_requested_by")
      .eq("id", data.shiftId).maybeSingle();
    if (gErr) throw gErr;
    if (!shift) throw new Error("Shift not found");
    if (shift.staff_id) throw new Error("Shift is already assigned");
    if (shift.status !== "open") throw new Error("Shift is not open for claim");
    if (shift.claim_requested_by === userId) return { ok: true };
    if (shift.claim_requested_by) throw new Error("Someone already requested this shift.");

    const { data: updated, error: uErr } = await supabase
      .from("scheduled_shifts")
      // Request only. Assignment (staff_id / status) waits for an admin decision.
      .update({ claim_requested_by: userId })
      .eq("id", data.shiftId)
      .eq("status", "open")
      .is("staff_id", null)
      .is("claim_requested_by", null)
      .select("id");
    if (uErr) throw uErr;
    if (!updated?.length) throw new Error("This shift is no longer available to request.");

    // Notify admins (best-effort): role-targeted notification
    try {
      await supabase.from("notifications").insert({
        organization_id: shift.organization_id,
        recipient_role: "admin",
        type: "shift_claim_request",
        title: "Open shift requested",
        body: `A team member requested ${shift.service_code ?? "an open shift"} on ${new Date(shift.starts_at).toLocaleDateString()}.`,
        link_to: `/dashboard/scheduler`,
        related_id: data.shiftId,
        related_type: "scheduled_shift",
      });
    } catch { /* best-effort */ }

    return { ok: true };
  });

export const decideClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shiftId: string; approve: boolean }) =>
    z.object({ shiftId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const { data: shift, error: gErr } = await supabase
      .from("scheduled_shifts")
      .select("id, organization_id, claim_requested_by, service_code, starts_at")
      .eq("id", data.shiftId).maybeSingle();
    if (gErr) throw gErr;
    if (!shift) throw new Error("Shift not found");
    // Owner or Admin of this shift's agency. A team member must not approve their own claim.
    await requireOrgMembership(supabase, userId, shift.organization_id, "admin");
    if (!shift.claim_requested_by) throw new Error("No pending claim on this shift");

    const claimant = shift.claim_requested_by;

    const patch = data.approve
      ? { status: "accepted", staff_id: claimant, claim_requested_by: null }
      : { status: "open", claim_requested_by: null };

    const { error: uErr } = await supabase
      .from("scheduled_shifts")
      .update(patch)
      .eq("id", data.shiftId);
    if (uErr) throw uErr;

    try {
      await supabase.from("notifications").insert({
        recipient_user_id: claimant,
        recipient_role: "employee",
        organization_id: shift.organization_id,
        type: data.approve ? "shift_claim_approved" : "shift_claim_denied",
        title: data.approve ? "Claim approved" : "Claim denied",
        body: data.approve
          ? `Your claim for ${shift.service_code ?? "the open shift"} on ${new Date(shift.starts_at).toLocaleDateString()} was approved.`
          : `Your claim for ${shift.service_code ?? "the open shift"} was not approved.`,
        link_to: `/dashboard/schedule`,
        related_id: data.shiftId,
        related_type: "scheduled_shift",
      });
    } catch { /* best-effort */ }

    return { ok: true };
  });
