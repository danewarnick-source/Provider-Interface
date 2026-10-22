// A witness confirms a controlled-medication count by signing in with their
// own account on the staff member's phone. The password is checked against
// Auth with a throwaway client (the staff member's own session and cookies
// are untouched), the witness must be a different active member of the
// agency, and the server records a one-time confirmation that
// log_medication_dose uses within 15 minutes. The browser never names the
// witness.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GENERIC_PASSWORD_ERROR,
  performPasswordSignInWithClient,
  readPublishableAuthEnv,
  type PublishableAuthClient,
} from "@/lib/login-password-signin";
import { witnessProblem, type WitnessMembership } from "./med-witness";

const WitnessInput = z.object({
  clientId: z.string().uuid(),
  medicationId: z.string().uuid(),
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
  captchaToken: z.string().max(4000).nullable().optional(),
});

function throwawayAuthClient() {
  const env = readPublishableAuthEnv();
  if (!env) throw new Error(GENERIC_PASSWORD_ERROR);
  return createClient(env.url, env.key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const confirmMedWitness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WitnessInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const { data: canLog, error: canErr } = await supabase.rpc("can_log_client_meds", {
      _client_id: data.clientId,
      _user: userId,
    });
    if (canErr) throw new Error(canErr.message);
    if (canLog !== true) throw new Error("You can't chart medications for this client.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: med } = await supabaseAdmin
      .from("client_medications")
      .select("id, client_id, organization_id, is_controlled")
      .eq("id", data.medicationId)
      .maybeSingle();
    if (!med || med.client_id !== data.clientId) throw new Error("Medication not found.");
    if (!med.is_controlled) throw new Error("Only controlled medications need a witness.");

    const authClient = throwawayAuthClient();
    let witnessId: string;
    try {
      const session = await performPasswordSignInWithClient(data.identifier, data.password, {
        createPublishableClient: () => authClient as unknown as PublishableAuthClient,
        lookupUsernameEmailWithServiceRole: async (username) => {
          const { data: p } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .ilike("username", username)
            .maybeSingle();
          return (p as { email?: string | null } | null)?.email ?? null;
        },
        captchaToken: data.captchaToken ?? null,
      });
      witnessId = session.user.id;
    } catch {
      throw new Error(
        "The witness's sign-in didn't work. Check the email or username and password.",
      );
    }
    // End only this sign-in; the witness stays signed in on their own devices.
    await authClient.auth.signOut({ scope: "local" }).catch(() => {});

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, active, deleted_at")
      .eq("organization_id", med.organization_id)
      .eq("user_id", witnessId)
      .maybeSingle();
    const problem = witnessProblem({
      witnessId,
      callerId: userId,
      organizationId: med.organization_id,
      membership: (membership as WitnessMembership | null) ?? null,
    });
    if (problem) throw new Error(problem);

    const { data: row, error } = await supabaseAdmin
      .from("med_witness_confirmations")
      .insert({
        organization_id: med.organization_id,
        client_id: data.clientId,
        medication_id: data.medicationId,
        witness_id: witnessId,
        requested_by: userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't save the witness sign-in.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", witnessId)
      .maybeSingle();
    return {
      confirmationId: row.id as string,
      witnessName: (profile as { full_name?: string | null } | null)?.full_name || "Witness",
    };
  });
