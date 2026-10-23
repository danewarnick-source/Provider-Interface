// Server functions for the staff side of client-specific training: view the
// published training for an assigned client, complete it (typed-name
// attestation), and list each assigned client's training status.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CLIENT_FORM_LABEL, clientFormKindForTitle } from "@/lib/clients/file/form-obligations";
import { isAdminLevel } from "@/lib/access/levels";
import { denverYmd } from "@/lib/denver-date";
import {
  planGoals,
  type AnySupabase,
  getMembership,
  assertClientInOrg,
} from "./training-guards.server";

// ───────────────────────────────────────────────────────────────────────────
// STAFF VIEWER + COMPLETION (Stage 2b)
//
// HARD ACCESS CHECK: underlying clients/client_medications/hrc_reviews RLS is
// org-wide (not assignment-scoped). The server fn MUST verify that the
// requesting user is either an admin/manager OR has an active staff_assignments
// row covering this client (direct or via group-home address — same logic
// as the existing clients_for_staff RPC). NEVER rely on table RLS for scope.
// Content rendered to staff comes ENTIRELY from the published snapshot in
// client_specific_trainings.content — we do NOT re-query hrc_reviews etc.
// staff-side (staff have no read policy on hrc_reviews).
// ───────────────────────────────────────────────────────────────────────────

async function assertStaffMayViewClient(
  supabase: AnySupabase,
  orgId: string,
  userId: string,
  access: { level: string; scope: string },
  clientId: string,
): Promise<void> {
  await assertClientInOrg(supabase, clientId, orgId);
  if (isAdminLevel(access.level)) {
    // Whole-agency admins see every client; scoped admins only theirs.
    if (access.scope === "agency") return;
    const { data: seen, error } = await supabase.rpc("access_can_see_client", { _client: clientId, _user: userId });
    if (error) throw new Error("Access check failed.");
    if (seen === true) return;
  }
  // Direct assignment first (cheap).
  const { data: direct } = await supabase
    .from("staff_assignments")
    .select("id")
    .eq("organization_id", orgId)
    .eq("staff_id", userId)
    .eq("client_id", clientId)
    .limit(1);
  if (direct && direct.length) return;
  // Group-home fallback via the SECURITY DEFINER RPC.
  const { data: scoped, error: rpcErr } = await supabase
    .rpc("clients_for_staff", { _org: orgId, _staff: userId }).is("deleted_at", null);
  if (rpcErr) throw new Error("Access check failed.");
  const list = (scoped as Array<{ id: string }> | null) ?? [];
  if (!list.some((c) => c.id === clientId)) {
    throw new Error("Forbidden: you are not assigned to this client.");
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function contentHashOf(training: { id: string; version: number; content: unknown; attestation_statement: string }): Promise<string> {
  // Stable hash: training id + version + canonical JSON of content + attestation.
  const canonical = JSON.stringify({
    id: training.id,
    version: training.version,
    content: training.content,
    attestation: training.attestation_statement,
  });
  return sha256Hex(canonical);
}

// Lazy upsert of the per-org "Client-Specific Training" system requirement.
// staff_checklist_completion.requirement_id is NOT NULL → we need an anchor
// row. Stage 4 (gate wiring) will key off (origin='system', requirement_key
// = 'client_specific_training'). Insert/select via service-role: staff don't
// have nectar_requirements write privilege, and the row itself is non-PHI
// system metadata.
async function ensureClientTrainingRequirementId(
  admin: AnySupabase,
  orgId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("nectar_requirements")
    .select("id")
    .eq("organization_id", orgId)
    .eq("origin", "system")
    .eq("requirement_key", "client_specific_training")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: inserted, error } = await admin
    .from("nectar_requirements")
    .insert({
      organization_id: orgId,
      origin: "system",
      requirement_key: "client_specific_training",
      title: "Client-Specific Training",
      description: "Per-client competency: staffer affirms they have reviewed the client's published training snapshot.",
      category: "client_specific_training",
      applies_to: "staff",
      verified: true,
      review_status: "confirmed",
      approval_state: "provider_confirmed",
      metadata: { managed: "system" },
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) throw new Error(`Could not provision requirement anchor: ${error?.message ?? "unknown"}`);
  return inserted.id as string;
}

// ── STAFF: get published training for an assigned client ───────────────────
// person_centered remains in the enum for historical read only — no create path.
export const getStaffClientSpecificTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    trainingType: z.enum(["person_specific", "support_strategies", "person_centered"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { training: null, completion: null, hash: null, pinnedToCurrent: false };
    const m = await getMembership(supabase, userId, data.organizationId);
    // HARD scope check — admin/manager bypass; staff must be assigned.
    await assertStaffMayViewClient(supabase, m.organization_id, userId, m.access, data.clientId);

    const trainingType = data.trainingType ?? "person_specific";

    const { data: training, error } = await supabase
      .from("client_specific_trainings")
      .select("id, organization_id, client_id, title, content, review_questions, attestation_statement, status, version, updated_at")
      .eq("client_id", data.clientId)
      .eq("training_type", trainingType)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Staff only see PUBLISHED versions. Admin/manager get null too if not published yet — they can use admin path.
    if (!training || training.status !== "published") {
      return { training: null, completion: null, hash: null, pinnedToCurrent: false };
    }
    if (training.organization_id !== m.organization_id) throw new Error("Forbidden.");

    const hash = await contentHashOf(training as { id: string; version: number; content: unknown; attestation_statement: string });

    // Most recent current completion by this user for this training (pinned to a hash).
    const { data: completion } = await supabase
      .from("training_completions")
      .select("id, completed_at, content_hash, typed_signature, is_current")
      .eq("user_id", userId)
      .eq("topic_kind", "person")
      .eq("ref_id", training.id)
      .eq("is_current", true)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      training: {
        id: training.id,
        client_id: training.client_id,
        title: training.title,
        content: training.content,
        goals: await planGoals(supabase, data.clientId),
        review_questions: training.review_questions,
        attestation_statement: training.attestation_statement,
        version: training.version,
        updated_at: training.updated_at,
      },
      completion: completion ?? null,
      hash,
      // Echo whether the existing completion is pinned to the current hash.
      pinnedToCurrent: completion?.content_hash === hash,
    };
  });

// ── STAFF: complete the competency (typed-name attestation) ───────────────
// person_centered remains in the enum so existing published rows can still
// be completed. This does not create a new person_centered training.
export const completeClientSpecificTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    trainingType: z.enum(["person_specific", "support_strategies", "person_centered"]).optional(),
    typedSignature: z.string().trim().min(3).max(120),
    questionAnswers: z.array(z.object({ question: z.string(), answer: z.string(), tab: z.string() })).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) {
      return { ok: false as const, completionId: null, requirementId: null, contentHash: null };
    }
    const m = await getMembership(supabase, userId, data.organizationId);
    // Re-verify assignment scope at write time.
    await assertStaffMayViewClient(supabase, m.organization_id, userId, m.access, data.clientId);

    const trainingType = data.trainingType ?? "person_specific";

    const { data: training, error } = await supabase
      .from("client_specific_trainings")
      .select("id, organization_id, client_id, title, content, attestation_statement, status, version, review_questions")
      .eq("client_id", data.clientId)
      .eq("training_type", trainingType)
      .maybeSingle();
    if (error || !training) throw new Error("Training not found.");
    if (training.organization_id !== m.organization_id) throw new Error("Forbidden.");
    if (training.status !== "published") throw new Error("This training is not published yet.");

    const hash = await contentHashOf(training as { id: string; version: number; content: unknown; attestation_statement: string });

    const topicCode = trainingType === "support_strategies" ? "support_strategies_training" : "client_specific_training";

    // Frozen snapshot of exactly what the staff member attested to.
    const { data: snapClient } = await supabase
      .from("clients")
      .select("first_name, last_name")
      .eq("id", training.client_id)
      .maybeSingle();
    const clientName =
      `${snapClient?.first_name ?? ""} ${snapClient?.last_name ?? ""}`.trim() || null;
    const sections =
      (training.content as { sections?: Array<{ title?: string }> } | null)?.sections ?? [];
    const reviewQs = ((training as { review_questions?: Array<{ prompt?: string }> | null }).review_questions ?? []);
    const topics =
      trainingType === "person_centered"
        ? reviewQs.map((q) => String(q?.prompt ?? "")).filter(Boolean)
        : sections.map((s) => String(s?.title ?? "")).filter(Boolean);
    const contentSnapshot = {
      client_name: clientName,
      client_id: training.client_id,
      training_type: trainingType,
      title: training.title,
      version: training.version,
      section_titles: topics,
      content: training.content,
      captured_at: new Date().toISOString(),
    };

    // 1) Signed completion (immutable; trigger marks prior versions not-current).
    const { data: tc, error: tcErr } = await supabase
      .from("training_completions")
      .insert({
        user_id: userId,
        topic_kind: "person",
        ref_id: training.id,
        topic_code: topicCode,
        topic_title: training.title,
        attestation_statement: training.attestation_statement,
        typed_signature: data.typedSignature,
        signer_full_name: data.typedSignature,
        consent_statement: training.attestation_statement,
        consent_accepted: true,
        content_version: String(training.version),
        content_hash: hash,
        content_snapshot: contentSnapshot,
        question_answers: data.questionAnswers ?? [],
      })
      .select("id")
      .maybeSingle();
    if (tcErr || !tc) throw new Error(tcErr?.message ?? "Could not record completion.");

    // 2) Per-(staff, client) requirement satisfaction row.
    //    Both nectar_requirements (provisioning) and staff_checklist_completion
    //    writes require admin/manager privilege under RLS — we use the service-
    //    role client because we have already verified server-side that this
    //    user is assignment-scoped to this client and is acting on themselves.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const requirementId = await ensureClientTrainingRequirementId(supabaseAdmin, m.organization_id);
    // Manual upsert against scc_unique_per_client (cannot use onConflict on a partial index).
    const { data: existingScc } = await supabaseAdmin
      .from("staff_checklist_completion")
      .select("id")
      .eq("staff_id", userId)
      .eq("requirement_id", requirementId)
      .eq("client_id", data.clientId)
      .limit(1)
      .maybeSingle();
    const completedDate = denverYmd();
    if (existingScc?.id) {
      const { error: uErr } = await supabaseAdmin
        .from("staff_checklist_completion")
        .update({
          status: "complete",
          completed_date: completedDate,
          completed_by: userId,
          training_completion_id: tc.id,
          auto_checked_at: new Date().toISOString(),
        })
        .eq("id", existingScc.id);
      if (uErr) throw new Error(uErr.message);
    } else {
      const { error: iErr } = await supabaseAdmin
        .from("staff_checklist_completion")
        .insert({
          organization_id: m.organization_id,
          staff_id: userId,
          requirement_id: requirementId,
          client_id: data.clientId,
          status: "complete",
          completed_date: completedDate,
          completed_by: userId,
          training_completion_id: tc.id,
          auto_checked_at: new Date().toISOString(),
        });
      if (iErr) throw new Error(iErr.message);
    }

    await closeMatchingClientFormObligations(
      supabase,
      m.organization_id,
      userId,
      data.clientId,
      trainingType,
      tc.id as string,
    );

    return { ok: true, completionId: tc.id, requirementId, contentHash: hash };
  });

/** Reuse existing obligation instances — do not invent a new assignment path. */
async function closeMatchingClientFormObligations(
  supabase: AnySupabase,
  organizationId: string,
  staffId: string,
  clientId: string,
  trainingType: "person_specific" | "support_strategies" | "person_centered",
  trainingCompletionId: string,
): Promise<void> {
  const { data: obligations, error: oErr } = await supabase
    .from("company_obligations")
    .select("id, title")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (oErr) throw new Error(oErr.message);
  const matchingIds = ((obligations ?? []) as Array<{ id: string; title: string }>)
    .filter((o) => clientFormKindForTitle(o.title) === trainingType)
    .map((o) => o.id);
  if (!matchingIds.length) return;

  const { data: instances, error: iErr } = await supabase
    .from("company_obligation_instances")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("assignee_staff_id", staffId)
    .in("obligation_id", matchingIds)
    .in("status", ["pending", "overdue"]);
  if (iErr) throw new Error(iErr.message);
  const open = (instances ?? []) as Array<{ id: string }>;
  if (!open.length) return;

  const { data: dir } = await supabase
    .from("org_member_directory")
    .select("full_name")
    .eq("id", staffId)
    .maybeSingle();
  const staffName = (dir?.full_name as string | null) ?? "Unknown";
  const nowIso = new Date().toISOString();

  for (const inst of open) {
    const { data: existing } = await supabase
      .from("company_obligation_completions")
      .select("id")
      .eq("instance_id", inst.id)
      .eq("staff_id", staffId)
      .maybeSingle();
    if (!existing) {
      const { error: cErr } = await supabase.from("company_obligation_completions").insert({
        instance_id: inst.id,
        organization_id: organizationId,
        staff_id: staffId,
        staff_name: staffName,
        evidence_type_used: "form",
        form_submission_id: null,
        notes: `client-form:${trainingType}:${trainingCompletionId}`,
        completed_at: nowIso,
      });
      if (cErr && (cErr as { code?: string }).code !== "23505") throw new Error(cErr.message);
    }
    const { error: upErr } = await supabase
      .from("company_obligation_instances")
      .update({
        status: "completed",
        completed_at: nowIso,
        completed_by_id: staffId,
        completed_by_name: staffName,
        evidence_type_used: "form",
      })
      .eq("id", inst.id)
      .in("status", ["pending", "overdue"]);
    if (upErr) throw new Error(upErr.message);
  }
}

// ── STAFF/ADMIN: list assigned clients with per-training completion status ──
// Used by the staff training hub to show "Start" / "Completed" links.
export const getMyClientTrainingStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase | null; userId: string | null };
    if (!supabase || !userId) return { items: [] as Array<{ clientId: string; clientName: string; trainings: Array<{ type: "person_specific" | "support_strategies"; label: string; setupStatus: "not_setup" | "draft" | "published"; completionStatus: "not_started" | "completed"; completedAt: string | null }> }> };
    const m = await getMembership(supabase, userId, data.organizationId);

    let clientIds: string[] = [];
    if (isAdminLevel(m.access_level)) {
      // Admins: show all clients that have at least one training row.
      const { data: rows } = await supabase
        .from("client_specific_trainings")
        .select("client_id")
        .eq("organization_id", m.organization_id);
      clientIds = [...new Set((rows ?? []).map((r: { client_id: string }) => r.client_id))] as string[];
    } else {
      // Staff: direct assignments.
      const { data: assigns } = await supabase
        .from("staff_assignments")
        .select("client_id")
        .eq("organization_id", m.organization_id)
        .eq("staff_id", userId);
      clientIds = [...new Set((assigns ?? []).map((a: { client_id: string }) => a.client_id))] as string[];
      // Group-home fallback via RPC.
      try {
        const { data: rpcClients } = await supabase.rpc("clients_for_staff", { _org: m.organization_id, _staff: userId }).is("deleted_at", null);
        if (Array.isArray(rpcClients)) {
          const rpcIds = (rpcClients as Array<{ id: string }>).map((c) => c.id);
          clientIds = [...new Set([...clientIds, ...rpcIds])];
        }
      } catch { /* ignore */ }
    }

    if (!clientIds.length) return { items: [] as Array<{ clientId: string; clientName: string; trainings: Array<{ type: "person_specific" | "support_strategies"; label: string; setupStatus: "not_setup" | "draft" | "published"; completionStatus: "not_started" | "completed"; completedAt: string | null }> }> };

    const { data: clients } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .is("deleted_at", null)
      .in("id", clientIds);
    const clientMap: Record<string, string> = {};
    for (const c of (clients ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
      clientMap[c.id] = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    }

    const { data: trainings } = await supabase
      .from("client_specific_trainings")
      .select("id, client_id, training_type, status")
      .in("client_id", clientIds);

    const trainingIds = (trainings ?? []).map((t: { id: string }) => t.id);
    const completionMap: Record<string, string> = {};
    if (trainingIds.length) {
      const { data: completions } = await supabase
        .from("training_completions")
        .select("ref_id, completed_at")
        .eq("user_id", userId)
        .eq("topic_kind", "person")
        .eq("is_current", true)
        .in("ref_id", trainingIds);
      for (const c of (completions ?? []) as Array<{ ref_id: string; completed_at: string }>) {
        completionMap[c.ref_id] = c.completed_at;
      }
    }

    type TrainingRow = { id: string; client_id: string; training_type: string; status: string };
    const byClient: Record<string, Record<string, TrainingRow>> = {};
    for (const t of (trainings ?? []) as TrainingRow[]) {
      if (!byClient[t.client_id]) byClient[t.client_id] = {};
      byClient[t.client_id][t.training_type] = t;
    }

    const items = clientIds.map((cid) => {
      const ct = byClient[cid] ?? {};
      return {
        clientId: cid,
        clientName: clientMap[cid] ?? cid,
        trainings: (["person_specific", "support_strategies"] as const).map((type) => {
          const t = ct[type];
          const label = CLIENT_FORM_LABEL[type];
          if (!t) return { type, label, setupStatus: "not_setup" as const, completionStatus: "not_started" as const, completedAt: null as string | null };
          if (t.status !== "published") return { type, label, setupStatus: "draft" as const, completionStatus: "not_started" as const, completedAt: null as string | null };
          const completedAt = completionMap[t.id] ?? null;
          return { type, label, setupStatus: "published" as const, completionStatus: completedAt ? "completed" as const : "not_started" as const, completedAt };
        }),
      };
    });

    return { items };
  });
