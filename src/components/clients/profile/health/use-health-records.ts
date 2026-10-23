// Health events and absences for one client: read (RLS: Client medical:
// View), add and archive through writeClientRecord (Client medical: Edit).
// Nothing is deleted; a removed row gets archived_at.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { writeClientRecord } from "@/lib/clients/writes.functions";

export type HealthEventRow = {
  id: string;
  event_date: string;
  event_type: string;
  notes: string | null;
  document_id: string | null;
};

export type AbsenceRow = {
  id: string;
  from_date: string;
  to_date: string | null;
  reason: string;
  notes: string | null;
};

type Table = "client_health_events" | "client_absences";

const COLUMNS: Record<Table, string> = {
  client_health_events: "id, event_date, event_type, notes, document_id",
  client_absences: "id, from_date, to_date, reason, notes",
};
const ORDER: Record<Table, string> = { client_health_events: "event_date", client_absences: "from_date" };

export function useHealthRecords<T>(table: Table, orgId: string, clientId: string) {
  const qc = useQueryClient();
  const writeFn = useServerFn(writeClientRecord);
  const queryKey = [table, orgId, clientId];
  const list = useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(table)
        .select(COLUMNS[table])
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .is("archived_at", null)
        .order(ORDER[table], { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });
  const done = (msg: string) => () => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey });
  };
  const add = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      writeFn({ data: { organizationId: orgId, clientId, table, op: "insert", values } }),
    onSuccess: done("Added."),
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      writeFn({
        data: { organizationId: orgId, clientId, table, op: "update", id, values: { archived_at: new Date().toISOString() } },
      }),
    onSuccess: done("Removed."),
    onError: (e: Error) => toast.error(e.message),
  });
  return { list, add, archive };
}

/** The client's documents, for linking a health event to one. */
export function useClientDocumentOptions(orgId: string, clientId: string) {
  return useQuery({
    queryKey: ["client-document-options", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, file_name, document_type")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .is("archived_at", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; file_name: string; document_type: string | null }[];
    },
  });
}
