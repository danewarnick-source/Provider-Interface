// Server-side medication training status for Give meds' notice. Counts only
// approved (review_status = 'accepted'), unexpired medication training on the
// day (med_training_status). It never blocks a dose: log_medication_dose runs
// the same check and marks the dose and notifies admins, so a dose can't skip it.
// S4-REPOINT: use qualificationsOnDate
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { asTrainingStatus, type MedTrainingStatus } from "./med-training";

/** The signed-in user's medication training status on a Denver day (YYYY-MM-DD). */
export async function medTrainingStatus(
  sb: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
  day: string,
): Promise<MedTrainingStatus> {
  const { data, error } = await sb.rpc("med_training_status", {
    _user: userId,
    _org: organizationId,
    _on: day,
  });
  if (error) throw new Error(error.message);
  return asTrainingStatus(data);
}
