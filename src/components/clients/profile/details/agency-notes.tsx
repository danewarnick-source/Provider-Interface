// The agency's own About notes (clients.about_me), shown under the Nectar
// bullets as "Added by the agency". Editors change them in place.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateClient } from "@/lib/clients/writes.functions";
import { EditButton, SaveBar } from "@/components/clients/profile/cards/section-card";

export function AgencyNotes({
  orgId,
  clientId,
  value,
  canEdit,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  value: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const updateFn = useServerFn(updateClient);
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (v: string) =>
      updateFn({
        data: { organizationId: orgId, clientId, patch: { about_me: v.trim() || null } },
      }),
    onSuccess: () => {
      toast.success("Agency notes saved.");
      setDraft(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!value && !canEdit) return null;
  return (
    <div className="mt-5 border-t border-hive-border pt-4" data-testid="client-about-agency">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Added by the agency</p>
        {canEdit && draft === null && value ? (
          <EditButton label="Edit agency notes" onClick={() => setDraft(value)} />
        ) : null}
      </div>
      {draft !== null ? (
        <>
          <Textarea
            className="mt-2"
            value={draft}
            rows={4}
            aria-label="Agency notes"
            onChange={(e) => setDraft(e.target.value)}
          />
          <SaveBar
            onCancel={() => setDraft(null)}
            onSave={() => save.mutate(draft)}
            saving={save.isPending}
            saveLabel="Save agency notes"
          />
        </>
      ) : value ? (
        <p className="mt-1 whitespace-pre-wrap text-sm" data-testid="client-about_me">
          {value}
        </p>
      ) : (
        <Button variant="outline" className="mt-2" onClick={() => setDraft("")}>
          Add agency notes
        </Button>
      )}
    </div>
  );
}
