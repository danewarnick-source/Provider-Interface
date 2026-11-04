// The Uninvite confirm on the roster's Invited view: "Cancel invite for <name>?".
// Cancel invite → revokeInvitation → the row leaves the list at once (so the
// Invited count drops), toast "Invite canceled.", and the old join link stops
// working. Keep invite closes without changing anything. Rendered once by
// InvitesView, outside the rows, so removing a row never unmounts an open dialog.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { revokeInvitation } from "@/lib/team-members/invite-cancel.functions";
import {
  INVITE_CANCELED_TOAST,
  cancelInviteQuestion,
  withoutInvite,
} from "@/lib/team-members/invite-rules";
import { rosterQueryKey, teamInvitesQueryKey, type TeamInviteRow } from "@/lib/team-members/roster";

export type CancelInviteTarget = { invitationId: string; name: string | null; email: string };

export function CancelInviteDialog({
  organizationId,
  target,
  open,
  onOpenChange,
}: {
  organizationId: string | null;
  /** Kept after closing so the text doesn't blank out while the dialog fades. */
  target: CancelInviteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const revokeFn = useServerFn(revokeInvitation);
  const cancel = useMutation({
    mutationFn: async (t: CancelInviteTarget) => {
      if (!organizationId) throw new Error("No organization selected.");
      return revokeFn({
        data: { organization_id: organizationId, invitation_id: t.invitationId },
      });
    },
    onSuccess: (_res, t) => {
      qc.setQueryData<TeamInviteRow[]>(teamInvitesQueryKey(organizationId), (rows) =>
        rows ? withoutInvite(rows, t.invitationId) : rows,
      );
      toast.success(INVITE_CANCELED_TOAST);
      onOpenChange(false);
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't cancel the invite. Try again.")),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
      void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
    },
  });
  const busy = cancel.isPending;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent data-testid="cancel-invite-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target ? cancelInviteQuestion(target) : "Cancel invite?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            The join link we emailed them stops working right away. If they&apos;re on the roster
            they stay there, and you can send a new invite later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep invite</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || !target}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              // Stay open until the server answers; onSuccess closes it.
              e.preventDefault();
              if (target) cancel.mutate(target);
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel invite
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
