// Write an office note (Clients: Edit). Used by the Office notes card and
// the header's "Add note" dialog.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_NOTE_MAX } from "@/lib/clients/notes";
import { addClientNote } from "@/lib/clients/team.functions";

export const officeNotesKey = (orgId: string, clientId: string) =>
  ["client-office-notes", orgId, clientId] as const;

export function OfficeNoteComposer({
  orgId,
  clientId,
  onSaved,
}: {
  orgId: string;
  clientId: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(addClientNote);
  const [draft, setDraft] = useState("");
  const addM = useMutation({
    mutationFn: () => addFn({ data: { organizationId: orgId, clientId, body: draft } }),
    onSuccess: () => {
      setDraft("");
      toast.success("Note saved");
      void qc.invalidateQueries({ queryKey: officeNotesKey(orgId, clientId) });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
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
        <Button disabled={!draft.trim() || addM.isPending} onClick={() => addM.mutate()}>
          {addM.isPending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </div>
  );
}
