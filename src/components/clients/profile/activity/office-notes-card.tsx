// Office notes: notes about the client for the office only (Clients: Edit to
// read or write; staff never see them). Archived, never deleted.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { CLIENT_NOTE_MAX, openNotes, type ClientNote } from "@/lib/clients/notes";
import { addClientNote, archiveClientNote } from "@/lib/clients/team.functions";

export function OfficeNotesCard({ clientId, orgId }: { clientId: string; orgId: string }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addClientNote);
  const archiveFn = useServerFn(archiveClientNote);
  const [draft, setDraft] = useState("");
  const key = ["client-office-notes", orgId, clientId];

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
  const names = useProfileNames(notes.map((n) => n.created_by).filter((x): x is string => !!x)).data;

  const addM = useMutation({
    mutationFn: () => addFn({ data: { organizationId: orgId, clientId, body: draft } }),
    onSuccess: () => {
      setDraft("");
      toast.success("Note saved");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveM = useMutation({
    mutationFn: (noteId: string) => archiveFn({ data: { organizationId: orgId, clientId, noteId } }),
    onSuccess: () => {
      toast.success("Note archived");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card data-testid="client-office-notes">
      <CardHeader>
        <CardTitle className="text-base">Office notes</CardTitle>
        <p className="text-xs text-muted-foreground">Only people who can edit clients see these.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={draft}
            maxLength={CLIENT_NOTE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note for the office…"
            aria-label="New office note"
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={!draft.trim() || addM.isPending} onClick={() => addM.mutate()}>
              {addM.isPending ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No office notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border p-3">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {new Date(n.created_at).toLocaleString()}
                    {n.created_by ? ` · ${names?.get(n.created_by) ?? "Team member"}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={archiveM.isPending}
                    onClick={() => archiveM.mutate(n.id)}
                  >
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
