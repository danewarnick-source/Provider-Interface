// Setup tools + Nectar drafting.
// All writes go through requireSupabaseAuth so RLS enforces tenant scope.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import {
  onStaffAssignmentCreatedInternal,
  onStaffAssignmentRemovedInternal,
} from "@/lib/staff-assignment-hooks.functions";
import { gatewayFetch, assertBedrockConfigured } from "@/lib/ai-bedrock.server";
import { assertCanManageMember } from "@/lib/team-members/guards.server";
import { waiveRemovedClientItemsInternal } from "@/lib/team-members/caseload.functions";
import {
  assignmentCodes,
  normalizeServiceCode,
  resolveStaffClientCodes,
  withCodeAdded,
  withCodeRemoved,
} from "@/lib/assignment-codes";
import { loadActiveCodes } from "@/lib/clients/codes";
import { exclusionAssignRefusal, exclusionRefusal, findExclusion } from "@/lib/clients/exclusions";
import { exclusionFor, loadActiveExclusions } from "@/lib/clients/exclusions-check.server";

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
// addStaffToClientCode / removeStaffFromClientCode are one-code wrappers
// over the same writer.
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

const singleCodeInput = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  service_code: z.string().min(1),
});

/** Add one code to a staff member's assignment for this client (creates the row if needed). */
export const addStaffToClientCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof singleCodeInput>) => singleCodeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) throw new Error("Not signed in");
    await assertCanEditCaseload(supabase, userId, data.organization_id, data.staff_id);
    const authorized = await loadClientCodes(supabase, data.organization_id, data.client_id);
    const [code] = resolveStaffClientCodes([data.service_code], authorized);
    if (!code) throw new Error("Pick a service code");
    const existing = await loadAssignmentRow(
      supabase,
      data.organization_id,
      data.staff_id,
      data.client_id,
    );
    await writeStaffClientCodes(supabase, {
      organizationId: data.organization_id,
      staffId: data.staff_id,
      clientId: data.client_id,
      codes: withCodeAdded(existing?.service_codes, code),
    });
    return { ok: true };
  });

/** Remove one code; removing the last code deletes the assignment row. */
export const removeStaffFromClientCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof singleCodeInput>) => singleCodeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) throw new Error("Not signed in");
    await assertCanEditCaseload(supabase, userId, data.organization_id, data.staff_id);
    const existing = await loadAssignmentRow(
      supabase,
      data.organization_id,
      data.staff_id,
      data.client_id,
    );
    if (!existing) return { ok: true };
    await writeStaffClientCodes(supabase, {
      organizationId: data.organization_id,
      staffId: data.staff_id,
      clientId: data.client_id,
      codes: withCodeRemoved(existing.service_codes, data.service_code),
    });
    return { ok: true };
  });

// ──────────────────────────────────────────────────────────────────────────────
// Nectar — draft shifts from a free-text prompt.
// Resolves names → real ids from this org's records. Unknown names/codes
// come back as flagged drafts the admin fixes before publishing.
// ──────────────────────────────────────────────────────────────────────────────
type DraftShift = {
  staff_id: string | null;
  staff_label: string | null;
  client_id: string | null;
  client_label: string | null;
  service_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  flags: string[];
};

export const nectarDraftShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; prompt: string; week_start_iso: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        prompt: z.string().min(3).max(4000),
        week_start_iso: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { drafts: [] };
    await requireOrgMembership(supabase, userId, data.organization_id, "staff");
    assertBedrockConfigured();

    const [staffRes, clientsRes, authsRes] = await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id, profiles:profiles!inner(id, first_name, last_name, full_name)")
        .is("deleted_at", null)
        .eq("organization_id", data.organization_id)
        .eq("active", true),
      supabase
        .from("clients")
        .select("id, first_name, last_name")
        .is("deleted_at", null)
        .eq("organization_id", data.organization_id),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("client_billing_codes" as any)
        .select("client_id, service_code, service_end_date")
        .eq("organization_id", data.organization_id),
    ]);

    type StaffRow = {
      profiles: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      };
    };
    const staffList = ((staffRes.data ?? []) as unknown as StaffRow[])
      .map((m) => m.profiles)
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        name:
          p.full_name?.trim() ||
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
          "Staff",
      }));
    const clientList = (
      (clientsRes.data ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
      }>
    ).map((c) => ({
      id: c.id,
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    }));
    const today = new Date().toISOString().slice(0, 10);
    const authsByClient = new Map<string, Set<string>>();
    for (const a of (authsRes.data ?? []) as Array<{
      client_id: string;
      service_code: string;
      service_end_date: string | null;
    }>) {
      if (a.service_end_date && a.service_end_date <= today) continue;
      const set = authsByClient.get(a.client_id) ?? new Set<string>();
      set.add((a.service_code ?? "").toUpperCase());
      authsByClient.set(a.client_id, set);
    }

    const system = `You are Nectar, a scheduling assistant for PI.
Output strict JSON with shape: {"drafts": [{"staff_name": string|null, "client_name": string|null, "service_code": string|null, "starts_at": string|null, "ends_at": string|null, "notes": string|null}]}.
Use ISO8601 UTC for starts_at/ends_at. The current week starts on ${data.week_start_iso}.
Only use staff and client names that appear in the lists below; if a name is ambiguous or missing, leave it null.
Only use service codes that appear in the codes list. Use null otherwise.

STAFF: ${JSON.stringify(staffList.map((s) => s.name))}
CLIENTS: ${JSON.stringify(clientList.map((c) => c.name))}
SERVICE CODES: ["SLH","SLN","COM","PAC","RP2","RP4","RP5","HHS","RHS","DSI","DSG","DSP","SEI","CHA","HSQ","PM1"]`;

    const aiRes = await gatewayFetch(
      {
        model: "bedrock",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      },
      { orgId: data.organization_id },
    );
    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) throw new Error("Nectar is rate-limited — try again shortly.");
      throw new Error(`Nectar error: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { drafts?: Array<Record<string, string | null>> } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const staffByName = new Map(staffList.map((s) => [norm(s.name), s.id]));
    const clientByName = new Map(clientList.map((c) => [norm(c.name), c.id]));

    const drafts: DraftShift[] = (parsed.drafts ?? []).map((d) => {
      const flags: string[] = [];
      const staffName = d.staff_name ?? null;
      const clientName = d.client_name ?? null;
      const code = (d.service_code ?? "")?.toUpperCase() || null;
      const staffId = staffName ? (staffByName.get(norm(staffName)) ?? null) : null;
      const clientId = clientName ? (clientByName.get(norm(clientName)) ?? null) : null;
      if (staffName && !staffId) flags.push("unknown staff");
      if (clientName && !clientId) flags.push("unknown client");
      if (clientId && code && !authsByClient.get(clientId)?.has(code))
        flags.push(`${code} not authorized for client`);
      if (!d.starts_at || !d.ends_at) flags.push("missing time");
      return {
        staff_id: staffId,
        staff_label: staffName,
        client_id: clientId,
        client_label: clientName,
        service_code: code,
        starts_at: d.starts_at ?? null,
        ends_at: d.ends_at ?? null,
        notes: d.notes ?? null,
        flags,
      };
    });

    return { drafts };
  });

// ──────────────────────────────────────────────────────────────────────────────
// Auto-fill open shifts — proposes (staff, shift) pairings for open shifts in
// the week. Doesn't write; admin reviews and accepts in the same drawer.
// ──────────────────────────────────────────────────────────────────────────────
export const autoFillOpenShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; week_start_iso: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        week_start_iso: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase } = context as any;
    if (!supabase) return { proposals: [] };
    const start = new Date(data.week_start_iso);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const [openRes, allShiftRes, assignRes, offRes] = await Promise.all([
      supabase
        .from("scheduled_shifts")
        .select("id, client_id, service_code, starts_at, ends_at")
        .eq("organization_id", data.organization_id)
        .is("staff_id", null)
        .in("status", ["open"])
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at"),
      supabase
        .from("scheduled_shifts")
        .select("staff_id, starts_at, ends_at")
        .eq("organization_id", data.organization_id)
        .not("staff_id", "is", null)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString()),
      supabase
        .from("staff_assignments")
        .select("staff_id, client_id, service_codes")
        .eq("organization_id", data.organization_id),
      supabase
        .from("time_off_requests")
        .select("staff_id, start_date, end_date")
        .eq("organization_id", data.organization_id)
        .eq("status", "approved")
        .gte("end_date", start.toISOString().slice(0, 10)),
    ]);
    if (openRes.error) throw openRes.error;

    const open = (openRes.data ?? []) as Array<{
      id: string;
      client_id: string;
      service_code: string;
      starts_at: string;
      ends_at: string;
    }>;
    const taken = (allShiftRes.data ?? []) as Array<{
      staff_id: string;
      starts_at: string;
      ends_at: string;
    }>;
    const assigns = (assignRes.data ?? []) as Array<{
      staff_id: string;
      client_id: string;
      service_codes: string[] | null;
    }>;
    const off = (offRes.data ?? []) as Array<{
      staff_id: string;
      start_date: string;
      end_date: string;
    }>;

    // Candidates per client + code: only staff assigned that exact code.
    // NULL / [] service_codes grant nothing.
    const staffByClientCode = new Map<string, Set<string>>();
    for (const a of assigns) {
      for (const code of assignmentCodes(a.service_codes)) {
        const key = `${a.client_id}|${code}`;
        const set = staffByClientCode.get(key) ?? new Set<string>();
        set.add(a.staff_id);
        staffByClientCode.set(key, set);
      }
    }
    const offByStaff = new Map<string, Array<[string, string]>>();
    for (const o of off) {
      const arr = offByStaff.get(o.staff_id) ?? [];
      arr.push([o.start_date, o.end_date]);
      offByStaff.set(o.staff_id, arr);
    }

    const overlaps = (aS: string, aE: string, bS: string, bE: string) =>
      new Date(aS) < new Date(bE) && new Date(aE) > new Date(bS);

    type Proposal = {
      shift_id: string;
      client_id: string;
      service_code: string;
      starts_at: string;
      ends_at: string;
      staff_id: string | null;
      reason: string;
    };
    const proposals: Proposal[] = open.map((s) => {
      const candidates = Array.from(
        staffByClientCode.get(`${s.client_id}|${normalizeServiceCode(s.service_code)}`) ?? [],
      );
      const day = s.starts_at.slice(0, 10);
      const eligible = candidates.filter((sid) => {
        const offs = offByStaff.get(sid) ?? [];
        if (offs.some(([a, b]) => a <= day && day <= b)) return false;
        const conflict = taken.some(
          (t) => t.staff_id === sid && overlaps(s.starts_at, s.ends_at, t.starts_at, t.ends_at),
        );
        return !conflict;
      });
      // Greedy: pick least-loaded staff first to spread shifts.
      const load = new Map<string, number>();
      for (const t of taken) load.set(t.staff_id, (load.get(t.staff_id) ?? 0) + 1);
      eligible.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
      const pick = eligible[0] ?? null;
      if (pick) {
        // Tentatively reserve so the next iteration sees the conflict
        taken.push({ staff_id: pick, starts_at: s.starts_at, ends_at: s.ends_at });
      }
      return {
        shift_id: s.id,
        client_id: s.client_id,
        service_code: s.service_code,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        staff_id: pick,
        reason: pick
          ? "Eligible — caseload, no conflict, not on time off."
          : candidates.length === 0
            ? "No team member is assigned this code for this client."
            : "All caseload staff conflict or are off.",
      };
    });

    return { proposals };
  });

/** Refuse the whole batch when any draft puts an excluded team member with a client. */
async function assertDraftsNotExcluded(
  supabase: AnySupabase,
  organizationId: string,
  drafts: Array<{ staff_id?: string | null; client_id?: string | null; assign_to_shift_id?: string | null }>,
): Promise<void> {
  const staffed = drafts.filter((d) => d.staff_id);
  if (staffed.length === 0) return;
  const exclusions = await loadActiveExclusions(supabase, organizationId);
  if (exclusions.length === 0) return;
  const shiftIds = staffed.map((d) => d.assign_to_shift_id).filter((x): x is string => !!x);
  const shiftClient = new Map<string, string>();
  if (shiftIds.length) {
    const { data, error } = await supabase
      .from("scheduled_shifts")
      .select("id, client_id")
      .eq("organization_id", organizationId)
      .in("id", shiftIds);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ id: string; client_id: string }>) {
      shiftClient.set(r.id, r.client_id);
    }
  }
  for (const d of staffed) {
    const clientId = d.assign_to_shift_id ? shiftClient.get(d.assign_to_shift_id) : d.client_id;
    const hit = clientId ? findExclusion(exclusions, clientId, d.staff_id!) : null;
    if (hit) throw new Error(exclusionRefusal("A drafted team member", "the client", hit.reason));
  }
}

// Accept a batch of nectar/auto-fill drafts — writes through createShift-equivalent.
export const applyDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      drafts: Array<{
        // For Nectar new shifts
        staff_id?: string | null;
        client_id?: string | null;
        service_code?: string | null;
        starts_at?: string | null;
        ends_at?: string | null;
        notes?: string | null;
        // For auto-fill: update existing open shift
        assign_to_shift_id?: string | null;
      }>;
    }) =>
      z
        .object({
          organization_id: z.string().uuid(),
          drafts: z.array(
            z.object({
              staff_id: z.string().uuid().nullable().optional(),
              client_id: z.string().uuid().nullable().optional(),
              service_code: z.string().nullable().optional(),
              starts_at: z.string().nullable().optional(),
              ends_at: z.string().nullable().optional(),
              notes: z.string().nullable().optional(),
              assign_to_shift_id: z.string().uuid().nullable().optional(),
            }),
          ),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { created: 0, assigned: 0 };
    await assertDraftsNotExcluded(supabase, data.organization_id, data.drafts);
    let created = 0;
    let assigned = 0;
    for (const d of data.drafts) {
      if (d.assign_to_shift_id) {
        if (!d.staff_id) continue;
        const { error } = await supabase
          .from("scheduled_shifts")
          .update({ staff_id: d.staff_id, status: "draft" })
          .eq("id", d.assign_to_shift_id)
          .eq("organization_id", data.organization_id);
        if (error) throw error;
        assigned++;
      } else {
        if (!d.client_id || !d.service_code || !d.starts_at || !d.ends_at) continue;
        const code = d.service_code.toUpperCase();
        const insertRow = {
          organization_id: data.organization_id,
          staff_id: d.staff_id ?? null,
          client_id: d.client_id,
          service_code: code,
          job_code: code,
          starts_at: d.starts_at,
          ends_at: d.ends_at,
          status: d.staff_id ? "draft" : "open",
          published: false,
          shift_type: "hourly",
          notes: d.notes ?? null,
          created_by: userId,
          created_from: "nectar",
        };
        const { gateScheduledShiftInsert } = await import("@/lib/scheduling/shift-commit");
        await gateScheduledShiftInsert(supabase, [insertRow as never], {
          mode: "bulk_auto",
          userId,
        });
        const { error } = await supabase.from("scheduled_shifts").insert(insertRow);
        if (error) throw error;
        created++;
      }
    }
    return { created, assigned };
  });
