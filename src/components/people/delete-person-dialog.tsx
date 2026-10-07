// One Delete dialog for clients and team members made by mistake. Delete hides
// the person; nothing is erased and an Owner can restore them from Settings →
// Recently deleted. People with service records can't be deleted: the dialog
// says so and points to Discharge / Deactivate. Server: lib/people/delete.functions.ts.

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { deletePerson, getDeleteCheck } from "@/lib/people/delete.functions";
import {
  DELETE_REASONS,
  deleteReasonText,
  nameConfirmed,
  type PersonKind,
} from "@/lib/people/delete-rules";

const REASON_CHOICES = [...DELETE_REASONS, "other"] as const;

export function DeletePersonDialog({
  open,
  onOpenChange,
  orgId,
  kind,
  id,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  kind: PersonKind;
  /** clients.id, or the team member's user id. */
  id: string;
  onDeleted: () => void;
}) {
  const checkFn = useServerFn(getDeleteCheck);
  const deleteFn = useServerFn(deletePerson);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [typed, setTyped] = useState("");

  const check = useQuery({
    enabled: open,
    queryKey: ["delete-check", orgId, kind, id],
    queryFn: () => checkFn({ data: { organizationId: orgId, kind, id } }),
    staleTime: 0,
  });

  const remove = useMutation({
    mutationFn: (reason: string) =>
      deleteFn({ data: { organizationId: orgId, kind, id, reason, typedName: typed } }),
    onSuccess: (r) => {
      toast.success(`${r.name} was deleted. An Owner can restore them from Settings.`);
      close(false);
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function close(next: boolean) {
    if (!next) {
      setChoice("");
      setOther("");
      setTyped("");
    }
    onOpenChange(next);
  }

  const name = check.data?.name ?? "";
  const reason = deleteReasonText(choice, other);
  const ready = !!check.data?.canDelete && !!reason && nameConfirmed(typed, name);
  const who = kind === "client" ? "client" : "team member";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md" data-testid="delete-person-dialog">
        <DialogHeader>
          <DialogTitle>{name ? `Delete ${name}?` : `Delete this ${who}?`}</DialogTitle>
          <DialogDescription>
            Only for a {who} added by mistake. Deleting hides them from every list, search, schedule
            and report. Nothing is erased: their information stays on file and an Owner can restore
            them from Settings → Recently deleted.
          </DialogDescription>
        </DialogHeader>

        {check.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking for service records…</p>
        ) : check.error ? (
          <p className="text-sm text-destructive">{(check.error as Error).message}</p>
        ) : check.data && !check.data.canDelete ? (
          <div
            className="space-y-1 rounded-md border border-hive-border bg-muted p-3 text-sm"
            data-testid="delete-person-blocked"
          >
            <p>{check.data.blockedMessage}</p>
            <p className="text-muted-foreground">On file: {check.data.historyText}.</p>
          </div>
        ) : check.data ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Why are you deleting them?</Label>
              <div className="flex flex-wrap gap-2">
                {REASON_CHOICES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={choice === c}
                    onClick={() => setChoice(c)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm",
                      choice === c
                        ? "border-hive-ink bg-hive-gold-soft font-medium text-hive-ink"
                        : "border-hive-border bg-hive-surface text-muted-foreground",
                    )}
                  >
                    {c === "other" ? "Other" : c}
                  </button>
                ))}
              </div>
              {choice === "other" ? (
                <Input
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  maxLength={300}
                  placeholder="Say why"
                  aria-label="Other reason"
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-person-confirm">Type {name} to confirm</Label>
              <Input
                id="delete-person-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                data-testid="delete-person-confirm"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {check.data?.canDelete === false ? "Close" : "Cancel"}
          </Button>
          {check.data?.canDelete ? (
            <Button
              variant="destructive"
              disabled={!ready || remove.isPending}
              onClick={() => reason && remove.mutate(reason)}
              data-testid="delete-person-submit"
            >
              {remove.isPending ? "Deleting…" : `Delete ${name}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
