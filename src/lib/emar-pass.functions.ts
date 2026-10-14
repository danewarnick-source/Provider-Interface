import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requiredAttestation,
  isHandsOnRole,
  type AdministratorRole,
} from "@/lib/med-attestation";
import { CHARTED_STATUSES, passBlockReason, storedStatus } from "@/lib/medications/dose-status";
import { correctionAccess } from "@/lib/medications/mar-review";
import { assertCanManageClient } from "@/lib/clients/guards.server";

// 'given' = hands-on administration; distinct from 'self_administered'
// (self-directed) so a hands-on pass never inherits the self-directed
// attestation language.
const StatusEnum = z.enum(["self_administered", "given", "refused", "omitted", "missed", "loa"]);
const AdministratorRoleEnum = z.enum([
  "self",
  "staff_observed",
  "staff_administered",
  "lpn",
  "rn",
  "delegated",
]);

const PassInput = z.object({
  clientId: z.string().uuid(),
  medicationId: z.string().uuid(),
  scheduledFor: z.string(), // ISO
  scheduledTimeLabel: z.string().optional().nullable(),
  status: StatusEnum,
  // Who administered — drives the compliance gate (see med_admin_role_permitted).
  // Defaults to 'self' to preserve the legacy self-directed pass path.
  administratorRole: AdministratorRoleEnum.default("self"),
  // Optional link to the credential row that authorizes lpn/rn/delegated.
  credentialId: z.string().uuid().optional().nullable(),
  route: z.string().min(1).max(80),
  actualTakenAt: z.string(), // ISO — when the Person actually took it
  exceptionReason: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  signatureDataUrl: z.string().min(10),
  // PRN / rescue
  prnReason: z.string().max(500).optional().nullable(),
  seizureDurationSeconds: z.number().int().nonnegative().optional().nullable(),
  seizureOutcome: z.string().max(500).optional().nullable(),
  emergencyServicesCalled: z.boolean().optional().nullable(),
  // Controlled
  controlledCountedValue: z.number().int().optional().nullable(),
  controlledExpected: z.number().int().optional().nullable(),
  // Medication error reporting
  isMedicationError: z.boolean().default(false),
  errorDescription: z.string().max(2000).optional().nullable(),
  // Service context resolved on the client (HHS, DSI, etc.)
  serviceContext: z.string().max(40).optional().nullable(),
  // Controlled-substance second-witness identity (profile UUID)
  secondWitnessId: z.string().uuid().optional().nullable(),
  // Offline retry safety: the same id never creates a second dose row.
  clientRequestId: z.string().uuid().optional().nullable(),
  // PRN: given past the minimum interval or daily maximum, with a reason.
  prnOverrideReason: z.string().max(500).optional().nullable(),
  prnTriedFirst: z.string().max(500).optional().nullable(),
  prescriberNotified: z.boolean().optional().nullable(),
});

export const logMedicationPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PassInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { id: "" };

    // Resolve org from client
    const { data: client, error: cErr } = await supabase
      .from("clients")
      .select("id, organization_id, first_name, last_name")
      .eq("id", data.clientId)
      .single();
    if (cErr || !client) throw new Error("Client not found.");
    const orgId = (client as { organization_id: string }).organization_id;

    // Med-assist training gate
    const { data: trained } = await supabase.rpc("is_med_assist_current", {
      _user: userId,
      _org: orgId,
    });
    if (trained === false) {
      throw new Error(
        "Your medication-assistance training is not current. Per DHHS Scope of Work you cannot confirm a medication pass until training is renewed.",
      );
    }

    // Load med to verify required fields by type
    const { data: med, error: mErr } = await supabase
      .from("client_medications")
      .select(
        "id, client_id, is_active, discontinued_at, paused_at, medication_name, is_prn, is_controlled, is_rescue, pill_count_current, refill_threshold, refill_status",
      )
      .eq("id", data.medicationId)
      .single();
    if (mErr || !med) throw new Error("Medication not found.");
    type MedRow = {
      id: string;
      client_id: string;
      is_active: boolean;
      discontinued_at: string | null;
      paused_at: string | null;
      medication_name: string;
      is_prn: boolean;
      is_controlled: boolean;
      is_rescue: boolean;
      pill_count_current: number | null;
      refill_threshold: number | null;
      refill_status: string | null;
    };
    const m = med as MedRow;

    // Only this client's own, active, unpaused med, charted by someone who
    // can see the client or is working with them today (shift or host home).
    const blocked = passBlockReason(m, data.clientId);
    if (blocked) throw new Error(blocked);
    const { data: canLog, error: canLogErr } = await supabase.rpc("can_log_client_meds", {
      _client_id: data.clientId,
      _user: userId,
    });
    if (canLogErr) throw new Error(canLogErr.message);
    if (canLog !== true) throw new Error("You can't chart medications for this client.");

    // ── COMPLIANCE GATE ──────────────────────────────────────────────────
    // Hands-on administration paths (staff_administered / lpn / rn /
    // delegated OR status='given') REQUIRE an active PM/PN billing code on
    // the client AND, for licensed paths, an active credential on the
    // recording user. Enforced server-side because this is a liability
    // boundary — hiding the UI is not enough. See migration
    // med_admin_role_permitted() for the canonical rule; the mapping should
    // later be sourced from the SOW authoritative-sources engine so
    // amendments propagate without a code change.
    const role = data.administratorRole as AdministratorRole;
    const handsOn = isHandsOnRole(role) || data.status === "given";

    if (handsOn) {
      const { data: allowed, error: gateErr } = await supabase.rpc(
        "med_admin_role_permitted",
        { _client_id: data.clientId, _org_id: orgId, _user_id: userId, _role: role },
      );
      if (gateErr) throw new Error(gateErr.message);
      if (!allowed) {
        // Explain the specific reason the gate blocked the pass.
        const { data: hasCode } = await supabase.rpc("client_has_med_admin_code", {
          _client_id: data.clientId,
        });
        if (!hasCode) {
          throw new Error(
            "This client is not authorized for hands-on medication administration — no PM/PN billing code on file. Staff may observe and document self-administration only.",
          );
        }
        if (role === "lpn" || role === "rn") {
          throw new Error(
            `Hands-on ${role.toUpperCase()} administration blocked: your ${role.toUpperCase()} credential is not on file or has expired.`,
          );
        }
        if (role === "delegated") {
          throw new Error(
            "Delegated administration blocked: no active nurse-delegation record on file for this staff member. Delegation records are added in the delegation module.",
          );
        }
        throw new Error(
          "Hands-on medication administration is not permitted for this staff member on this client.",
        );
      }
    }

    if (m.is_prn && (data.status === "self_administered" || data.status === "given") && !data.prnReason?.trim()) {
      throw new Error("PRN reason is required.");
    }
    if (m.is_rescue && (data.status === "self_administered" || data.status === "given")) {
      if (data.seizureDurationSeconds == null || !data.seizureOutcome?.trim()) {
        throw new Error("Rescue medication requires seizure duration and outcome.");
      }
    }
    if (m.is_controlled && (data.status === "self_administered" || data.status === "given")) {
      if (data.controlledCountedValue == null) {
        throw new Error("Controlled-substance count is required.");
      }
    }
    if (data.isMedicationError && !data.errorDescription?.trim()) {
      throw new Error("Medication error requires a description.");
    }

    // Exception statuses require a non-empty note.
    const isExceptionStatus = data.status === "refused" || data.status === "omitted" || data.status === "missed" || data.status === "loa";
    if (isExceptionStatus && !data.exceptionReason?.trim()) {
      throw new Error("A note is required when the status is Refused, Omitted, Missed, or LOA.");
    }

    // ── ATTESTATION FRAMEWORK ────────────────────────────────────────────
    // Scale required attestation by admin model + med risk-class. Witness-
    // level attestations require a second_witness_id.
    const attnLevel = requiredAttestation(role, m);
    if (attnLevel === "witness" && !data.secondWitnessId) {
      throw new Error(
        "This administration requires a second witness signature (controlled substance, hands-on administration).",
      );
    }

    // Profile display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName =
      (profile as { full_name?: string } | null)?.full_name ||
      (context.claims?.email as string | undefined) ||
      "Staff";

    const attestation =
      data.status === "given" || isHandsOnRole(role)
        ? `I confirm I personally administered this medication to this Person as ${role.toUpperCase()}, that I verified the Person, medication, dose, route, and time (Five Rights), and that this record is accurate and complete.`
        : role === "staff_observed"
          ? "I observed this Person self-administer their own prescribed medication and confirm this record is accurate."
          : "I confirm I observed or assisted this Person in self-administering their own prescribed medication, that I verified it matches the prescription's medication, dose, route, and time, and that this record is accurate and complete.";

    const recordedIn =
      data.serviceContext && /HH/i.test(data.serviceContext)
        ? "hhs"
        : data.serviceContext && /^DS/i.test(data.serviceContext)
          ? "dsi"
          : "general";

    // Dedupe guard: doses are stored as 'administered' (plus older spellings),
    // so any charted status for this dose blocks a second one. A retry of the
    // same request (clientRequestId) is not a duplicate: log_medication_dose
    // returns the first row.
    const clientRequestId = data.clientRequestId ?? crypto.randomUUID();
    const { data: existingLogs } = await supabase
      .from("emar_logs")
      .select("id, client_request_id")
      .eq("medication_id", data.medicationId)
      .eq("scheduled_for", data.scheduledFor)
      .in("status", [...CHARTED_STATUSES])
      .limit(1);
    const existingLog = (existingLogs ?? [])[0] as { id: string; client_request_id: string } | undefined;
    if (existingLog?.client_request_id === clientRequestId) return { id: existingLog.id };
    if (existingLog) throw new Error("This dose has already been documented.");

    // Treat 'self_administered' and 'given' as terminal-taken statuses.
    const wasTaken = data.status === "self_administered" || data.status === "given";
    const insertPayload = {
      client_id: data.clientId,
      medication_id: data.medicationId,
      scheduled_for: data.scheduledFor,
      scheduled_time_label: data.scheduledTimeLabel ?? null,
      administered_at: wasTaken ? data.actualTakenAt : null,
      actual_taken_at: wasTaken ? data.actualTakenAt : null,
      // Stored as administered | refused | omitted | missed.
      status: storedStatus(data.status),
      administrator_role: role,
      credential_id: data.credentialId ?? null,
      route: data.route,
      exception_reason: wasTaken ? null : (data.exceptionReason ?? null),
      notes: data.notes ?? null,
      staff_name: fullName,
      signature_attestation: `${fullName} @ ${new Date().toISOString()} — [${attnLevel}] ${attestation}`,
      signature_data_url: data.signatureDataUrl,
      attestation_signed: true,
      is_prn: m.is_prn,
      prn_reason: m.is_prn ? (data.prnReason ?? null) : null,
      is_controlled: m.is_controlled,
      pill_count_verified: m.is_controlled ? true : null,
      pill_count_value: m.is_controlled ? (data.controlledCountedValue ?? null) : null,
      is_medication_error: data.isMedicationError,
      error_description: data.errorDescription ?? null,
      seizure_duration_seconds: data.seizureDurationSeconds ?? null,
      seizure_outcome: data.seizureOutcome ?? null,
      emergency_services_called: data.emergencyServicesCalled ?? null,
      service_context: data.serviceContext ?? null,
      recorded_in: recordedIn,
      second_witness_id: data.secondWitnessId ?? null,
      prn_tried_first: m.is_prn ? (data.prnTriedFirst ?? null) : null,
      prescriber_notified: data.prescriberNotified ?? null,
      client_request_id: clientRequestId,
    };

    // One SQL function charts the dose: it locks the medication row so PRN
    // interval/daily-max checks can't race, re-checks the client, and sets
    // staff_id to the caller.
    const { data: inserted, error: insErr } = await supabase.rpc("log_medication_dose", {
      _dose: insertPayload,
      _prn_override_reason: data.prnOverrideReason ?? undefined,
    });
    if (insErr) {
      if (insErr.message.startsWith("PRN_LIMIT")) {
        throw new Error(
          "This as-needed medication was given too recently or has reached its daily maximum. Add a reason to give it anyway.",
        );
      }
      throw new Error(insErr.message);
    }
    const logId = inserted as string;

    // Controlled count log row
    if (m.is_controlled && data.controlledCountedValue != null) {
      const variance =
        data.controlledExpected != null
          ? data.controlledCountedValue - data.controlledExpected
          : 0;
      await supabase.from("controlled_med_counts").insert({
        organization_id: orgId,
        client_id: data.clientId,
        medication_id: data.medicationId,
        emar_log_id: logId,
        context: "pass",
        expected_count: data.controlledExpected ?? null,
        counted_value: data.controlledCountedValue,
        flagged: variance !== 0,
        staff_id: userId,
        staff_name: fullName,
        signature_data_url: data.signatureDataUrl,
      } as never);
    }

    // Inventory decrement on any confirmed dose (self-directed or hands-on).
    if (wasTaken && typeof m.pill_count_current === "number") {
      const next = Math.max(0, m.pill_count_current - 1);
      const refillStatus =
        next <= (m.refill_threshold ?? 7) && m.refill_status === "ok" ? "pending" : m.refill_status;
      await supabase
        .from("client_medications")
        .update({
          pill_count_current: next,
          pill_count_updated_at: new Date().toISOString(),
          refill_status: refillStatus,
        } as never)
        .eq("id", data.medicationId);
    }

    // Medication-error: notify admins + draft incident
    if (data.isMedicationError) {
      await supabase.rpc("notify_medication_error", {
        p_organization_id: orgId,
        p_emar_log_id: logId,
        p_client_name: `${(client as { first_name: string }).first_name} ${(client as { last_name: string }).last_name}`,
        p_med_name: m.medication_name,
        p_reporter_name: fullName,
        p_description: data.errorDescription ?? "",
      });
      // Draft incident (best-effort)
      await supabase
        .from("submitted_forms" as never)
        .insert({
          organization_id: orgId,
          user_id: userId,
          client_id: data.clientId,
          form_type: "incident_report",
          title: `Medication error — ${m.medication_name}`,
          narrative: data.errorDescription,
          payload: {
            severity: "high",
            kind: "medication_error",
            emar_log_id: logId,
            medication_id: data.medicationId,
          },
          occurred_at: data.actualTakenAt,
        } as never);
    }

    return { id: logId };
  });

const AddendumInput = z.object({
  logId: z.string().uuid(),
  note: z.string().trim().min(3).max(2000),
  reason: z.string().trim().min(3).max(500),
});

// A correction to a logged dose. The original stays as it was; corrections
// are insert-only. Allowed for someone with client_medical:edit, or for the
// person who logged the dose within 24 hours of logging it. The insert runs
// as the caller, so the database rule checks the same thing.
export const addEmarAddendum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddendumInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log, error } = await supabaseAdmin
      .from("emar_logs")
      .select("id, organization_id, client_id, staff_id, created_at")
      .eq("id", data.logId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!log) throw new Error("Dose not found.");
    let canEditMedical = true;
    try {
      await assertCanManageClient({
        supabase,
        actorId: userId,
        organizationId: log.organization_id,
        clientId: log.client_id,
        action: "edit_medical",
      });
    } catch (e) {
      canEditMedical = false;
      if (!correctionAccess({ log, userId, canEditMedical })) throw e;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName = (profile as { full_name?: string } | null)?.full_name || "Staff";
    const { error: insErr } = await supabase.from("emar_log_addenda").insert({
      emar_log_id: data.logId,
      organization_id: log.organization_id,
      note: data.note,
      reason: data.reason,
      staff_id: userId,
      staff_name: fullName,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });
