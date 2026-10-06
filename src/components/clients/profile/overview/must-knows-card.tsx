// Must-knows: the few things every team member needs before working with
// this client (clients.special_directions). Staff see the same text on shift.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { updateClient } from "@/lib/clients/writes.functions";

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
    <Card
      className={text ? "border-amber-300 dark:border-amber-500/40" : undefined}
      data-testid="client-must-knows"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {text ? <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> : null}
          Must-knows
        </CardTitle>
        {canEdit && draft === null ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Edit must-knows"
            onClick={() => setDraft(text ?? "")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {draft !== null ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              aria-label="Must-knows"
              placeholder="Allergies, seizure plan, how they communicate, what upsets them…"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(null)}
                disabled={save.isPending}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => save.mutate(draft)} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : text ? (
          <p className="whitespace-pre-wrap text-sm">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing written yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
