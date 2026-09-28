import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Copy, Loader2, Mail, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useAccess } from "@/hooks/use-access";
import { resolveAuthOrigin } from "@/lib/auth-redirect";
import { interpretInviteSendResult } from "@/lib/invite-send-result";
import { inviteJoinUrl } from "@/lib/join-invite";
import {
  inviteStaffMembers,
  resendInvitation,
  revokeInvitation,
} from "@/lib/team-members/invites.functions";
import {
  formatRosterDate,
  rosterQueryKey,
  teamInvitesQueryKey,
  type TeamInviteRow,
} from "@/lib/team-members/roster";

/** Invited view: pending invites with expiry, then accounts that never got an invite email. */
export function InvitesView({
  organizationId,
  rows,
  loading,
}: {
  organizationId: string | null;
  rows: TeamInviteRow[];
  loading: boolean;
}) {
  const { canCategory } = useAccess();
  const canEdit = canCategory("staff_hiring", "edit");
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading invites…
      </div>
    );
  }
  if (!rows.length) {
    return <p className="p-12 text-center text-sm text-muted-foreground">No pending invites.</p>;
  }
  return (
    <ul className="divide-y divide-border" data-testid="invites-view">
      {rows.map((row) => (
        <InviteRowItem
          key={row.invitationId ?? row.userId}
          row={row}
          organizationId={organizationId}
          canEdit={canEdit}
        />
      ))}
    </ul>
  );
}

function InviteRowItem({
  row,
  organizationId,
  canEdit,
}: {
  row: TeamInviteRow;
  organizationId: string | null;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const resendFn = useServerFn(resendInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const inviteFn = useServerFn(inviteStaffMembers);
  const [confirmUninvite, setConfirmUninvite] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
    void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
  };

  // One mutation per row, so only this row shows busy.
  const act = useMutation({
    mutationFn: async (kind: "resend" | "send" | "uninvite") => {
      if (!organizationId) throw new Error("No organization selected.");
      const site_origin = resolveAuthOrigin();
      if (kind === "uninvite" && row.invitationId) {
        await revokeFn({
          data: { organization_id: organizationId, invitation_id: row.invitationId },
        });
        return { kind, res: null };
      }
      if (kind === "resend" && row.invitationId) {
        const res = await resendFn({
          data: { organization_id: organizationId, invitation_id: row.invitationId, site_origin },
        });
        return { kind, res };
      }
      if (!row.userId) throw new Error("This person isn't on the roster yet.");
      const res = await inviteFn({
        data: { organization_id: organizationId, site_origin, user_ids: [row.userId], force: true },
      });
      return { kind, res };
    },
    onSuccess: ({ kind, res }) => {
      if (kind === "uninvite") {
        toast.success(`Uninvited ${row.email}. That link no longer works.`);
        setConfirmUninvite(false);
      } else {
        const out = interpretInviteSendResult(res);
        if (out.email_sent) toast.success(`Invite emailed to ${row.email} — expires in 14 days`);
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

  const copyLink = async () => {
    if (!row.token) return;
    try {
      await navigator.clipboard.writeText(inviteJoinUrl(resolveAuthOrigin(), row.token));
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy the invite link. Your browser blocked the clipboard.");
    }
  };

  const busy = act.isPending;
  return (
    <li className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{row.name ?? row.email}</span>
          {row.expired && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive-foreground">
              Expired
            </span>
          )}
        </div>
        <div className="truncate pl-6 text-xs text-muted-foreground">
          {row.name ? row.email : ""}
          {row.accessLevel !== "staff" && (
            <>
              {row.name ? " · " : ""}
              {row.accessLevel === "owner" ? "Owner" : "Admin"}
            </>
          )}
          {row.name || row.accessLevel !== "staff" ? " · " : ""}
          {row.status === "pending" ? (
            <>
              Invited {formatRosterDate(row.createdAt)}
              {" · "}
              <span className={row.expired ? "text-destructive" : undefined}>
                {row.expired ? "Expired" : "Expires"} {formatRosterDate(row.expiresAt)}
              </span>
            </>
          ) : (
            "Account created — no invite email sent"
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1 pl-6 md:pl-0">
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin text-muted-foreground" />}
          {row.status === "pending" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => act.mutate("resend")}
              >
                <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Resend
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setConfirmUninvite(true)}
              >
                <Ban className="mr-1 h-3.5 w-3.5" /> Uninvite
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => act.mutate("send")}>
              <Mail className="mr-1 h-3.5 w-3.5" /> Send invite
            </Button>
          )}
        </div>
      )}
      <AlertDialog open={confirmUninvite} onOpenChange={(o) => !busy && setConfirmUninvite(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninvite {row.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their join link stops working. If they're already on the roster they stay there — you
              can send a new invite later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                act.mutate("uninvite");
              }}
            >
              Uninvite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
