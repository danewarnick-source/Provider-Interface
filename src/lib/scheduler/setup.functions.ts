// Staff ↔ client code assignments (setStaffClientCodes).
// All writes go through requireSupabaseAuth so RLS enforces tenant scope.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  onStaffAssignmentCreatedInternal,
  onStaffAssignmentRemovedInternal,
} from "@/lib/staff-assignment-hooks.functions";
import { assertCanManageMember } from "@/lib/team-members/guards.server";
import { waiveRemovedClientItemsInternal } from "@/lib/team-members/caseload.functions";
import { assignmentCodes, resolveStaffClientCodes } from "@/lib/assignment-codes";
import { loadActiveCodes } from "@/lib/clients/services/codes";
import { exclusionAssignRefusal } from "@/lib/clients/team/exclusions";
import { exclusionFor } from "@/lib/clients/team/exclusions-check.server";

// ──────────────────────────────────────────────────────────────────────────────
// Staff ↔ client code assignments — the single write path.
//
// Every staff_assignments row lists its codes explicitly. NULL / [] is never
// "all codes". Codes must be a subset of the client's currently authorized
// codes (active client_billing_codes rows, loadActiveCodes). An empty list deletes the assignment row —
// assignments are settings, not records — and waives that client's open
// staff_per_client items ("Removed from caseload"); those are never deleted.
//
// setStaffClientCodes is what the client profile (caseload editor +
// Authorized Codes section) and the Team Members Caseload tab call.
//
// Permission (one rule, shared with Team Members): staff_roster Edit, and a
// non-agency-scope actor must be able to see the team member
// (access_can_see_staff) — assertCanManageMember("edit_caseload").
// ──────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function loadClientCodes(
  supabase: AnySupabase,
  organizationId: string,
  clientId: string,
): Promise<string[]> {
  const { data: clientRow, error } = await supabase
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!clientRow) throw new Error("Client not found in this organization");
  return (await loadActiveCodes(supabase, [clientId])).get(clientId) ?? [];
}

async function loadAssignmentRow(
  supabase: AnySupabase,
  organizationId: string,
  staffId: string,
  clientId: string,
): Promise<{ id: string; service_codes: string[] | null } | null> {
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("id, service_codes")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("staff_id", staffId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string; service_codes: string[] | null } | null) ?? null;
}

/**
 * Write one staff member's explicit codes for one client. codes = [] deletes
 * the row. Caller has already run the permission check and validated codes
 * against the client's active codes.
 */
/** Obligation hooks are best-effort: the assignment is already saved. */
async function runAssignmentHook(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn(`[obligations] assignment ${label} hook failed:`, e);
  }
}

async function writeStaffClientCodes(
  supabase: AnySupabase,
  args: { organizationId: string; staffId: string; clientId: string; codes: string[] },
): Promise<{ status: "created" | "updated" | "removed" | "unchanged" }> {
  const { organizationId, staffId, clientId, codes } = args;
  if (codes.length > 0) {
    // Nobody on the client's do-not-schedule list joins the team.
    const excluded = await exclusionFor(supabase, organizationId, clientId, staffId);
    if (excluded) throw new Error(exclusionAssignRefusal(excluded.reason));
  }
  const existing = await loadAssignmentRow(supabase, organizationId, staffId, clientId);

  if (codes.length === 0) {
    if (!existing) return { status: "unchanged" };
    const { error } = await supabase.from("staff_assignments").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
    // The client's open staff_per_client items are waived, never deleted.
    await runAssignmentHook("removed", async () => {
      await waiveRemovedClientItemsInternal(supabase, { organizationId, staffId, clientId });
    });
    await runAssignmentHook("removed", () =>
      onStaffAssignmentRemovedInternal(supabase, organizationId, staffId),
    );
    return { status: "removed" };
  }

  if (existing) {
    const prev = assignmentCodes(existing.service_codes);
    const same =
      existing.service_codes !== null &&
      prev.length === codes.length &&
      codes.every((c) => prev.includes(c));
    if (same) return { status: "unchanged" };
    const { error } = await supabase
      .from("staff_assignments")
      .update({ service_codes: codes })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    // Dropped codes can end per-client duties; added codes can start them.
    if (prev.some((c) => !codes.includes(c))) {
      await runAssignmentHook("removed", () =>
        onStaffAssignmentRemovedInternal(supabase, organizationId, staffId),
      );
    }
  } else {
    const { error } = await supabase.from("staff_assignments").insert({
      organization_id: organizationId,
      client_id: clientId,
      staff_id: staffId,
      is_group_home_assignment: false,
      service_codes: codes,
    });
    if (error) throw new Error(error.message);
  }
  await runAssignmentHook("created", () =>
    onStaffAssignmentCreatedInternal(supabase, organizationId, staffId, clientId, codes),
  );
  return { status: existing ? "updated" : "created" };
}

async function assertCanEditCaseload(
  supabase: AnySupabase,
  actorId: string,
  organizationId: string,
  staffId: string,
): Promise<void> {
  await assertCanManageMember({
    supabase,
    actorId,
    organizationId,
    targetUserId: staffId,
    action: "edit_caseload",
  });
}

const staffClientCodesInput = z.object({
  organizationId: z.string().uuid(),
  staffId: z.string().uuid(),
  clientId: z.string().uuid(),
  codes: z.array(z.string()),
});

export const setStaffClientCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof staffClientCodesInput>) => staffClientCodesInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) throw new Error("Not signed in");
    await assertCanEditCaseload(supabase, userId, data.organizationId, data.staffId);
    const authorized = await loadClientCodes(supabase, data.organizationId, data.clientId);
    const codes = resolveStaffClientCodes(data.codes, authorized);
    return writeStaffClientCodes(supabase, {
      organizationId: data.organizationId,
      staffId: data.staffId,
      clientId: data.clientId,
      codes,
    });
  });
