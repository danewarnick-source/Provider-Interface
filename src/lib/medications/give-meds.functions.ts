// Give meds server functions: load what a staff member needs to give meds,
// log one dose (logMedicationPass) and save a PRN follow-up. Every dose goes
// through log_medication_dose, which locks the medication row, checks the
// client, PRN limits, time taken, training, counts and witness, and saves the
// dose with its pill-count change.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { denverYmd, denverYmdFromInstant, denverWallToIso } from "@/lib/denver-date";
import { passBlockReason } from "./dose-status";
import { GIVE_LOG_COLUMNS, GIVE_MED_COLUMNS, type GiveLog, type GiveMed } from "./give-meds";
import {
  PassInput,
  administratorRole,
  buildDosePayload,
  doseErrorMessage,
  isHandsOn,
  passProblem,
  type PassMed,
} from "./give-meds-pass";
import { canGiveWithTraining } from "./med-training";
import { medTrainingStatus } from "./med-training.server";

type Ctx = {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
};

async function assertCanLog(ctx: Ctx, clientId: string) {
  const { data, error } = await ctx.supabase.rpc("can_log_client_meds", {
    _client_id: clientId,
    _user: ctx.userId,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("You can't chart medications for this client.");
}

const DayInput = z.object({
  clientId: z.string().uuid(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Meds, recent doses, training and admin flag for one client's Give meds. */
export const getGiveMeds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DayInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertCanLog(ctx, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, organization_id, first_name")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found.");
    const day = data.day ?? denverYmd();
    const from = new Date(
      Math.min(Date.parse(denverWallToIso(day, 0, 0)), Date.now() - 48 * 3_600_000),
    ).toISOString();
    const to = new Date(Date.parse(denverWallToIso(day, 23, 59)) + 3_600_000).toISOString();
    const [meds, logs, training, admin] = await Promise.all([
      supabaseAdmin
        .from("client_medications")
        .select(GIVE_MED_COLUMNS)
        .eq("client_id", data.clientId)
        .eq("is_active", true)
        .is("discontinued_at", null)
        .order("medication_name"),
      supabaseAdmin
        .from("emar_logs")
        .select(GIVE_LOG_COLUMNS)
        .eq("client_id", data.clientId)
        .gte("scheduled_for", from)
        .lte("scheduled_for", to)
        .order("scheduled_for", { ascending: false })
        .limit(500),
      medTrainingStatus(ctx.supabase, ctx.userId, client.organization_id, denverYmd()),
      ctx.supabase.rpc("is_org_admin_or_manager", {
        _org: client.organization_id,
        _user: ctx.userId,
      }),
    ]);
    if (meds.error) throw new Error(meds.error.message);
    if (logs.error) throw new Error(logs.error.message);
    return {
      clientFirstName: (client.first_name as string | null) ?? "",
      organizationId: client.organization_id as string,
      day,
      meds: (meds.data ?? []) as unknown as GiveMed[],
      logs: (logs.data ?? []) as unknown as GiveLog[],
      training,
      isAdmin: admin.data === true,
    };
  });

/** Log one dose: given (with the time it was taken) or not given (with why). */
export const logMedicationPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PassInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { supabase, userId } = ctx;
    const { data: med, error: mErr } = await supabase
      .from("client_medications")
      .select(
        "id, client_id, organization_id, is_active, discontinued_at, paused_at, medication_name, scheduled_times, start_date, end_date, how_taken, is_prn, is_controlled, is_rescue",
      )
      .eq("id", data.medicationId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!med) throw new Error("Medication not found.");
    const m = med as unknown as PassMed & {
      client_id: string;
      organization_id: string;
      is_active: boolean;
      discontinued_at: string | null;
      paused_at: string | null;
    };

    // Only this client's own, active, unpaused med, charted by someone who
    // can see the client or is working with them today (shift or host home).
    const blocked = passBlockReason(m, data.clientId);
    if (blocked) throw new Error(blocked);
    await assertCanLog(ctx, data.clientId);

    const problem = passProblem(data, m);
    if (problem) throw new Error(problem);

    const given = data.outcome === "given";
    // how_taken decides who gives it (support_level stays written for main until M6).
    const role = administratorRole(m.how_taken, data.nurseRole);
    if (given) {
      const day = denverYmdFromInstant(data.actualTakenAt) ?? denverYmd();
      const training = await medTrainingStatus(supabase, userId, m.organization_id, day);
      if (!canGiveWithTraining(training)) {
        throw new Error(
          "Your medication training isn't approved or has expired. Ask an admin before giving medications.",
        );
      }
      if (isHandsOn(role)) {
        const { data: allowed, error: gateErr } = await supabase.rpc("med_admin_role_permitted", {
          _client_id: data.clientId,
          _org_id: m.organization_id,
          _user_id: userId,
          _role: role,
        });
        if (gateErr) throw new Error(gateErr.message);
        if (!allowed) throw new Error(await handsOnBlockedReason(ctx, data.clientId, role));
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName = (profile as { full_name?: string } | null)?.full_name || "Staff";

    const payload = buildDosePayload({
      input: data,
      med: m,
      role,
      fullName,
      nowIso: new Date().toISOString(),
    });
    const { data: logId, error } = await supabase.rpc("log_medication_dose", {
      _dose: payload as never,
      _prn_override_reason: data.prnOverrideReason?.trim() || undefined,
    });
    if (error) throw new Error(doseErrorMessage(error.message));

    let countFlagged = false;
    if (m.is_controlled && given) {
      const { data: count } = await supabase
        .from("controlled_med_counts")
        .select("flagged")
        .eq("emar_log_id", logId as string)
        .maybeSingle();
      countFlagged = !!(count as { flagged?: boolean } | null)?.flagged;
    }
    return { id: logId as string, countFlagged };
  });

async function handsOnBlockedReason(ctx: Ctx, clientId: string, role: string): Promise<string> {
  const { data: hasCode } = await ctx.supabase.rpc("client_has_med_admin_code", {
    _client_id: clientId,
  });
  if (!hasCode) {
    return "This client isn't authorized for hands-on medication help (no PM/PN billing code). Staff can only watch the client take their own medication.";
  }
  if (role === "lpn" || role === "rn")
    return `Your ${role.toUpperCase()} license isn't on file or has expired.`;
  if (role === "delegated") return "There's no active nurse delegation on file for you.";
  return "You aren't allowed to give hands-on medication help to this client.";
}

const FollowupInput = z.object({
  logId: z.string().uuid(),
  effect: z.enum(["helped", "partly", "no"]),
  note: z.string().max(2000).nullable().optional(),
  triedFirst: z.string().max(500).nullable().optional(),
  prescriberNotified: z.boolean().nullable().optional(),
});

/** "Did it help?" for a PRN dose. */
export const recordPrnFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FollowupInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as Ctx;
    const { error } = await supabase.rpc("record_prn_followup", {
      _log_id: data.logId,
      _effect: data.effect,
      _note: data.note?.trim() || undefined,
      _tried_first: data.triedFirst?.trim() || undefined,
      _prescriber_notified: data.prescriberNotified ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
