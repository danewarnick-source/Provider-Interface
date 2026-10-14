// Server-side medication training check for Give meds. Counts only approved
// (review_status = 'accepted'), unexpired medication training on the dose
// date (med_training_status). log_medication_dose runs the same check, so a
// dose can't skip it.
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
