// Office notes: notes about the client for the office only (Clients: Edit to
// read or write; staff never see them). Archived, never deleted.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StickyNote } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { formatDate } from "@/lib/clients/dates";
import { openNotes, type ClientNote } from "@/lib/clients/notes";
import { archiveClientNote } from "@/lib/clients/team.functions";
import { OfficeNoteComposer, officeNotesKey } from "./office-note-composer";

export function OfficeNotesCard({ clientId, orgId }: { clientId: string; orgId: string }) {
  const qc = useQueryClient();
  const archiveFn = useServerFn(archiveClientNote);
  const key = officeNotesKey(orgId, clientId);

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ClientNote[]> => {
      const { data, error } = await supabase
        .from("client_notes")
        .select("id, body, created_at, created_by, archived_at")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ClientNote[];
    },
  });
  const notes = openNotes(q.data ?? []);
  const names = useProfileNames(
    notes.map((n) => n.created_by).filter((x): x is string => !!x),
  ).data;

  const archiveM = useMutation({
    mutationFn: (noteId: string) =>
      archiveFn({ data: { organizationId: orgId, clientId, noteId } }),
    onSuccess: () => {
      toast.success("Note archived");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      icon={StickyNote}
      tone="neutral"
      title="Office notes"
      description="Notes for the office. Only people who can edit clients see these."
      testId="client-office-notes"
    >
      <div className="space-y-3">
        <OfficeNoteComposer orgId={orgId} clientId={clientId} />
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <EmptyState>No office notes yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border p-3">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {formatDate(n.created_at)}
                    {n.created_by ? ` · ${names?.get(n.created_by) ?? "Team member"}` : ""}
                  </span>
                  <RowMenu
                    label="More actions for this note"
                    items={[
                      {
                        label: "Archive note",
                        danger: true,
                        disabled: archiveM.isPending,
                        onSelect: () => archiveM.mutate(n.id),
                      },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
