import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { withoutPersonInvites } from "@/lib/team-members/invite-rules";
import { rosterQueryKey, teamInvitesQueryKey, type TeamInviteRow } from "@/lib/team-members/roster";

/**
 * Call after someone is deactivated or deleted. The database has already
 * canceled their pending invites (trg_member_leave_revokes_invites); this drops
 * them from the cached Invited list right away, so the Invited count never
 * shows the old number, then refetches the roster and the Invited list.
 * Callers: useRosterActions (roster Deactivate) and ProfileHeader (Deactivate, Delete).
 */
export function useMemberLeft(organizationId: string | null): (userId: string) => void {
  const qc = useQueryClient();
  return useCallback(
    (userId: string) => {
      qc.setQueryData<TeamInviteRow[]>(teamInvitesQueryKey(organizationId), (rows) =>
        rows ? withoutPersonInvites(rows, userId) : rows,
      );
      void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
      void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
    },
    [qc, organizationId],
  );
}
