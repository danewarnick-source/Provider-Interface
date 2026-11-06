import { useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Copy, Loader2, Mail, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccess } from "@/hooks/use-access";
import { interpretInviteSendResult } from "@/lib/invite-send-result";
import { inviteJoinUrl } from "@/lib/join-invite";
import { inviteStaffMembers, resendInvitation } from "@/lib/team-members/invites.functions";
import {
  cancelInviteBlockedReason,
  sendInviteBlockedReason,
} from "@/lib/team-members/invite-rules";
import {
  formatRosterDate,
  rosterQueryKey,
  teamInvitesQueryKey,
  type TeamInviteRow,
} from "@/lib/team-members/roster";
import { CancelInviteDialog, type CancelInviteTarget } from "./cancel-invite-dialog";

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
  const { canCategory, isOwner } = useAccess();
  const canEdit = canCategory("staff_hiring", "edit");
  // One dialog for the list, outside the rows: canceling removes the row.
  const [cancelTarget, setCancelTarget] = useState<CancelInviteTarget | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const askCancel = (row: TeamInviteRow) => {
    if (!row.invitationId) return;
    setCancelTarget({ invitationId: row.invitationId, name: row.name, email: row.email });
    setCancelOpen(true);
  };

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading invites…
        </div>
      ) : !rows.length ? (
        <p className="p-12 text-center text-sm text-muted-foreground">No pending invites.</p>
      ) : (
        <TooltipProvider>
          <ul className="divide-y divide-border" data-testid="invites-view">
            {rows.map((row) => (
              <InviteRowItem
                key={row.invitationId ?? row.userId}
                row={row}
                organizationId={organizationId}
                canEdit={canEdit}
                sendBlocked={sendInviteBlockedReason({
                  level: row.accessLevel,
                  forMember: !!row.userId,
                  viewerIsOwner: isOwner,
                })}
                cancelBlocked={cancelInviteBlockedReason(row.accessLevel, isOwner)}
                onUninvite={() => askCancel(row)}
              />
            ))}
          </ul>
        </TooltipProvider>
      )}
      <CancelInviteDialog
        organizationId={organizationId}
        target={cancelTarget}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}

function InviteRowItem({
  row,
  organizationId,
  canEdit,
  sendBlocked,
  cancelBlocked,
  onUninvite,
}: {
  row: TeamInviteRow;
  organizationId: string | null;
  canEdit: boolean;
  /** Why this viewer can't send or resend this invite, or null. */
  sendBlocked: string | null;
  /** Why this viewer can't cancel this invite, or null. */
  cancelBlocked: string | null;
  onUninvite: () => void;
}) {
  const qc = useQueryClient();
  const resendFn = useServerFn(resendInvitation);
  const inviteFn = useServerFn(inviteStaffMembers);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
    void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
  };

  // One mutation per row, so only this row shows busy.
  const act = useMutation({
    mutationFn: async (kind: "resend" | "send") => {
      if (!organizationId) throw new Error("No organization selected.");
      if (kind === "resend" && row.invitationId) {
        return resendFn({
          data: { organization_id: organizationId, invitation_id: row.invitationId },
        });
      }
      if (!row.userId) throw new Error("This person isn't on the roster yet.");
      return inviteFn({
        data: { organization_id: organizationId, user_ids: [row.userId], force: true },
      });
    },
    onSuccess: (res) => {
      const out = interpretInviteSendResult(res);
      if (out.email_sent) toast.success(`Invite emailed to ${row.email} — expires in 14 days`);
      else if (out.rpc_failure || out.refused) toast.error(out.message);
      else
        toast.warning(`Invite saved, but the email didn't send: ${out.email_error ?? out.message}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async () => {
    if (!row.token) return;
    try {
      await navigator.clipboard.writeText(inviteJoinUrl(row.token));
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
              <WithReason reason={sendBlocked}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !!sendBlocked}
                  onClick={() => act.mutate("resend")}
                >
                  <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Resend
                </Button>
              </WithReason>
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
              </Button>
              <WithReason reason={cancelBlocked}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy || !!cancelBlocked}
                  onClick={onUninvite}
                >
                  <Ban className="mr-1 h-3.5 w-3.5" /> Uninvite
                </Button>
              </WithReason>
            </>
          ) : (
            <WithReason reason={sendBlocked}>
              <Button size="sm" disabled={busy || !!sendBlocked} onClick={() => act.mutate("send")}>
                <Mail className="mr-1 h-3.5 w-3.5" /> Send invite
              </Button>
            </WithReason>
          )}
        </div>
      )}
    </li>
  );
}

/** A disabled button with its reason on hover/focus. Disabled buttons swallow
 *  pointer events, so the wrapper carries the tooltip. */
function WithReason({ reason, children }: { reason: string | null; children: ReactElement }) {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={reason} className="inline-flex cursor-not-allowed">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
