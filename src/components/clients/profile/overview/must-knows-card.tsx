// Must-knows: the few things every team member needs before working with
// this client (clients.special_directions). Staff see the same text on shift.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { updateClient } from "@/lib/clients/writes.functions";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";

export function MustKnowsCard({
  orgId,
  clientId,
  text,
}: {
  orgId: string;
  clientId: string;
  text: string | null;
}) {
  const qc = useQueryClient();
  const canEdit = useAccess().canCategory("clients", "edit");
  const updateFn = useServerFn(updateClient);
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: string) =>
      updateFn({
        data: {
          organizationId: orgId,
          clientId,
          patch: { special_directions: value.trim() || null },
        },
      }),
    onSuccess: () => {
      toast.success("Must-knows saved.");
      void qc.invalidateQueries({ queryKey: ["client-profile"] });
      setDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      icon={AlertTriangle}
      tone={text ? "profile" : "neutral"}
      title="Must-knows"
      description="What every team member needs to know before working with them."
      className={text ? "border-hive-gold" : undefined}
      testId="client-must-knows"
      actions={
        canEdit && draft === null && text ? (
          <EditButton label="Edit must-knows" onClick={() => setDraft(text ?? "")} />
        ) : null
      }
    >
      {draft !== null ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            aria-label="Must-knows"
            placeholder="Allergies, seizure plan, how they communicate, what upsets them…"
          />
          <SaveBar
            onCancel={() => setDraft(null)}
            onSave={() => save.mutate(draft)}
            saving={save.isPending}
            saveLabel="Save must-knows"
          />
        </>
      ) : text ? (
        <p className="whitespace-pre-wrap text-sm">{text}</p>
      ) : (
        <EmptyState
          action={
            canEdit ? (
              <Button variant="outline" onClick={() => setDraft("")}>
                Write must-knows
              </Button>
            ) : null
          }
        >
          Nothing written yet.
        </EmptyState>
      )}
    </SectionCard>
  );
}
