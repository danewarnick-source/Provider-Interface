import { useMemo, useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "@/components/person/person-avatar";
import { useAccess } from "@/hooks/use-access";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { denverYmd } from "@/lib/denver-date";
import { interpretInviteSendResult } from "@/lib/invite-send-result";
import { inviteStaffMembers, resendInvitation } from "@/lib/team-members/invites.functions";
import { deactivateMember, reactivateMember } from "@/lib/team-members/lifecycle.functions";
import { formatLocalDate, profileBadges, type BadgeTone } from "@/lib/team-members/badges";
import {
  MEMBER_STATUS_LABEL,
  headerMenuKeys,
  headerSubline,
  type MemberStatus,
  type TeamMemberProfileData,
} from "@/lib/team-members/profile";
import { lastRosterSearch } from "@/lib/team-members/roster-return";
import {
  DeactivateDialog,
  type DeactivateValues,
} from "@/components/team-members/dialogs/deactivate-dialog";
import {
  ResetPasswordDialog,
  type ResetPasswordTarget,
} from "@/components/team-members/dialogs/reset-password-dialog";
import { useStaffRecord } from "@/components/team-members/profile/staff-record-button";

const profileRoute = getRouteApi("/dashboard/team-members/$staffId");

const TONE: Record<BadgeTone, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  warn: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};

const STATUS_TONE: Record<MemberStatus, string> = {
  active: TONE.ok,
  inactive: TONE.muted,
  pending_first_login: TONE.warn,
  not_invited: TONE.muted,
};

function Chip({
  className,
  title,
  children,
  testId,
}: {
  className: string;
  title?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <span
      title={title}
      data-testid={testId}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Header: back link, photo, name, preset · home · supervisor, hire date, status, badges, ⋯. */
export function ProfileHeader({
  orgId,
  data,
  onChanged,
  onReviewEvidence,
}: {
  orgId: string;
  data: TeamMemberProfileData;
  onChanged: () => void;
  onReviewEvidence: () => void;
}) {
  const { user } = useAuth();
  const { canCategory, isOwner } = useAccess();
  const navigate = profileRoute.useNavigate();
  const backSearch = lastRosterSearch();
  const { member: m, profile: p } = data;
  const staffRecord = useStaffRecord(m.userId, orgId);
  const inviteFn = useServerFn(inviteStaffMembers);
  const resendFn = useServerFn(resendInvitation);
  const deactivateFn = useServerFn(deactivateMember);
  const reactivateFn = useServerFn(reactivateMember);
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const badges = useMemo(
    () =>
      profileBadges({
        items: data.evidence.items,
        files: data.evidence.files,
        today: denverYmd(),
        transportsClients: p.transportsClients,
        dateOfBirth: p.dateOfBirth,
        nameOf: (id) => data.names[id] ?? null,
      }),
    [data, p.transportsClients, p.dateOfBirth],
  );

  const menu = headerMenuKeys(
    {
      userId: m.userId,
      active: m.active,
      accessLevel: m.accessLevel,
      lastSignInAt: data.lastSignInAt,
      lastSignInKnown: data.lastSignInKnown,
      pendingInviteId: data.pendingInviteId,
      email: p.email,
    },
    { userId: user?.id ?? null, isOwner, canCategory },
  );

  const invite = useMutation({
    mutationFn: async () => {
      const res = data.pendingInviteId
        ? await resendFn({
            data: { organization_id: orgId, invitation_id: data.pendingInviteId },
          })
        : await inviteFn({ data: { organization_id: orgId, user_ids: [m.userId], force: true } });
      return interpretInviteSendResult(res);
    },
    onSuccess: (out) => {
      if (out.email_sent) toast.success(`Invite emailed to ${p.email}`);
      else if (out.rpc_failure) toast.error(out.message);
      else
        toast.warning(`Invite saved, but the email didn't send: ${out.email_error ?? out.message}`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (values: DeactivateValues) =>
      deactivateFn({ data: { organizationId: orgId, userId: m.userId, ...values } }),
    onSuccess: () => {
      toast.success(`${p.displayName} moved to Inactive.`);
      setDeactivating(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: () => reactivateFn({ data: { organizationId: orgId, userId: m.userId } }),
    onSuccess: () => {
      toast.success(`${p.displayName} is active again.`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subline = headerSubline([m.presetName, p.homeName, m.supervisorName]);
  const hire = formatLocalDate(p.hireDate);
  const busy = invite.isPending || reactivate.isPending || staffRecord.busy !== null;

  return (
    <div className="space-y-3" data-testid="profile-header">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard/team-members" search={backSearch} data-testid="profile-back">
          <ArrowLeft className="mr-1 h-4 w-4" /> Team Members
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PersonAvatar
            bucket="staff-photos"
            path={p.photoPath}
            name={p.displayName}
            className="h-14 w-14 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-xl font-semibold leading-tight"
                data-testid="staff-profile-heading"
              >
                {p.displayName}
              </h1>
              <Chip className={STATUS_TONE[data.status]} testId="profile-status">
                {MEMBER_STATUS_LABEL[data.status]}
              </Chip>
            </div>
            {subline ? (
              <p className="mt-0.5 text-sm text-muted-foreground" data-testid="profile-subline">
                {subline}
              </p>
            ) : null}
            {hire ? <p className="text-xs text-muted-foreground">Hire date {hire}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="profile-badges">
              {badges.map((b) =>
                b.key === "no_pack" ? (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() =>
                      navigate({ replace: true, search: (prev) => ({ ...prev, tab: "file" }) })
                    }
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium hover:underline",
                      TONE[b.tone],
                    )}
                    data-testid="profile-badge-no_pack"
                  >
                    {b.label}
                  </button>
                ) : (
                  <Chip
                    key={b.key}
                    className={TONE[b.tone]}
                    title={b.title}
                    testId={`profile-badge-${b.key}`}
                  >
                    {b.label}
                  </Chip>
                ),
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={`More actions for ${p.displayName}`}
              disabled={busy}
              data-testid="profile-menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {menu.includes("review_evidence") ? (
              <DropdownMenuItem onSelect={onReviewEvidence}>Review evidence pack</DropdownMenuItem>
            ) : null}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Staff record
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => staffRecord.run("download")}>
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => staffRecord.run("print")}>Print</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => staffRecord.run("save")}>
              Save to documents
            </DropdownMenuItem>
            {menu.some((k) => k !== "review_evidence" && k !== "staff_record") ? (
              <DropdownMenuSeparator />
            ) : null}
            {menu.includes("reset_password") ? (
              <DropdownMenuItem
                onSelect={() => setResetTarget({ userId: m.userId, name: p.displayName })}
              >
                Reset password…
              </DropdownMenuItem>
            ) : null}
            {menu.includes("send_invite") ? (
              <DropdownMenuItem onSelect={() => invite.mutate()}>Send invite</DropdownMenuItem>
            ) : null}
            {menu.includes("resend_invite") ? (
              <DropdownMenuItem onSelect={() => invite.mutate()}>Resend invite</DropdownMenuItem>
            ) : null}
            {menu.includes("deactivate") ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeactivating(true)}
              >
                Deactivate…
              </DropdownMenuItem>
            ) : null}
            {menu.includes("reactivate") ? (
              <DropdownMenuItem onSelect={() => reactivate.mutate()}>Reactivate</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ResetPasswordDialog
        organizationId={orgId}
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <DeactivateDialog
        name={deactivating ? p.displayName : null}
        busy={deactivate.isPending}
        onConfirm={(values) => deactivate.mutate(values)}
        onClose={() => setDeactivating(false)}
      />
    </div>
  );
}
