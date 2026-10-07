// The rows behind the Activity timeline: shifts (EVV timesheets), daily
// logs, incidents (only with Incidents: View) and office notes (only with
// Clients: Edit; staff never load them). Each query keeps the full rows so
// the side panel can show the whole record.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { incidentInvolvesClientOr } from "@/lib/incident-visibility";
import type { ActivityViewer, IncidentSource, LogSource, NoteSource, ShiftSource } from "@/lib/clients/activity";
import { officeNotesKey } from "./office-note-composer";

export type ShiftRow = ShiftSource & {
  status: string | null;
  clock_out_timestamp: string | null;
  billed_units: number | null;
  review_status: string | null;
};
export type LogRow = LogSource & {
  status: string | null;
  submitted_at: string | null;
  submitted_late: boolean | null;
  denial_reason: string | null;
};
export type IncidentRow = IncidentSource & {
  status: string | null;
  is_abuse_neglect: boolean | null;
  is_fatality: boolean | null;
  report_number: string | null;
};
export type NoteRow = NoteSource & { archived_at: string | null };

async function rows<T>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useClientActivity(orgId: string, clientId: string, viewer: ActivityViewer) {
  const shifts = useQuery({
    queryKey: ["client-profile-shifts", orgId, clientId],
    queryFn: () =>
      rows<ShiftRow>(
        supabase
          .from("evv_timesheets")
          .select(
            "id, service_type_code, status, clock_in_timestamp, clock_out_timestamp, staff_id, billed_units, shift_note_text, review_status",
          )
          .eq("organization_id", orgId)
          .eq("client_id", clientId)
          .order("clock_in_timestamp", { ascending: false })
          .limit(200),
      ),
  });
  const logs = useQuery({
    queryKey: ["client-profile-logs", orgId, clientId],
    queryFn: () =>
      rows<LogRow>(
        supabase
          .from("daily_logs")
          .select("id, log_date, status, narrative, submitted_at, user_id, submitted_late, denial_reason")
          .eq("organization_id", orgId)
          .eq("client_id", clientId)
          .order("log_date", { ascending: false })
          .limit(100),
      ),
  });
  const incidents = useQuery({
    enabled: viewer.canSeeIncidents,
    queryKey: ["client-profile-incidents", orgId, clientId],
    queryFn: () =>
      rows<IncidentRow>(
        supabase
          .from("incident_reports")
          .select(
            "id, incident_date, incident_types, status, is_abuse_neglect, is_fatality, report_number, reported_by, description",
          )
          .eq("organization_id", orgId)
          .or(incidentInvolvesClientOr(clientId))
          .order("incident_date", { ascending: false })
          .limit(100),
      ),
  });
  const notes = useQuery({
    enabled: viewer.canSeeOfficeNotes,
    queryKey: officeNotesKey(orgId, clientId),
    queryFn: () =>
      rows<NoteRow>(
        supabase
          .from("client_notes")
          .select("id, body, created_at, created_by, archived_at")
          .eq("organization_id", orgId)
          .eq("client_id", clientId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(200),
      ),
  });
  return {
    shifts: shifts.data ?? [],
    logs: logs.data ?? [],
    incidents: viewer.canSeeIncidents ? (incidents.data ?? []) : [],
    notes: viewer.canSeeOfficeNotes ? (notes.data ?? []) : [],
    loading: shifts.isLoading || logs.isLoading,
    failed: shifts.isError || logs.isError,
  };
}
