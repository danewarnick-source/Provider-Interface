// Caseload tab on the team member profile — one read that loads everything
// the tab draws. Writes are NOT here: the tab saves each changed client
// through setStaffClientCodes (src/lib/scheduler/setup.functions.ts), the same
// function the client profile uses. Removing a client there also waives that
// client's open staff_per_client items (waiveRemovedClientItemsInternal).
//
// Checks first (staff_roster View + the viewer's scope), then reads.
// Never embeds organization_members <-> profiles (no FK). Never reads `role`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { hasCategory } from "@/lib/access/can";
import { isAdminLevel } from "@/lib/access/levels";
import { assignmentCodes } from "@/lib/assignment-codes";
import { loadActiveCodesAsService } from "@/lib/clients/codes";
import { denverYmd } from "@/lib/denver-date";
import { parseIsoDate, resolveHireDate } from "@/lib/evidence/due";
import type { EvidenceFileRow } from "@/lib/evidence/types";
import { unmetStaffMandatesInternal, type UnmetStaffMandate } from "@/lib/forms.functions";
import type { BadgeEvidenceItem } from "@/lib/team-members/badges";
import { REMOVED_FROM_CASELOAD_REASON } from "@/lib/team-members/caseload";
import type { EvidencePosition } from "@/lib/team-members/evidence-answers";
import { staffClientReadiness, type Readiness } from "@/lib/team-members/readiness";
import { displayNameOf, selectIn } from "@/lib/team-members/roster.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export type CaseloadClient = {
  clientId: string;
  name: string;
  /** The client's active codes (client_billing_codes) — what the chips may toggle. */
  authorizedCodes: string[];
  hasAbi: boolean;
  /** Behavior-support caseload tracking was removed; always false for now. */
  behaviorSupport: boolean;
  /** Published client_specific_trainings ids for this client. */
  personTrainingIds: string[];
};

export type AssignedCaseloadClient = CaseloadClient & {
  /** Explicit staff_assignments.service_codes. */
  codes: string[];
  readiness: Readiness;
};

export type MemberCaseloadData = {
  assigned: AssignedCaseloadClient[];
  /** Active clients the viewer can see that aren't assigned yet. */
  addable: CaseloadClient[];
  unmetMandates: UnmetStaffMandate[];
  /** What the tab needs to score readiness for clients added in the draft. */
  readinessInputs: {
    today: string;
    hireDate: string | null;
    evidence: { items: BadgeEvidenceItem[]; files: EvidenceFileRow[] };
    completedTrainingIds: string[];
  };
  /** Evidence questionnaire facts for "New evidence suggestions". */
  person: {
    userId: string;
    transportsClients: boolean;
    positions: EvidencePosition[];
  };
  existingEvidenceKeys: string[];
  names: Record<string, string>;
  canEdit: boolean;
  canReviewEvidence: boolean;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  has_abi: boolean | null;
  account_status: string | null;
  discharge_date: string | null;
};

const CLIENT_SELECT =
  "id, first_name, last_name, has_abi, account_status, discharge_date";

function clientName(c: ClientRow): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Client";
}

function isActiveClient(c: ClientRow, today: string): boolean {
  if ((c.account_status ?? "active") === "archived") return false;
  const out = parseIsoDate(c.discharge_date);
  return !out || out > today;
}

/**
 * Mark a removed client's open staff_per_client items (the older obligation
 * system) as waived. Never deletes. Best-effort: the caller has already saved
 * the caseload change.
 */
export async function waiveRemovedClientItemsInternal(
  supabase: Sb,
  args: { organizationId: string; staffId: string; clientId: string },
): Promise<number> {
  const { data: obs, error: obErr } = await supabase
    .from("company_obligations")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("scope", "staff_per_client");
  if (obErr) throw new Error(obErr.message);
  const ids = ((obs ?? []) as Array<{ id: string }>).map((o) => o.id);
  if (!ids.length) return 0;
  const { data, error } = await supabase
    .from("company_obligation_instances")
    .update({ status: "waived", waive_reason: REMOVED_FROM_CASELOAD_REASON })
    .eq("organization_id", args.organizationId)
    .eq("assignee_staff_id", args.staffId)
    .eq("client_id", args.clientId)
    .in("obligation_id", ids)
    .in("status", ["pending", "overdue"])
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export const getMemberCaseload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), staffId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MemberCaseloadData | null> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const access = await requireCategory(supabase as Sb, userId, orgId, "staff_roster", "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;

    const { data: member, error: memErr } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", data.staffId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!member) return null;
    if (access.scope !== "agency" && data.staffId !== userId) {
      const { data: visible, error } = await admin.rpc("access_can_see_staff", {
        _org: orgId,
        _staff: data.staffId,
        _viewer: userId,
      });
      if (error) throw new Error(error.message);
      if (visible !== true) return null;
    }

    const today = denverYmd();
    const [prof, staffTypes, assigns, visibleClients, items] = await Promise.all([
      admin
        .from("profiles")
        .select("id, hire_date, start_date, transports_clients, staff_type_keys")
        .eq("id", data.staffId)
        .maybeSingle(),
      admin.from("staff_types").select("key, label").eq("organization_id", orgId),
      admin
        .from("staff_assignments")
        .select("client_id, service_codes")
        .eq("organization_id", orgId)
        .eq("staff_id", data.staffId),
      // The viewer's own client (RLS can_access_client_phi) → only clients they can see.
      (supabase as Sb).from("clients").select(CLIENT_SELECT).is("deleted_at", null).eq("organization_id", orgId),
      admin
        .from("evidence_items")
        .select("*")
        .eq("organization_id", orgId)
        .eq("subject_type", "staff")
        .eq("subject_id", data.staffId),
    ]);
    for (const r of [prof, staffTypes, assigns, visibleClients, items]) {
      if (r.error) throw new Error(r.error.message);
    }

    const assignRows = (assigns.data ?? []) as Array<{
      client_id: string;
      service_codes: string[] | null;
    }>;
    const visible = new Map(
      ((visibleClients.data ?? []) as ClientRow[]).map((c) => [c.id, c] as const),
    );
    // Assigned clients the viewer's RLS hides still belong to the caseload.
    const hiddenIds = assignRows.map((a) => a.client_id).filter((id) => !visible.has(id));
    const hidden = await selectIn<ClientRow>(
      (ids) =>
        admin.from("clients").select(CLIENT_SELECT).is("deleted_at", null).eq("organization_id", orgId).in("id", ids),
      hiddenIds,
    );
    const allClients = new Map(visible);
    for (const c of hidden) allClients.set(c.id, c);
    const clientIds = [...allClients.keys()];
    const activeCodes = await loadActiveCodesAsService(admin, clientIds);

    const evidenceItems = (items.data ?? []) as BadgeEvidenceItem[];
    const [files, trainings, completions] = await Promise.all([
      selectIn<EvidenceFileRow>(
        (ids) =>
          admin.from("evidence_files").select("*").eq("organization_id", orgId).in("item_id", ids),
        evidenceItems.map((i) => i.id),
      ),
      selectIn<{ id: string; client_id: string }>(
        (ids) =>
          admin
            .from("client_specific_trainings")
            .select("id, client_id")
            .eq("organization_id", orgId)
            .eq("status", "published")
            .in("client_id", ids),
        clientIds,
      ),
      admin
        .from("training_completions")
        .select("ref_id")
        .eq("user_id", data.staffId)
        .eq("topic_kind", "person")
        .eq("is_current", true),
    ]);
    if (completions.error) throw new Error(completions.error.message);
    const completedTrainingIds = [
      ...new Set(
        ((completions.data ?? []) as Array<{ ref_id: string | null }>)
          .map((c) => c.ref_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const trainingsByClient = new Map<string, string[]>();
    for (const t of trainings) {
      trainingsByClient.set(t.client_id, [...(trainingsByClient.get(t.client_id) ?? []), t.id]);
    }

    const skippers = evidenceItems.map((i) => i.opted_out_by).filter((id): id is string => !!id);
    const nameRows = await selectIn<{
      id: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>(
      (ids) =>
        admin.from("profiles").select("id, full_name, first_name, last_name, email").in("id", ids),
      [...new Set(skippers)],
    );
    const names: Record<string, string> = {};
    for (const r of nameRows) names[r.id] = displayNameOf(r as never).display;

    const p = (prof.data ?? {}) as {
      hire_date?: string | null;
      start_date?: string | null;
      transports_clients?: boolean | null;
      staff_type_keys?: string[] | null;
    };
    const hireDate = parseIsoDate(resolveHireDate(p.hire_date ?? null, p.start_date ?? null));
    const toClient = (c: ClientRow): CaseloadClient => ({
      clientId: c.id,
      name: clientName(c),
      authorizedCodes: activeCodes.get(c.id) ?? [],
      hasAbi: c.has_abi === true,
      // Behavior-support tracking was removed from the app (see
      // docs/SQL_HANDOFF_behavior_removal.sql); the rule stays in readiness.ts.
      behaviorSupport: false,
      personTrainingIds: trainingsByClient.get(c.id) ?? [],
    });
    const readinessInputs = {
      today,
      hireDate,
      evidence: { items: evidenceItems, files },
      completedTrainingIds,
    };

    const assignedIds = new Set<string>();
    const assigned: AssignedCaseloadClient[] = [];
    for (const a of assignRows) {
      const c = allClients.get(a.client_id);
      if (!c) continue;
      assignedIds.add(c.id);
      const base = toClient(c);
      assigned.push({
        ...base,
        codes: assignmentCodes(a.service_codes),
        readiness: staffClientReadiness({
          today,
          hireDate,
          evidence: readinessInputs.evidence,
          client: { hasAbi: base.hasAbi, behaviorSupport: base.behaviorSupport },
          personTraining: {
            requiredIds: base.personTrainingIds,
            completedIds: completedTrainingIds,
          },
          nameOf: (id) => names[id] ?? null,
        }),
      });
    }
    assigned.sort((a, b) => a.name.localeCompare(b.name));

    const addable = [...visible.values()]
      .filter((c) => !assignedIds.has(c.id) && isActiveClient(c, today))
      .map(toClient)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Same gate getUnmetStaffMandates uses (admin-level viewer). Best-effort.
    let unmetMandates: UnmetStaffMandate[] = [];
    if (isAdminLevel(access.level)) {
      try {
        unmetMandates = await unmetStaffMandatesInternal(supabase, orgId, {
          staffId: data.staffId,
        });
      } catch (e) {
        console.warn("[caseload] unmet mandate check failed", e);
      }
    }

    const labelByKey = new Map(
      ((staffTypes.data ?? []) as Array<{ key: string; label: string | null }>).map((s) => [
        s.key,
        String(s.label ?? "").trim() || s.key,
      ]),
    );

    return {
      assigned,
      addable,
      unmetMandates,
      readinessInputs,
      person: {
        userId: data.staffId,
        transportsClients: p.transports_clients === true,
        positions: (p.staff_type_keys ?? []).map((key) => ({
          key,
          label: labelByKey.get(key) ?? key,
        })),
      },
      existingEvidenceKeys: [...new Set(evidenceItems.map((i) => i.requirement_key))],
      names,
      canEdit: hasCategory(access.categories, "staff_roster", "edit"),
      canReviewEvidence: hasCategory(access.categories, "staff_hiring", "edit"),
    };
  });
