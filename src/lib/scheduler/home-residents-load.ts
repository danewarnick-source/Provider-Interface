// What the group home page reads about its residents (B7), under the
// caller's RLS: their RHS authorizations (Worksheet hours and absence days),
// absences (client_absences), Form 930s (client_documents of type form_930)
// and away times (client_away_times, not archived). Called by
// components/scheduler/home/use-home-residents.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AwayTime } from "@/lib/clients/away-times";
import { FORM_930, type AbsenceRow, type Form930Doc, type RhsCodeRow } from "./residential-facts";

type Db = SupabaseClient<Database>;

export type HomeResidents = {
  codes: RhsCodeRow[];
  absences: AbsenceRow[];
  form930: Form930Doc[];
  away: AwayTime[];
};

function must<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

export async function loadHomeResidents(
  supabase: Db,
  orgId: string,
  ids: string[],
): Promise<HomeResidents> {
  if (!ids.length) return { codes: [], absences: [], form930: [], away: [] };
  const [codes, absences, form930, away] = await Promise.all([
    supabase
      .from("client_billing_codes")
      .select(
        "client_id, service_code, service_start_date, service_end_date, worksheet_weekly_hours, worksheet_absence_days",
      )
      .eq("organization_id", orgId)
      .in("client_id", ids),
    supabase
      .from("client_absences")
      .select("client_id, from_date, to_date")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .in("client_id", ids),
    supabase
      .from("client_documents")
      .select("client_id, effective_from, effective_to")
      .eq("organization_id", orgId)
      .eq("document_type", FORM_930)
      .is("archived_at", null)
      .in("client_id", ids),
    supabase
      .from("client_away_times")
      .select("id, client_id, weekday_mask, start_time, end_time, label, note")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .in("client_id", ids)
      .order("start_time"),
  ]);
  return {
    codes: must(codes),
    absences: must(absences),
    form930: must(form930),
    away: must(away),
  };
}
