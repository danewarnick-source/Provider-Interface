import { useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { useAuth } from "@/hooks/use-auth";
import { interpretInviteSendResult } from "@/lib/invite-send-result";
import { inviteStaffMembers, resendInvitation } from "@/lib/team-members/invites.functions";
import { archiveEntity, restoreEntity } from "@/lib/team-members/lifecycle.functions";
import {
  rosterQueryKey,
  rowActionKeys,
  teamInvitesQueryKey,
  type RosterActionKey,
  type RosterRow,
} from "@/lib/team-members/roster";
import { DeactivateDialog } from "@/components/team-members/dialogs/deactivate-dialog";
import {
  ResetPasswordDialog,
  type ResetPasswordTarget,
} from "@/components/team-members/dialogs/reset-password-dialog";
import type { RosterActionHandler } from "./row-actions";

/** Which ⋯ items the signed-in viewer gets for a row (see rowActionKeys). */
export function useRowActionKeys(): (row: RosterRow) => RosterActionKey[] {
  const { user } = useAuth();
  const { canCategory, isOwner } = useAccess();
  return useCallback(
    (row: RosterRow) => rowActionKeys(row, { userId: user?.id ?? null, isOwner, canCategory }),
    [user?.id, isOwner, canCategory],
  );
}

/**
 * One handler for every ⋯ item on the roster (table, cards, inactive list),
 * plus the dialogs those items open. Always the app's own dialogs.
 */
export function useRosterActions(organizationId: string | null): {
  onAction: RosterActionHandler;
  busyUserId: string | null;
  dialogs: ReactNode;
} {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const archiveFn = useServerFn(archiveEntity);
  const restoreFn = useServerFn(restoreEntity);
  const inviteFn = useServerFn(inviteStaffMembers);
  const resendFn = useServerFn(resendInvitation);
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(null);
  const [deactivateRow, setDeactivateRow] = useState<RosterRow | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
    void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
  };

  const run = useMutation({
    mutationFn: async ({ key, row }: { key: RosterActionKey; row: RosterRow }) => {
      if (!organizationId) throw new Error("No organization selected.");
      const target = { kind: "employee" as const, id: row.userId, organizationId };
      if (key === "deactivate") return { key, row, res: await archiveFn({ data: target }) };
      if (key === "reactivate") return { key, row, res: await restoreFn({ data: target }) };
      if (key === "resend_invite" && row.pendingInviteId) {
        const res = await resendFn({
          data: {
            organization_id: organizationId,
            invitation_id: row.pendingInviteId,
          },
        });
        return { key, row, res };
      }
      const res = await inviteFn({
        data: {
          organization_id: organizationId,
          user_ids: [row.userId],
          force: true,
        },
      });
      return { key, row, res };
    },
    onSuccess: ({ key, row, res }) => {
      if (key === "deactivate") {
        toast.success(`${row.displayName} moved to Inactive.`);
        setDeactivateRow(null);
      } else if (key === "reactivate") {
        toast.success(`${row.displayName} is active again.`);
      } else {
        const out = interpretInviteSendResult(res);
        if (out.email_sent) toast.success(`Invite emailed to ${row.email}`);
        else if (out.rpc_failure) toast.error(out.message);
        else
          toast.warning(
            `Invite saved, but the email didn't send: ${out.email_error ?? out.message}`,
          );
      }
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onAction: RosterActionHandler = (key, row) => {
    const params = { staffId: row.userId };
    switch (key) {
      case "open":
        void navigate({ to: "/dashboard/team-members/$staffId", params });
        return;
      case "evidence":
        void navigate({ to: "/dashboard/team-members/$staffId", params, search: { tab: "file" } });
        return;
      case "caseload":
        void navigate({
          to: "/dashboard/team-members/$staffId",
          params,
          search: { tab: "caseload" },
        });
        return;
      case "reset_password":
        setResetTarget({ userId: row.userId, name: row.displayName });
        return;
      case "deactivate":
        setDeactivateRow(row);
        return;
      default:
        run.mutate({ key, row });
    }
  };

  const busyUserId = run.isPending ? (run.variables?.row.userId ?? null) : null;

  return {
    onAction,
    busyUserId,
    dialogs: (
      <>
        <ResetPasswordDialog
          organizationId={organizationId}
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
        <DeactivateDialog
          name={deactivateRow?.displayName ?? null}
          busy={run.isPending && run.variables?.key === "deactivate"}
          onConfirm={() => deactivateRow && run.mutate({ key: "deactivate", row: deactivateRow })}
          onClose={() => setDeactivateRow(null)}
        />
      </>
    ),
  };
}
